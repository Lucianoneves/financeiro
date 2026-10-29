import { timingSafeEqual } from "node:crypto";
import { runSettlementCheck } from "@/lib/anticipation/service";
import { createSupabaseRepository } from "@/lib/anticipation/supabase-repository";
import { getErpClient } from "@/lib/erp/client";
import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const summary = await runSettlementCheck(
    { erp: getErpClient(), repo: createSupabaseRepository(createAdminClient()) },
    today,
  );
  return Response.json(summary);
}
