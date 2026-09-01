import { NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { createMarkdownExport, createPortableExport, type ExportClient } from "@/lib/export/portable";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const identity = await requireUser();
  if (identity.isDemo) return new Response("Exports are available to permanent accounts only.", { status: 403 });

  const client = await createServerSupabaseClient();
  const includeDrafts = request.nextUrl.searchParams.get("full_backup") === "1";
  const portable = await createPortableExport(client as unknown as ExportClient, identity.userId, includeDrafts);
  return new Response(createMarkdownExport(portable), {
    headers: {
      "content-disposition": `attachment; filename=\"${includeDrafts ? "gyst-full-backup.md" : "gyst-committed-records.md"}\"`,
      "content-type": "text/markdown; charset=utf-8",
    },
  });
}
