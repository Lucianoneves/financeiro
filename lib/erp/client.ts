import "server-only";
import { createMockErpClient } from "./mock";
import type { ErpClient } from "./types";

const globalForErp = globalThis as unknown as { mockErp?: ErpClient };

/** Até o ERP ser definido, só o mock existe — e ele é bloqueado em produção. */
export function getErpClient(): ErpClient {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Conector do ERP não implementado: defina o ERP antes de ir para produção");
  }
  globalForErp.mockErp ??= createMockErpClient([
    { id: "r1", customer: "Cliente A", documentNumber: "NF-1001", dueDate: "2026-11-30", faceCents: 1_500_000, status: "open" },
    { id: "r2", customer: "Cliente B", documentNumber: "NF-1002", dueDate: "2026-12-15", faceCents: 820_000, status: "open" },
    { id: "r3", customer: "Cliente C", documentNumber: "NF-1003", dueDate: "2026-12-28", faceCents: 430_050, status: "open" },
  ]);
  return globalForErp.mockErp;
}
