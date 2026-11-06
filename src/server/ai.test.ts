import { expect, it, vi } from "vitest";
import { handleAI, prompts } from "./ai";
import { defaultOptions, protectText, type AIRequest } from "../ai/text";
const env = {
  AI_ENABLED: "true",
  OPENAI_API_KEY: "test-secret-not-real",
  UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "test-redis-not-real",
  AI_RATE_SALT: "s".repeat(32),
  AI_ALLOWED_ORIGIN: "https://memo.example",
};
const data = (text = "明日は会議です。予算は100円。"): AIRequest => ({
  text,
  colors: [],
  nonce: "a".repeat(32),
  options: { ...defaultOptions },
});
const req = (body = data(), origin = env.AI_ALLOWED_ORIGIN) =>
  new Request("https://memo.example/.netlify/functions/ai", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
function upstream(output: string, quota = 1) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ result: quota }))
    .mockResolvedValueOnce(
      Response.json({
        status: "completed",
        output: [
          { type: "message", content: [{ type: "output_text", text: output }] },
        ],
      }),
    );
}
it.each(["日本語の要約。", "An English summary."])(
  "uses the real Responses protocol with storage disabled: %s (fixture)",
  async (out) => {
    const send = upstream(out),
      response = await handleAI(req(), env, { ip: "192.0.2.1", fetch: send });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ output: out });
    expect(send.mock.calls[1][0]).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(send.mock.calls[1][1]!.body as string);
    expect(body.store).toBe(false);
    expect(body.max_output_tokens).toBe(4096);
    const quota = JSON.parse(send.mock.calls[0][1]!.body as string);
    expect(quota[0]).toBe("EVAL");
    expect(quota[1]).toContain("INCR");
    expect(quota[1]).toContain("EXPIRE");
    expect(quota.join(" ")).not.toContain("192.0.2.1");
    expect(quota.join(" ")).not.toContain(data().text);
  },
);
it.each(["boss", "professor"] as const)(
  "sends appropriate rewrite purpose %s without conflicting translation instructions",
  (purpose) => {
    const d = data();
    d.options = {
      ...d.options,
      action: "polite",
      purpose,
      relationship: "学生から教授へ",
    };
    const input = JSON.parse(prompts(d).input);
    expect(input.purpose).toBe(
      purpose === "boss" ? "上司への報告" : "教授へのメール",
    );
    expect(input.relationship).toBe("学生から教授へ");
    expect(input.translationTarget).toBeUndefined();
    expect(input.summaryStyle).toBeUndefined();
  },
);
it.each(["respectful", "humble"] as const)(
  "retains honorific role and tone: %s",
  (tone) => {
    const d = data();
    d.options = { ...d.options, action: "honorific", tone };
    expect(JSON.parse(prompts(d).input).tone).toBe(
      tone === "humble" ? "謙譲語" : "尊敬語",
    );
    expect(prompts(d).instructions).toContain("avoiding double honorifics");
  },
);
it("translation and proofreading expose only relevant options", () => {
  const d = data();
  d.options.action = "translate";
  expect(JSON.parse(prompts(d).input).translationTarget).toContain(
    "Detect Japanese/English",
  );
  d.options.action = "proofread";
  expect(JSON.parse(prompts(d).input).proofreading).toContain("spelling");
  expect(JSON.parse(prompts(d).input).translationTarget).toBeUndefined();
});
it("fails closed when unconfigured, disabled, wrong origin, missing trusted IP or invalid input", async () => {
  const send = vi.fn<typeof fetch>();
  for (const [request, settings, ip, code] of [
    [req(), {}, "1", 503],
    [req(), { ...env, AI_ENABLED: "false" }, "1", 503],
    [req(data(), "https://attacker.example"), env, "1", 403],
    [req(), env, undefined, 503],
    [req(data("x".repeat(8001))), env, "1", 400],
  ] as const)
    expect(
      (await handleAI(request, settings, { ip, fetch: send })).status,
    ).toBe(code);
  expect(send).not.toHaveBeenCalled();
  const result = await handleAI(new Request("https://memo.example/"), {});
  expect((await result.json()).available).toBe(false);
});
it.each([-1, -2, 0])(
  "does not call OpenAI when atomic quota result is %s",
  async (quota) => {
    const send = upstream("unused", quota);
    const r = await handleAI(req(), env, { ip: "192.0.2.1", fetch: send });
    expect(r.status).toBe(quota === 0 ? 503 : 429);
    expect(send).toHaveBeenCalledTimes(1);
  },
);
it("bounds configured limits and stops on Redis failure", async () => {
  const send = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error("redis-secret"));
  const r = await handleAI(req(), env, { ip: "192.0.2.1", fetch: send });
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("redis-secret");
  const info = await (
    await handleAI(new Request("https://memo.example/"), {
      ...env,
      AI_DAILY_LIMIT: "99999",
      AI_IP_DAILY_LIMIT: "99999",
    })
  ).json();
  expect(info.dailyLimit).toBe(200);
  expect(info.perIPLimit).toBe(20);
});
it("validates protected tokens server side and never returns a secret on malformed replies", async () => {
  const d = data();
  d.colors = [{ start: 0, end: 2, color: "red" }];
  const good = await handleAI(req(d), env, {
    ip: "test",
    fetch: upstream(protectText(d).masked),
  });
  expect(good.status).toBe(200);
  const bad = await handleAI(req(d), env, {
    ip: "test",
    fetch: upstream("保護文字がない"),
  });
  expect(bad.status).toBe(502);
  expect(await bad.text()).not.toContain(env.OPENAI_API_KEY);
});
it.each([429, 401, 500])(
  "handles provider HTTP %s without leaking provider details",
  async (code) => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ result: 1 }))
      .mockResolvedValueOnce(
        new Response("secret provider detail", { status: code }),
      );
    const r = await handleAI(req(), env, { ip: "test", fetch: send });
    expect(r.status).toBe(code === 429 ? 429 : 502);
    expect(await r.text()).not.toContain("secret");
  },
);
it("handles timeout and rejects incomplete output", async () => {
  const send = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ result: 1 }))
    .mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
  expect((await handleAI(req(), env, { ip: "test", fetch: send })).status).toBe(
    504,
  );
  const incomplete = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ result: 1 }))
    .mockResolvedValueOnce(Response.json({ status: "incomplete", output: [] }));
  expect(
    (await handleAI(req(), env, { ip: "test", fetch: incomplete })).status,
  ).toBe(502);
});

it.each([null, { unexpected: "object" }, 123])(
  "rejects non-string provider text: %s",
  async (text) => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ result: 1 }))
      .mockResolvedValueOnce(
        Response.json({
          status: "completed",
          output: [
            { type: "message", content: [{ type: "output_text", text }] },
          ],
        }),
      );
    expect(
      (await handleAI(req(), env, { ip: "test", fetch: send })).status,
    ).toBe(502);
  },
);
