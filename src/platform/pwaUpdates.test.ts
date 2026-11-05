import { afterEach, expect, it, vi } from "vitest";
import { watchPwaUpdates } from "../pwa";
afterEach(() => vi.unstubAllGlobals());
function setup(update: () => Promise<unknown>) {
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const win = new EventTarget(),
    nav = { onLine: true };
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", nav);
  let time = 1_000_000;
  const cleanup = watchPwaUpdates(
    { update } as unknown as ServiceWorkerRegistration,
    () => time,
  );
  return {
    doc,
    win,
    nav,
    cleanup,
    advance: () => {
      time += 300001;
    },
  };
}
it("checks once on foreground after five minutes, throttles and removes listeners", async () => {
  const update = vi.fn().mockResolvedValue(undefined);
  const s = setup(update);
  s.doc.dispatchEvent(new Event("visibilitychange"));
  expect(update).not.toHaveBeenCalled();
  s.advance();
  s.doc.visibilityState = "hidden";
  s.doc.dispatchEvent(new Event("visibilitychange"));
  expect(update).not.toHaveBeenCalled();
  s.doc.visibilityState = "visible";
  s.doc.dispatchEvent(new Event("visibilitychange"));
  s.win.dispatchEvent(new Event("online"));
  await Promise.resolve();
  expect(update).toHaveBeenCalledTimes(1);
  s.advance();
  s.nav.onLine = false;
  s.doc.dispatchEvent(new Event("visibilitychange"));
  expect(update).toHaveBeenCalledTimes(1);
  s.nav.onLine = true;
  s.win.dispatchEvent(new Event("online"));
  await Promise.resolve();
  expect(update).toHaveBeenCalledTimes(2);
  s.cleanup();
  s.advance();
  s.doc.dispatchEvent(new Event("visibilitychange"));
  s.win.dispatchEvent(new Event("online"));
  expect(update).toHaveBeenCalledTimes(2);
});
it("allows a later retry after failure without parallel update requests", async () => {
  let reject!: (e: Error) => void;
  const update = vi.fn(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
  );
  const s = setup(update);
  s.advance();
  s.doc.dispatchEvent(new Event("visibilitychange"));
  s.advance();
  s.win.dispatchEvent(new Event("online"));
  expect(update).toHaveBeenCalledTimes(1);
  reject(Error("offline"));
  await Promise.resolve();
  await Promise.resolve();
  s.win.dispatchEvent(new Event("online"));
  expect(update).toHaveBeenCalledTimes(2);
  reject(Error("offline"));
  await Promise.resolve();
  s.cleanup();
});
