import { z } from "zod";

export const createAnticipationSchema = z.object({
  receivableIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um título"),
  bankAccountRef: z.string().min(1, "Informe a conta bancária"),
  anticipationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  monthlyRatePercent: z.number().min(0, "Taxa inválida").max(100, "Taxa inválida"),
  feeCents: z.number().int().min(0, "Tarifa inválida"),
});

export type CreateAnticipationValues = z.infer<typeof createAnticipationSchema>;

export type ActionResult = { ok: true; anticipationId: string } | { ok: false; error: string };
