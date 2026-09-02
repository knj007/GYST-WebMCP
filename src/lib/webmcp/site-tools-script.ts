export const webMcpSiteToolsScript = String.raw`
(() => {
  let remainingAttempts = 5;
  const register = () => {
    const context = document.modelContext;
    if (!context || typeof context.registerTool !== "function") {
      if (remainingAttempts-- > 0) window.setTimeout(register, 50);
      return;
    }
    const emptySchema = { type: "object", additionalProperties: false, properties: {} };
    const tools = [
      {
        name: "gyst.get_status",
        description: "Read GYST's current page and explain how to reach an available daily or weekly ritual. This does not reveal account or ledger data.",
        inputSchema: emptySchema,
        annotations: { readOnlyHint: true },
        execute: async () => {
          const path = window.location.pathname;
          const message = path === "/login"
            ? "GYST is on the login page. Sign in, then open the daily or weekly ritual."
            : "GYST is currently on " + path + ". Open a ritual page to use its draft-only tools.";
          return { path, message };
        },
      },
      {
        name: "gyst.open_daily_ritual",
        description: "Navigate to GYST's daily ritual. The page may ask the user to sign in before draft-only tools become available.",
        inputSchema: emptySchema,
        execute: async () => { window.location.assign("/daily"); return { destination: "/daily", message: "Opening the daily ritual." }; },
      },
      {
        name: "gyst.open_weekly_ritual",
        description: "Navigate to GYST's weekly ritual. The page may ask the user to sign in before draft-only tools become available.",
        inputSchema: emptySchema,
        execute: async () => { window.location.assign("/weekly"); return { destination: "/weekly", message: "Opening the weekly ritual." }; },
      },
    ];
    for (const tool of tools) {
      context.registerTool(tool).catch((error) => {
        const reason = error && typeof error.name === "string" && error.name ? error.name : "UnknownError";
        console.warn("[WebMCP] Failed to register " + tool.name + ": " + reason, error);
      });
    }
  };
  register();
})();
`;
