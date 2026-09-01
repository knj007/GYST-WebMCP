import { deliverDueReminders } from "./delivery";

const worker = {
  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/health") {
      return Response.json({ service: "gyst-reminders", status: "ok" });
    }
    return new Response("Not found", { status: 404 });
  },
  async scheduled(_controller: ScheduledController, env: Env, context: ExecutionContext): Promise<void> {
    context.waitUntil(deliverDueReminders(env));
  },
} satisfies ExportedHandler<Env>;

export default worker;
