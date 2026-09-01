import { NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { createPortableExport, type ExportClient } from "@/lib/export/portable";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const identity = await requireUser();
  if (identity.isDemo) return new Response("Exports are available to permanent accounts only.", { status: 403 });

  const includeDrafts = request.nextUrl.searchParams.get("full_backup") === "1";
  const client = await createServerSupabaseClient();
  const portable = await createPortableExport(client as unknown as ExportClient, identity.userId, includeDrafts);
  const filename = includeDrafts ? "gyst-full-backup.json" : "gyst-committed-records.json";

  return Response.json(portable, { headers: { "content-disposition": `attachment; filename=\"${filename}\"` } });
}
