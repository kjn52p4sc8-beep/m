import { handleAI } from "../../src/server/ai.ts";
export default async (request: Request, context: { ip?: string }) =>
  handleAI(request, process.env, { ip: context.ip });
