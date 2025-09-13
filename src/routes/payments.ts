import { Hono } from "hono";
import { fiatToBTC, generateAddress } from "../utils/bitcoin";
import { db } from "../utils/db";
import { signPayload } from "../utils/hmac";

export const payments = new Hono();

const MEMPOOL_API_BASE =
  process.env.MEMPOOL_API_BASE || "https://mempool.space/api";

type MempoolAddressStats = {
  chain_stats: {
    funded_txo_sum: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_sum: number;
    spent_txo_sum: number;
    tx_count: number;
  };
};

async function fetchAddressStats(
  address: string
): Promise<MempoolAddressStats | null> {
  try {
    const res = await fetch(`${MEMPOOL_API_BASE}/address/${address}`);
    if (!res.ok) return null;
    return (await res.json()) as MempoolAddressStats;
  } catch {
    return null;
  }
}

function satsFromBTC(btc: number | string) {
  const n = typeof btc === "string" ? parseFloat(btc) : btc;
  return Math.round(n * 1e8);
}

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

  return c.json(invoice);
});
