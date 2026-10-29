import { Suspense } from "react";
import { AnticipationForm } from "@/components/anticipation-form";
import { createSupabaseRepository } from "@/lib/anticipation/supabase-repository";
import { requireUser } from "@/lib/auth";
import { getErpClient } from "@/lib/erp/client";
import { createAdminClient } from "@/lib/supabase/admin";

async function OpenReceivables() {
  await requireUser();

  const receivables = await getErpClient().listOpenReceivables();
  const taken = new Set(
    await createSupabaseRepository(createAdminClient()).findAnticipatedIds(
      receivables.map((r) => r.id),
    ),
  );
  const available = receivables
    .filter((r) => !taken.has(r.id))
    .map(({ id, customer, documentNumber, dueDate, faceCents }) => ({
      id,
      customer,
      documentNumber,
      dueDate,
      faceCents,
    }));

  return <AnticipationForm receivables={available} today={new Date().toISOString().slice(0, 10)} />;
}

export default function ReceivablesPage() {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Títulos em aberto</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando títulos...</p>}>
        <OpenReceivables />
      </Suspense>
    </main>
  );
}
