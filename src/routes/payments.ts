import { Hono } from "hono";
import { fiatToBTC, generateAddress } from "../utils/bitcoin";
import { db } from "../utils/db";

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

  const invoice = await db.get(["invoice", id]);

  if (invoice) return c.json(JSON.parse(invoice.data as any));
  else return c.json({ error: "Invoice not found" }, 404);
});
