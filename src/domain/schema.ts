import { z } from "zod";

// Every input value carries a passport. A value without a source is rejected at load, so nothing
// undocumented reaches the model (CLAUDE.md, "Every value has a passport").

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

export const sourceSchema = z.object({
  title: z.string().min(3),
  publisher: z.string().min(2),
  url: z.url({ protocol: /^https$/ }),
});

export const passportSchema = z
  .object({
    value: z.number().finite(),
    unit: z.string().min(1),
    /** "data": read from the source; "derived": computed from other passports; "assumption":
     * a judgement the source supports but doesn't state, which must say why in the note. */
    method: z.enum(["data", "derived", "assumption"]),
    source: sourceSchema,
    retrieved: isoDate,
    confidence: z.enum(["high", "medium", "low"]),
    low: z.number().finite(),
    high: z.number().finite(),
    note: z.string().optional(),
    /** For derived values: the keys of the passports they were computed from. */
    from: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (!(p.low <= p.value && p.value <= p.high))
      ctx.addIssue({
        code: "custom",
        message: `need low ≤ value ≤ high, got ${p.low}, ${p.value}, ${p.high}`,
      });
    if (p.method === "assumption" && !p.note?.trim())
      ctx.addIssue({ code: "custom", message: "an assumption needs a note saying why" });
    if (p.method === "derived" && !(p.from && p.from.length > 0))
      ctx.addIssue({
        code: "custom",
        message: "a derived value must list what it was derived from",
      });
  });

export type Passport = z.infer<typeof passportSchema>;
