export type AnticipationStatus =
  | "draft"
  | "posted"
  | "partially_settled"
  | "settled"
  | "failed";

export type AnticipationRecord = {
  id: string;
  bankAccountRef: string;
  anticipationDate: string;
  monthlyRatePercent: number;
  grossCents: number;
  interestCents: number;
  feeCents: number;
  netCents: number;
  status: AnticipationStatus;
  erpEntryIds: Record<string, string>;
  lastError: string | null;
};

export type AnticipatedReceivableRecord = {
  anticipationId: string;
  erpReceivableId: string;
  customer: string;
  documentNumber: string;
  dueDate: string;
  faceCents: number;
  interestCents: number;
  status: "anticipated" | "settled" | "defaulted";
  settledAt: string | null;
};

export type NewAnticipation = Omit<
  AnticipationRecord,
  "id" | "status" | "erpEntryIds" | "lastError"
>;

export interface AnticipationRepository {
  /** Retorna quais desses títulos do ERP já foram antecipados. */
  findAnticipatedIds(erpReceivableIds: string[]): Promise<string[]>;
  create(
    data: NewAnticipation,
    items: Omit<AnticipatedReceivableRecord, "anticipationId" | "status" | "settledAt">[],
  ): Promise<AnticipationRecord>;
  get(id: string): Promise<AnticipationRecord | null>;
  update(
    id: string,
    patch: Partial<Pick<AnticipationRecord, "status" | "erpEntryIds" | "lastError">>,
  ): Promise<void>;
  listItems(anticipationId: string): Promise<AnticipatedReceivableRecord[]>;
  listByStatus(
    status: AnticipatedReceivableRecord["status"],
  ): Promise<AnticipatedReceivableRecord[]>;
  markItemSettled(erpReceivableId: string, settledAt: string): Promise<void>;
  markItemDefaulted(erpReceivableId: string): Promise<void>;
  logSync(entry: {
    idempotencyKey: string;
    operation: string;
    payload: unknown;
    ok: boolean;
    error?: string;
  }): Promise<void>;
}
