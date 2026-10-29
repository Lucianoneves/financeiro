const MS_PER_DAY = 86_400_000;

export type CalcReceivable = {
  id: string;
  faceCents: number;
  dueDate: string;
};

export type CalcInput = {
  anticipationDate: string;
  monthlyRatePercent: number;
  feeCents: number;
  receivables: CalcReceivable[];
};

export type CalcItem = {
  id: string;
  faceCents: number;
  days: number;
  interestCents: number;
};

export type CalcResult = {
  items: CalcItem[];
  grossCents: number;
  interestCents: number;
  feeCents: number;
  netCents: number;
};

function toUtcDay(date: string): number {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(time)) throw new Error(`Data inválida: ${date}`);
  return time;
}

export function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((toUtcDay(to) - toUtcDay(from)) / MS_PER_DAY));
}

/** Desconto simples pro rata: valor * (taxa mensal / 30) * dias, arredondado por título. */
export function calcAnticipation(input: CalcInput): CalcResult {
  if (input.monthlyRatePercent < 0) throw new Error("Taxa não pode ser negativa");
  if (input.feeCents < 0) throw new Error("Tarifa não pode ser negativa");

  const items = input.receivables.map((r): CalcItem => {
    const days = daysBetween(input.anticipationDate, r.dueDate);
    const interestCents = Math.round(
      (r.faceCents * input.monthlyRatePercent * days) / (100 * 30),
    );
    return { id: r.id, faceCents: r.faceCents, days, interestCents };
  });

  const grossCents = items.reduce((sum, i) => sum + i.faceCents, 0);
  const interestCents = items.reduce((sum, i) => sum + i.interestCents, 0);
  const netCents = grossCents - interestCents - input.feeCents;

  if (netCents < 0) throw new Error("Valor líquido negativo");

  return { items, grossCents, interestCents, feeCents: input.feeCents, netCents };
}
