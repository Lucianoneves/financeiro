"use server";

import { revalidatePath } from "next/cache";
import { createAnticipation } from "@/lib/anticipation/service";
import { createSupabaseRepository } from "@/lib/anticipation/supabase-repository";
import { requireUser } from "@/lib/auth";
import { getErpClient } from "@/lib/erp/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAnticipationSchema, type ActionResult } from "@/types/anticipation";

export async function createAnticipationAction(values: unknown): Promise<ActionResult> {
  await requireUser();

  const parsed = createAnticipationSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    const record = await createAnticipation(
      { erp: getErpClient(), repo: createSupabaseRepository(createAdminClient()) },
      parsed.data,
    );
    revalidatePath("/recebiveis");
    revalidatePath("/antecipacoes");
    return { ok: true, anticipationId: record.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado" };
  }
}
