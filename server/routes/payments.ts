import { Hono } from "hono";
import {
  fetchAddressStats,
  fiatToBTC,
  generateAddress,
  satsFromBTC,
} from "../utils/bitcoin";
import { fetchAddressStatsETH } from "../utils/ethereum";
import { db } from "../utils/db";
import { signPayload } from "../utils/hmac";
import { fiatToETH, generateETHAddress } from "../utils/ethereum";
import { parseUnits } from "ethers";

export const payments = new Hono();

/**
 * POST /payments
 * Create a new payment invoice
 * body: { amount: number, chain: string, callbackUrl: string }
 * amount in USD, chain is the cryptocurrency used, callbackUrl is where to send webhook when paid
 *
 * response: { paymentUrl: string }
 */

payments.post("/", async (c) => {
  const { amount, chain, callbackUrl } = await c.req.json();

  await db.open("database.db");

  if (chain === "btc") {
    const address = await generateAddress(); // stubbed for now
    const id = crypto.randomUUID();
    const btcAmount = await fiatToBTC(amount);

    const invoice = {
      id,
      address,
      amount: btcAmount,
      chain,
      callbackUrl,
      status: "pending",
    };

    await db.set(["invoice", id], JSON.stringify(invoice));

    return c.json({
      paymentUrl: `/pay/${id}`,
    });
  } else if (chain === "eth") {
    const address = await generateETHAddress();
    const id = crypto.randomUUID();
    const ethAmount = await fiatToETH(amount);
    const invoice = {
      id,
      address,
      amount: ethAmount.toFixed(18),
      chain,
      callbackUrl,
      status: "pending",
    };
    await db.set(["invoice", id], JSON.stringify(invoice));

    return c.json({
      paymentUrl: `/pay/${id}`,
    });
  }
});

// check payment status
payments.get("/:id", async (c) => {
  const { id } = c.req.param();

  await db.open("database.db");

  const raw = await db.get(["invoice", id]);

  if (!raw) return c.json({ error: "Invoice not found" }, 404);

  const invoice = JSON.parse(raw.data as any);

  // Check mempool.space for BTC payments and update status
  if (invoice.chain === "btc" && invoice.address) {
    const stats = await fetchAddressStats(invoice.address);
    if (stats) {
      const confirmed =
        stats.chain_stats.funded_txo_sum - stats.chain_stats.spent_txo_sum;
      const unconfirmed =
        stats.mempool_stats.funded_txo_sum - stats.mempool_stats.spent_txo_sum;
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
        invoice.status = newStatus;
        invoice.confirmedSats = confirmed;
        invoice.unconfirmedSats = unconfirmed;

        await db.set(["invoice", id], JSON.stringify(invoice));

        // Optional: fire webhook when paid (best-effort)
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
        invoice.status = newStatus;
        invoice.confirmedWei = confirmedWei.toString();
        invoice.unconfirmedWei = "0";

        await db.set(["invoice", id], JSON.stringify(invoice));

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
  return c.json(invoice);
});
