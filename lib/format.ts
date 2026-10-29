const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** "1.234,56" ou "1234.56" -> centavos; NaN se inválido. */
export function parseMoneyToCents(value: string): number {
  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  const number = Number(normalized.trim());
  return Number.isFinite(number) ? Math.round(number * 100) : Number.NaN;
}
