import { beforeEach, describe, expect, it } from "vitest";
import { createMockErpClient } from "@/lib/erp/mock";
import type { ErpReceivable } from "@/lib/erp/types";
import { createMemoryRepository } from "./memory-repository";
import { createAnticipation, postAnticipation, runSettlementCheck } from "./service";

const seed: ErpReceivable[] = [
  { id: "r1", customer: "Cliente A", documentNumber: "001", dueDate: "2026-10-31", faceCents: 1_000_000, status: "open" },
  { id: "r2", customer: "Cliente B", documentNumber: "002", dueDate: "2026-11-15", faceCents: 500_000, status: "open" },
];

const input = {
  receivableIds: ["r1", "r2"],
  bankAccountRef: "banco-1",
  anticipationDate: "2026-10-01",
  monthlyRatePercent: 3,
  feeCents: 5_000,
};

let erp: ReturnType<typeof createMockErpClient>;
let repo: ReturnType<typeof createMemoryRepository>;

beforeEach(() => {
  erp = createMockErpClient(seed);
  repo = createMemoryRepository();
});

describe("createAnticipation", () => {
  it("lança líquido, juros e tarifa no ERP", async () => {
    const result = await createAnticipation({ erp, repo }, input);
    expect(result.status).toBe("posted");
    expect(erp.state.entries.size).toBe(3);
    const bank = erp.state.entries.get(`${result.id}:bank`);
    expect(bank?.input.amountCents).toBe(result.netCents);
  });

  it("não permite antecipar o mesmo título duas vezes", async () => {
    await createAnticipation({ erp, repo }, input);
    await expect(createAnticipation({ erp, repo }, input)).rejects.toThrow("já antecipados");
  });

  it("rejeita título inexistente ou já liquidado no ERP", async () => {
    await expect(
      createAnticipation({ erp, repo }, { ...input, receivableIds: ["nope"] }),
    ).rejects.toThrow("não encontrado");
    erp.markPaid("r1", "2026-10-05");
    await expect(createAnticipation({ erp, repo }, input)).rejects.toThrow("não está em aberto");
  });

  it("repete após falha sem duplicar lançamentos", async () => {
    const original = erp.createExpense.bind(erp);
    let calls = 0;
    erp.createExpense = async (i) => {
      if (++calls === 1) throw new Error("ERP fora do ar");
      return original(i);
    };

    await expect(createAnticipation({ erp, repo }, input)).rejects.toThrow("ERP fora do ar");
    const failed = await repo.get("ant-1");
    expect(failed?.status).toBe("failed");
    expect(erp.state.entries.size).toBe(1); // só o banco foi lançado

    const retried = await postAnticipation({ erp, repo }, "ant-1");
    expect(retried.status).toBe("posted");
    expect(erp.state.entries.size).toBe(3);
  });
});

describe("runSettlementCheck", () => {
  it("espelha liquidação do ERP e fecha a antecipação", async () => {
    const created = await createAnticipation({ erp, repo }, input);
    erp.markPaid("r1", "2026-10-31");

    const partial = await runSettlementCheck({ erp, repo }, "2026-11-01");
    expect(partial.settled).toBe(1);
    expect((await repo.get(created.id))?.status).toBe("partially_settled");

    erp.markPaid("r2", "2026-11-15");
    await runSettlementCheck({ erp, repo }, "2026-11-16");
    expect((await repo.get(created.id))?.status).toBe("settled");
  });

  it("marca como inadimplente após a carência", async () => {
    await createAnticipation({ erp, repo }, input);
    const summary = await runSettlementCheck({ erp, repo }, "2026-11-10");
    expect(summary.defaulted).toBe(1); // r1 venceu em 31/10, r2 ainda não
    expect((await repo.listByStatus("defaulted"))[0]?.erpReceivableId).toBe("r1");
  });
});
