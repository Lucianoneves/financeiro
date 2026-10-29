import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnticipatedReceivableRecord,
  AnticipationRecord,
  AnticipationRepository,
} from "./repository";

type AnticipationRow = {
  id: string;
  bank_account_ref: string;
  anticipation_date: string;
  monthly_rate_percent: number;
  gross_cents: number;
  interest_cents: number;
  fee_cents: number;
  net_cents: number;
  status: AnticipationRecord["status"];
  erp_entry_ids: Record<string, string>;
  last_error: string | null;
};

type ItemRow = {
  anticipation_id: string;
  erp_receivable_id: string;
  customer: string;
  document_number: string;
  due_date: string;
  face_cents: number;
  interest_cents: number;
  status: AnticipatedReceivableRecord["status"];
  settled_at: string | null;
};

const toAnticipation = (r: AnticipationRow): AnticipationRecord => ({
  id: r.id,
  bankAccountRef: r.bank_account_ref,
  anticipationDate: r.anticipation_date,
  monthlyRatePercent: Number(r.monthly_rate_percent),
  grossCents: Number(r.gross_cents),
  interestCents: Number(r.interest_cents),
  feeCents: Number(r.fee_cents),
  netCents: Number(r.net_cents),
  status: r.status,
  erpEntryIds: r.erp_entry_ids,
  lastError: r.last_error,
});

const toItem = (r: ItemRow): AnticipatedReceivableRecord => ({
  anticipationId: r.anticipation_id,
  erpReceivableId: r.erp_receivable_id,
  customer: r.customer,
  documentNumber: r.document_number,
  dueDate: r.due_date,
  faceCents: Number(r.face_cents),
  interestCents: Number(r.interest_cents),
  status: r.status,
  settledAt: r.settled_at,
});

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export function createSupabaseRepository(db: SupabaseClient): AnticipationRepository {
  return {
    async findAnticipatedIds(ids) {
      const rows = check(
        await db.from("anticipated_receivables").select("erp_receivable_id").in("erp_receivable_id", ids),
      ) as { erp_receivable_id: string }[];
      return rows.map((r) => r.erp_receivable_id);
    },

    async create(data, items) {
      const row = check(
        await db
          .from("anticipations")
          .insert({
            bank_account_ref: data.bankAccountRef,
            anticipation_date: data.anticipationDate,
            monthly_rate_percent: data.monthlyRatePercent,
            gross_cents: data.grossCents,
            interest_cents: data.interestCents,
            fee_cents: data.feeCents,
            net_cents: data.netCents,
          })
          .select()
          .single(),
      ) as AnticipationRow;

      const inserted = await db.from("anticipated_receivables").insert(
        items.map((i) => ({
          anticipation_id: row.id,
          erp_receivable_id: i.erpReceivableId,
          customer: i.customer,
          document_number: i.documentNumber,
          due_date: i.dueDate,
          face_cents: i.faceCents,
          interest_cents: i.interestCents,
        })),
      );
      if (inserted.error) {
        // Sem transação multi-tabela via PostgREST: desfaz o cabeçalho para não deixar operação órfã.
        await db.from("anticipations").delete().eq("id", row.id);
        throw new Error(
          inserted.error.code === "23505"
            ? "Algum título já foi antecipado"
            : inserted.error.message,
        );
      }
      return toAnticipation(row);
    },

    async get(id) {
      const row = check(
        await db.from("anticipations").select().eq("id", id).maybeSingle(),
      ) as AnticipationRow | null;
      return row ? toAnticipation(row) : null;
    },

    async update(id, patch) {
      const values: Record<string, unknown> = {};
      if (patch.status !== undefined) values.status = patch.status;
      if (patch.erpEntryIds !== undefined) values.erp_entry_ids = patch.erpEntryIds;
      if (patch.lastError !== undefined) values.last_error = patch.lastError;
      check(await db.from("anticipations").update(values).eq("id", id));
    },

    async listItems(anticipationId) {
      const rows = check(
        await db.from("anticipated_receivables").select().eq("anticipation_id", anticipationId),
      ) as ItemRow[];
      return rows.map(toItem);
    },

    async listByStatus(status) {
      const rows = check(
        await db.from("anticipated_receivables").select().eq("status", status),
      ) as ItemRow[];
      return rows.map(toItem);
    },

    async markItemSettled(erpReceivableId, settledAt) {
      check(
        await db
          .from("anticipated_receivables")
          .update({ status: "settled", settled_at: settledAt })
          .eq("erp_receivable_id", erpReceivableId),
      );
    },

    async markItemDefaulted(erpReceivableId) {
      check(
        await db
          .from("anticipated_receivables")
          .update({ status: "defaulted" })
          .eq("erp_receivable_id", erpReceivableId),
      );
    },

    async logSync(entry) {
      check(
        await db.from("erp_sync_log").insert({
          idempotency_key: entry.idempotencyKey,
          operation: entry.operation,
          payload: entry.payload,
          ok: entry.ok,
          error: entry.error ?? null,
        }),
      );
    },
  };
}
