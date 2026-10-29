import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service role: ignora RLS. Usar apenas em Server Actions/Route Handlers após checar autorização. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
