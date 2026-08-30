export type Env = Record<string, never>;

const worker: ExportedHandler<Env> = {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ service: "gyst-reminders", status: "ok" });
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(_controller, _env, context) {
    // The reminder workflow is added only after its Supabase RPC contract exists.
    context.waitUntil(Promise.resolve());
  },
};

export default worker;
