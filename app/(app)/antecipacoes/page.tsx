import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { formatCents, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  posted: "Lançada no ERP",
  partially_settled: "Parcialmente liquidada",
  settled: "Liquidada",
  failed: "Falha no ERP",
};

type Row = {
  id: string;
  anticipation_date: string;
  gross_cents: number;
  interest_cents: number;
  fee_cents: number;
  net_cents: number;
  status: string;
  last_error: string | null;
};

async function AnticipationList() {
  await requireUser();

  // Cliente com sessão do usuário: a RLS decide o que ele pode ler.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("anticipations")
    .select("id, anticipation_date, gross_cents, interest_cents, fee_cents, net_cents, status, last_error")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma antecipação registrada.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-left text-muted-foreground">
        <tr>
          <th className="py-2">Data</th>
          <th className="text-right">Bruto</th>
          <th className="text-right">Juros</th>
          <th className="text-right">Tarifa</th>
          <th className="text-right">Líquido</th>
          <th className="pl-4">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t">
            <td className="py-2">{formatDate(r.anticipation_date)}</td>
            <td className="text-right">{formatCents(Number(r.gross_cents))}</td>
            <td className="text-right">{formatCents(Number(r.interest_cents))}</td>
            <td className="text-right">{formatCents(Number(r.fee_cents))}</td>
            <td className="text-right font-medium">{formatCents(Number(r.net_cents))}</td>
            <td className="pl-4">
              {statusLabel[r.status] ?? r.status}
              {r.last_error ? <span className="block text-xs text-destructive">{r.last_error}</span> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AnticipationsPage() {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Antecipações</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando...</p>}>
        <AnticipationList />
      </Suspense>
    </main>
  );
}
