import type {
  AnticipatedReceivableRecord,
  AnticipationRecord,
  AnticipationRepository,
} from "./repository";

export function createMemoryRepository(): AnticipationRepository & {
  logs: { idempotencyKey: string; ok: boolean }[];
} {
  const anticipations = new Map<string, AnticipationRecord>();
  const items: AnticipatedReceivableRecord[] = [];
  const logs: { idempotencyKey: string; ok: boolean }[] = [];
  let seq = 0;

  return {
    logs,
    async findAnticipatedIds(ids) {
      return items.filter((i) => ids.includes(i.erpReceivableId)).map((i) => i.erpReceivableId);
    },
    async create(data, newItems) {
      const record: AnticipationRecord = {
        ...data,
        id: `ant-${++seq}`,
        status: "draft",
        erpEntryIds: {},
        lastError: null,
      };
      anticipations.set(record.id, record);
      for (const item of newItems) {
        items.push({ ...item, anticipationId: record.id, status: "anticipated", settledAt: null });
      }
      return { ...record };
    },
    async get(id) {
      const record = anticipations.get(id);
      return record ? { ...record, erpEntryIds: { ...record.erpEntryIds } } : null;
    },
    async update(id, patch) {
      const record = anticipations.get(id);
      if (!record) throw new Error(`Antecipação não encontrada: ${id}`);
      anticipations.set(id, { ...record, ...patch });
    },
    async listItems(anticipationId) {
      return items.filter((i) => i.anticipationId === anticipationId).map((i) => ({ ...i }));
    },
    async listByStatus(status) {
      return items.filter((i) => i.status === status).map((i) => ({ ...i }));
    },
    async markItemSettled(erpReceivableId, settledAt) {
      const item = items.find((i) => i.erpReceivableId === erpReceivableId);
      if (item) Object.assign(item, { status: "settled", settledAt });
    },
    async markItemDefaulted(erpReceivableId) {
      const item = items.find((i) => i.erpReceivableId === erpReceivableId);
      if (item) item.status = "defaulted";
    },
    async logSync(entry) {
      logs.push({ idempotencyKey: entry.idempotencyKey, ok: entry.ok });
    },
  };
}
