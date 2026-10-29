"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAnticipationAction } from "@/actions/anticipations";
import { Button } from "@/components/ui/button";
import { calcAnticipation } from "@/lib/anticipation/calc";
import { formatCents, formatDate, parseMoneyToCents } from "@/lib/format";

export type OpenReceivable = {
  id: string;
  customer: string;
  documentNumber: string;
  dueDate: string;
  faceCents: number;
};

const inputClass = "h-9 rounded-lg border border-input bg-background px-3";

export function AnticipationForm({
  receivables,
  today,
}: {
  receivables: OpenReceivable[];
  today: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bankAccountRef, setBankAccountRef] = useState("");
  const [date, setDate] = useState(today);
  const [rate, setRate] = useState("3");
  const [fee, setFee] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => {
    const feeCents = parseMoneyToCents(fee);
    const rateNumber = Number(rate.replace(",", "."));
    if (selected.size === 0 || Number.isNaN(feeCents) || Number.isNaN(rateNumber)) return null;
    try {
      return calcAnticipation({
        anticipationDate: date,
        monthlyRatePercent: rateNumber,
        feeCents,
        receivables: receivables
          .filter((r) => selected.has(r.id))
          .map((r) => ({ id: r.id, faceCents: r.faceCents, dueDate: r.dueDate })),
      });
    } catch {
      return null;
    }
  }, [selected, rate, fee, date, receivables]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createAnticipationAction({
        receivableIds: [...selected],
        bankAccountRef,
        anticipationDate: date,
        monthlyRatePercent: Number(rate.replace(",", ".")),
        feeCents: parseMoneyToCents(fee),
      });
      if (result.ok) router.push("/antecipacoes");
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="w-8 py-2" />
            <th>Cliente</th>
            <th>Documento</th>
            <th>Vencimento</th>
            <th className="text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {receivables.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2">
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  aria-label={`Selecionar ${r.documentNumber}`}
                />
              </td>
              <td>{r.customer}</td>
              <td>{r.documentNumber}</td>
              <td>{formatDate(r.dueDate)}</td>
              <td className="text-right">{formatCents(r.faceCents)}</td>
            </tr>
          ))}
          {receivables.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 text-center text-muted-foreground">
                Nenhum título em aberto disponível para antecipar.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="grid gap-4 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          Conta bancária
          <input className={inputClass} value={bankAccountRef} onChange={(e) => setBankAccountRef(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Data
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Taxa (% ao mês)
          <input className={inputClass} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tarifa (R$)
          <input className={inputClass} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
      </div>

      {preview ? (
        <dl className="grid grid-cols-2 gap-2 rounded-lg border p-4 text-sm sm:grid-cols-4">
          <div><dt className="text-muted-foreground">Bruto</dt><dd>{formatCents(preview.grossCents)}</dd></div>
          <div><dt className="text-muted-foreground">Juros</dt><dd>{formatCents(preview.interestCents)}</dd></div>
          <div><dt className="text-muted-foreground">Tarifa</dt><dd>{formatCents(preview.feeCents)}</dd></div>
          <div><dt className="text-muted-foreground">Líquido</dt><dd className="font-semibold">{formatCents(preview.netCents)}</dd></div>
        </dl>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div>
        <Button onClick={submit} disabled={pending || !preview || bankAccountRef.trim() === ""}>
          {pending ? "Registrando..." : "Registrar antecipação"}
        </Button>
      </div>
    </div>
  );
}
