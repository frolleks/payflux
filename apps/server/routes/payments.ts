import { Hono } from "hono";
import { db } from "../utils/db";
import { invoiceTable } from "../utils/db/schema";
import { eq } from "drizzle-orm";
import { generateInvoice } from "../utils/generateInvoice";
import { retrieveInvoice } from "../utils/retrieveInvoice";

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

    if (invoice && "id" in invoice) {
      return c.json({
        id: invoice.id,
        paymentUrl: `/pay/${invoice.id}`,
      });
    }

    if (!invoice) {
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

  const invoice = await retrieveInvoice(selectedInvoice, id);

  return c.json(invoice);
});
