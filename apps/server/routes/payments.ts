import { Hono } from "hono";
import { fetchAddressStats, satsFromBTC } from "../utils/bitcoin";
import { fetchAddressStatsETH } from "../utils/ethereum";
import { db } from "../utils/db";
import { signPayload } from "../utils/hmac";
import { parseUnits } from "ethers";
import { invoiceTable } from "../utils/db/schema";
import { eq } from "drizzle-orm";
import { generateInvoice } from "../utils/generateInvoice";

export const payments = new Hono();

/**
 * POST /payments
 * Create a new payment invoice
 * body: { amount: number, chain: string, callbackUrl: string }
 * amount in USD, chain is the cryptocurrency used, callbackUrl is where to send webhook when paid
 *
 * response: { id: string, paymentUrl: string }
 */

payments.post("/", async (c) => {
  const { amount, chain, callbackUrl } = await c.req.json();

  try {
    const invoice = await generateInvoice(amount, chain, callbackUrl);

    if (invoice && invoice.success && "id" in invoice) {
      return c.json({
        id: invoice.id,
        paymentUrl: `/pay/${invoice.id}`,
      });
    }

    if (!invoice || !invoice.success) {
      return c.json(
        { error: (invoice as any)?.error ?? "Failed to generate invoice" },
        400
      );
    }
  } catch (error) {
    return c.json({
      error,
    });
  }
});

/**
 * GET /payments/:id
 * Gets current payment status of a certain invoice
 * response: { id: string, address: string, chain: string, callbackUrl: string, status: "paid" | "unconfirmed" | "pending" }
 */

payments.get("/:id", async (c) => {
  const id = c.req.param("id");

  const [selectedInvoice] = await db
    .select()
    .from(invoiceTable)
    .where(eq(invoiceTable.id, id));

  if (!selectedInvoice) return c.json({ error: "Invoice not found" }, 404);

  if (selectedInvoice.chain === "btc" && selectedInvoice.address) {
    const stats = await fetchAddressStats(selectedInvoice.address);
    if (stats) {
      const confirmed =
        stats.chain_stats.funded_txo_sum - stats.chain_stats.spent_txo_sum;
      const unconfirmed =
        stats.mempool_stats.funded_txo_sum - stats.mempool_stats.spent_txo_sum;
      const required = satsFromBTC(selectedInvoice.amount);

      let newStatus = selectedInvoice.status || "pending";
      if (confirmed >= required) newStatus = "paid";
      else if (confirmed + unconfirmed >= required) newStatus = "unconfirmed";
      else newStatus = "pending";

      if (
        newStatus !== selectedInvoice.status ||
        selectedInvoice.confirmedSats !== confirmed ||
        selectedInvoice.unconfirmedSats !== unconfirmed
      ) {
        const now = Math.floor(Date.now() / 1000);
        await db
          .update(invoiceTable)
          .set({
            status: newStatus,
            confirmedSats: confirmed,
            unconfirmedSats: unconfirmed,
            updatedAt: now,
          })
          .where(eq(invoiceTable.id, id));

        if (newStatus === "paid" && selectedInvoice.callbackUrl) {
          const payload = JSON.stringify({ id, status: "paid" });

          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          const secret = process.env.WEBHOOK_SECRET;

          if (secret) {
            try {
              const signature = signPayload(secret, payload);
              headers["X-Payflux-Signature"] = signature;
              headers["X-Payflux-Signature-Alg"] = "sha256";
            } catch {}
          }

          fetch(selectedInvoice.callbackUrl, {
            method: "POST",
            headers,
            body: payload,
          }).catch(() => {});
        }
      }
    }
  }

  if (selectedInvoice.chain === "eth" && selectedInvoice.address) {
    const stats = await fetchAddressStatsETH(selectedInvoice.address);
    if (stats) {
      const confirmedWei = BigInt(stats.confirmed);
      const requiredWei = parseUnits(selectedInvoice.amount, "ether");
      let newStatus = selectedInvoice.status || "pending";
      if (confirmedWei >= requiredWei) newStatus = "paid";

      if (newStatus !== selectedInvoice.status) {
        const now = Math.floor(Date.now() / 1000);
        await db
          .update(invoiceTable)
          .set({
            status: newStatus,
            confirmedWei: confirmedWei.toString(),
            updatedAt: now,
          })
          .where(eq(invoiceTable.id, id));

        if (newStatus === "paid" && selectedInvoice.callbackUrl) {
          const payload = JSON.stringify({ id, status: "paid" });
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          const secret = process.env.WEBHOOK_SECRET;
          if (secret) {
            try {
              const signature = signPayload(secret, payload);
              headers["X-Payflux-Signature"] = signature;
              headers["X-Payflux-Signature-Alg"] = "sha256";
            } catch {}
          }
          fetch(selectedInvoice.callbackUrl, {
            method: "POST",
            headers,
            body: payload,
          }).catch(() => {});
        }
      }
    }
  }
  // re-query to return the latest row
  const [fresh] = await db
    .select()
    .from(invoiceTable)
    .where(eq(invoiceTable.id, id));

  return c.json(fresh);
});
