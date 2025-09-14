import { createHmac, timingSafeEqual } from "crypto";

const paidInvoices = new Set<string>();

export function markPaid(id: string) {
  paidInvoices.add(id);
}

export function isPaid(id: string) {
  return paidInvoices.has(id);
}

export function verifyHmac(
  secret: string,
  payload: string,
  signatureHex: string | null | undefined
) {
  try {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signatureHex ?? "", "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function getProcessorBaseUrl() {
  // Point to your Payflux processor backend (Hono server). Defaults to local dev server.
  return process.env.PROCESSOR_BASE_URL || "http://localhost:5173";
}
