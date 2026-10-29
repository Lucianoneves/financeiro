export type ErpReceivable = {
  id: string;
  customer: string;
  documentNumber: string;
  dueDate: string;
  faceCents: number;
  status: "open" | "settled";
  settledAt?: string;
};

export type ErpEntryInput = {
  /** Chave de idempotência: repetir a mesma chave nunca duplica o lançamento. */
  idempotencyKey: string;
  bankAccountRef: string;
  date: string;
  amountCents: number;
  description: string;
};

export type ErpSettleInput = {
  idempotencyKey: string;
  receivableId: string;
  date: string;
  /** Conta transitória de antecipação: a baixa não pode gerar nova entrada no banco. */
  transitoryAccountRef: string;
};

export interface ErpClient {
  listOpenReceivables(): Promise<ErpReceivable[]>;
  getReceivable(id: string): Promise<ErpReceivable | null>;
  createBankEntry(input: ErpEntryInput): Promise<{ entryId: string }>;
  createExpense(input: ErpEntryInput): Promise<{ entryId: string }>;
  settleReceivable(input: ErpSettleInput): Promise<void>;
  listSettledReceivables(since: string): Promise<ErpReceivable[]>;
}
