import type {
  ErpClient,
  ErpEntryInput,
  ErpReceivable,
  ErpSettleInput,
} from "./types";

type MockState = {
  receivables: Map<string, ErpReceivable>;
  entries: Map<string, { kind: "bank" | "expense"; input: ErpEntryInput }>;
  settledKeys: Set<string>;
};

export function createMockErpClient(seed: ErpReceivable[] = []): ErpClient & {
  state: MockState;
  /** Simula o banco liquidando o boleto e o ERP refletindo a conciliação. */
  markPaid(id: string, settledAt: string): void;
} {
  const state: MockState = {
    receivables: new Map(seed.map((r) => [r.id, { ...r }])),
    entries: new Map(),
    settledKeys: new Set(),
  };

  function createEntry(kind: "bank" | "expense", input: ErpEntryInput) {
    const existing = state.entries.get(input.idempotencyKey);
    if (existing) return { entryId: input.idempotencyKey };
    state.entries.set(input.idempotencyKey, { kind, input });
    return { entryId: input.idempotencyKey };
  }

  return {
    state,
    async listOpenReceivables() {
      return [...state.receivables.values()].filter((r) => r.status === "open");
    },
    async getReceivable(id) {
      return state.receivables.get(id) ?? null;
    },
    async createBankEntry(input) {
      return createEntry("bank", input);
    },
    async createExpense(input) {
      return createEntry("expense", input);
    },
    async settleReceivable(input: ErpSettleInput) {
      if (state.settledKeys.has(input.idempotencyKey)) return;
      const receivable = state.receivables.get(input.receivableId);
      if (!receivable) throw new Error(`Título não encontrado: ${input.receivableId}`);
      state.settledKeys.add(input.idempotencyKey);
      receivable.status = "settled";
      receivable.settledAt = input.date;
    },
    async listSettledReceivables(since) {
      return [...state.receivables.values()].filter(
        (r) => r.status === "settled" && r.settledAt !== undefined && r.settledAt >= since,
      );
    },
    markPaid(id, settledAt) {
      const receivable = state.receivables.get(id);
      if (!receivable) throw new Error(`Título não encontrado: ${id}`);
      receivable.status = "settled";
      receivable.settledAt = settledAt;
    },
  };
}
