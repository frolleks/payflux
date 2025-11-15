import { eq } from "drizzle-orm";
import { parseUnits } from "ethers";
import { fetchAddressStats, satsFromBTC } from "./bitcoin";
import { db } from "../db";
import { invoiceTable } from "../db/schema";
import { fetchAddressStatsETH } from "./ethereum";
import { signPayload } from "./hmac";

export async function retrieveInvoice(invoice: any, id: string) {
  try {
    if (invoice.chain === "btc" && invoice.address) {
      const stats = await fetchAddressStats(invoice.address);
      if (stats) {
        const confirmed =
          stats.chain_stats.funded_txo_sum - stats.chain_stats.spent_txo_sum;
        const unconfirmed =
          stats.mempool_stats.funded_txo_sum -
          stats.mempool_stats.spent_txo_sum;
        const required = satsFromBTC(invoice.amount);

        let newStatus = invoice.status || "pending";
        if (confirmed >= required) newStatus = "paid";
        else if (confirmed + unconfirmed >= required) newStatus = "unconfirmed";
        else newStatus = "pending";

        if (
          newStatus !== invoice.status ||
          invoice.confirmedSats !== confirmed ||
          invoice.unconfirmedSats !== unconfirmed
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

          if (newStatus === "paid" && invoice.callbackUrl) {
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

            fetch(invoice.callbackUrl, {
              method: "POST",
              headers,
              body: payload,
            }).catch(() => {});
          }
        }
      }
    }

    if (invoice.chain === "eth" && invoice.address) {
      const stats = await fetchAddressStatsETH(invoice.address);
      if (stats) {
        const confirmedWei = BigInt(stats.confirmed);
        const requiredWei = parseUnits(invoice.amount, "ether");
        let newStatus = invoice.status || "pending";
        if (confirmedWei >= requiredWei) newStatus = "paid";

        if (newStatus !== invoice.status) {
          const now = Math.floor(Date.now() / 1000);
          await db
            .update(invoiceTable)
            .set({
              status: newStatus,
              confirmedWei: confirmedWei.toString(),
              updatedAt: now,
            })
            .where(eq(invoiceTable.id, id));

          if (newStatus === "paid" && invoice.callbackUrl) {
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
            fetch(invoice.callbackUrl, {
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

    return fresh;
  } catch (error) {
    return { error };
  }
}
