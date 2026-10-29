import type { ErpClient } from "@/lib/erp/types";
import { calcAnticipation, daysBetween } from "./calc";
import type { AnticipationRecord, AnticipationRepository } from "./repository";

export type CreateAnticipationInput = {
  receivableIds: string[];
  bankAccountRef: string;
  anticipationDate: string;
  monthlyRatePercent: number;
  feeCents: number;
};

export type Deps = { erp: ErpClient; repo: AnticipationRepository };

export async function createAnticipation(
  deps: Deps,
  input: CreateAnticipationInput,
): Promise<AnticipationRecord> {
  const { erp, repo } = deps;
  const ids = [...new Set(input.receivableIds)];
  if (ids.length === 0) throw new Error("Selecione ao menos um título");

  const already = await repo.findAnticipatedIds(ids);
  if (already.length > 0) {
    throw new Error(`Títulos já antecipados: ${already.join(", ")}`);
  }

  // Valores vêm sempre do ERP, nunca do cliente.
  const receivables = await Promise.all(ids.map((id) => erp.getReceivable(id)));
  const loaded = receivables.map((r, i) => {
    if (!r) throw new Error(`Título não encontrado no ERP: ${ids[i]}`);
    if (r.status !== "open") throw new Error(`Título não está em aberto: ${r.id}`);
    return r;
  });

  const calc = calcAnticipation({
    anticipationDate: input.anticipationDate,
    monthlyRatePercent: input.monthlyRatePercent,
    feeCents: input.feeCents,
    receivables: loaded.map((r) => ({ id: r.id, faceCents: r.faceCents, dueDate: r.dueDate })),
  });

  const record = await repo.create(
    {
      bankAccountRef: input.bankAccountRef,
      anticipationDate: input.anticipationDate,
      monthlyRatePercent: input.monthlyRatePercent,
      grossCents: calc.grossCents,
      interestCents: calc.interestCents,
      feeCents: calc.feeCents,
      netCents: calc.netCents,
    },
    loaded.map((r) => ({
      erpReceivableId: r.id,
      customer: r.customer,
      documentNumber: r.documentNumber,
      dueDate: r.dueDate,
      faceCents: r.faceCents,
      interestCents: calc.items.find((i) => i.id === r.id)?.interestCents ?? 0,
    })),
  );

  return postAnticipation(deps, record.id);
}

/**
 * Lança no ERP o líquido no banco e as despesas. Chaves de idempotência fixas por operação:
 * pode ser chamada de novo após uma falha sem duplicar lançamentos.
 */
export async function postAnticipation(
  { erp, repo }: Deps,
  anticipationId: string,
): Promise<AnticipationRecord> {
  const anticipation = await repo.get(anticipationId);
  if (!anticipation) throw new Error(`Antecipação não encontrada: ${anticipationId}`);
  if (anticipation.status !== "draft" && anticipation.status !== "failed") return anticipation;

  const base = {
    bankAccountRef: anticipation.bankAccountRef,
    date: anticipation.anticipationDate,
  };
  const steps = [
    {
      name: "bank",
      amountCents: anticipation.netCents,
      description: `Antecipação de recebíveis ${anticipation.id} (líquido)`,
      run: erp.createBankEntry.bind(erp),
    },
    {
      name: "interest",
      amountCents: anticipation.interestCents,
      description: `Juros da antecipação ${anticipation.id}`,
      run: erp.createExpense.bind(erp),
    },
    {
      name: "fee",
      amountCents: anticipation.feeCents,
      description: `Tarifa bancária da antecipação ${anticipation.id}`,
      run: erp.createExpense.bind(erp),
    },
  ];

  const entryIds = { ...anticipation.erpEntryIds };
  for (const step of steps) {
    if (entryIds[step.name] || step.amountCents === 0) continue;
    const idempotencyKey = `${anticipation.id}:${step.name}`;
    const payload = { ...base, idempotencyKey, amountCents: step.amountCents, description: step.description };
    try {
      const { entryId } = await step.run(payload);
      entryIds[step.name] = entryId;
      await repo.logSync({ idempotencyKey, operation: step.name, payload, ok: true });
      await repo.update(anticipation.id, { erpEntryIds: entryIds });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await repo.logSync({ idempotencyKey, operation: step.name, payload, ok: false, error: message });
      await repo.update(anticipation.id, { status: "failed", erpEntryIds: entryIds, lastError: message });
      throw error;
    }
  }

  await repo.update(anticipation.id, { status: "posted", lastError: null });
  return { ...anticipation, status: "posted", erpEntryIds: entryIds, lastError: null };
}

export type SettlementSummary = { settled: number; defaulted: number; checked: number };

/**
 * Consulta o ERP para os títulos antecipados ainda pendentes. Se o ERP já os mostra como
 * liquidados, apenas espelha o status localmente (a baixa foi feita pela conciliação bancária
 * do ERP). Títulos vencidos há mais de `graceDays` e ainda abertos viram `defaulted`.
 */
export async function runSettlementCheck(
  { erp, repo }: Deps,
  today: string,
  graceDays = 5,
): Promise<SettlementSummary> {
  const pending = await repo.listByStatus("anticipated");
  const summary: SettlementSummary = { settled: 0, defaulted: 0, checked: pending.length };
  const touched = new Set<string>();

  for (const item of pending) {
    const receivable = await erp.getReceivable(item.erpReceivableId);
    if (receivable?.status === "settled") {
      await repo.markItemSettled(item.erpReceivableId, receivable.settledAt ?? today);
      summary.settled += 1;
      touched.add(item.anticipationId);
    } else if (daysBetween(item.dueDate, today) > graceDays) {
      await repo.markItemDefaulted(item.erpReceivableId);
      summary.defaulted += 1;
    }
  }

  for (const anticipationId of touched) {
    const items = await repo.listItems(anticipationId);
    const settledCount = items.filter((i) => i.status === "settled").length;
    await repo.update(anticipationId, {
      status: settledCount === items.length ? "settled" : "partially_settled",
    });
  }

  return summary;
}
