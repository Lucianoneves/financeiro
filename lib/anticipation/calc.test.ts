import { describe, expect, it } from "vitest";
import { calcAnticipation, daysBetween } from "./calc";

describe("daysBetween", () => {
  it("conta dias corridos", () => {
    expect(daysBetween("2026-10-01", "2026-10-31")).toBe(30);
  });

  it("não retorna negativo para vencimento passado", () => {
    expect(daysBetween("2026-10-10", "2026-10-01")).toBe(0);
  });
});

describe("calcAnticipation", () => {
  it("calcula juros pro rata e líquido", () => {
    // 10.000,00 a 3% a.m. por 30 dias = 300,00 de juros
    const result = calcAnticipation({
      anticipationDate: "2026-10-01",
      monthlyRatePercent: 3,
      feeCents: 5_000,
      receivables: [{ id: "a", faceCents: 1_000_000, dueDate: "2026-10-31" }],
    });
    expect(result.interestCents).toBe(30_000);
    expect(result.grossCents).toBe(1_000_000);
    expect(result.netCents).toBe(1_000_000 - 30_000 - 5_000);
  });

  it("soma vários títulos com arredondamento por título", () => {
    const result = calcAnticipation({
      anticipationDate: "2026-10-01",
      monthlyRatePercent: 2.5,
      feeCents: 0,
      receivables: [
        { id: "a", faceCents: 33_333, dueDate: "2026-10-16" },
        { id: "b", faceCents: 66_667, dueDate: "2026-11-15" },
      ],
    });
    expect(result.interestCents).toBe(result.items.reduce((s, i) => s + i.interestCents, 0));
    expect(result.netCents).toBe(result.grossCents - result.interestCents);
  });

  it("rejeita líquido negativo", () => {
    expect(() =>
      calcAnticipation({
        anticipationDate: "2026-10-01",
        monthlyRatePercent: 3,
        feeCents: 2_000_000,
        receivables: [{ id: "a", faceCents: 1_000_000, dueDate: "2026-10-31" }],
      }),
    ).toThrow("líquido negativo");
  });
});
