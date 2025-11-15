import { db } from "../db";
import { invoiceTable } from "../db/schema";
import { eq } from "drizzle-orm";
import { generateInvoice } from "../utils/generateInvoice";
import { retrieveInvoice } from "../utils/retrieveInvoice";
import type { BunRequest } from "bun";
import { JsonRpcProvider, parseUnits } from "ethers";
import { signPayload } from "../utils/hmac";

type InvoiceRecord = typeof invoiceTable.$inferSelect;

/**
 * POST /payments
 * Create a new payment invoice
 * body: { amount: number, chain: string, callbackUrl: string }
 * amount in USD, chain is the cryptocurrency used, callbackUrl is where to send webhook when paid
 *
 * response: { id: string, paymentUrl: string }
 */

export const createNewPayment = async (
  req: BunRequest<"/api/payments">
): Promise<Response> => {
  const { amount, callbackUrl } = await req.json();

  try {
    const invoice = await generateInvoice(amount, callbackUrl);

    if (invoice && "id" in invoice) {
      return Response.json({
        id: invoice.id,
        paymentUrl: `/pay/${invoice.id}`,
      });
    }

    if (!invoice) {
      return Response.json(
        { error: "Failed to generate invoice" },
        { status: 404 }
      );
    }

    if ("error" in invoice) {
      const message =
        invoice.error instanceof Error
          ? invoice.error.message
          : typeof invoice.error === "string"
          ? invoice.error
          : "Failed to generate invoice";

      return Response.json({ error: message }, { status: 500 });
    }

    return Response.json(
      { error: "Unexpected invoice response" },
      { status: 500 }
    );
  } catch (error) {
    return Response.json(
      {
        error: "An error occured from the server.",
      },
      { status: 500 }
    );
  }
};

/**
 * GET /payments/:id
 * Gets current payment status of a certain invoice
 * response: { id: string, address: string, chain: string, callbackUrl: string, status: "paid" | "unconfirmed" | "pending" }
 */

export const getPayment = async (req: BunRequest<"/api/payments/:id">) => {
  const { id } = req.params;
  const url = new URL(req.url, "http://localhost");
  const txHashParam = url.searchParams.get("txHash")?.trim();
  const txHash =
    txHashParam && txHashParam.length > 0
      ? txHashParam.startsWith("0x") || txHashParam.startsWith("0X")
        ? `0x${txHashParam.slice(2)}`
        : `0x${txHashParam}`
      : undefined;

  const [selectedInvoice] = await db
    .select()
    .from(invoiceTable)
    .where(eq(invoiceTable.id, id));

  if (!selectedInvoice)
    return Response.json(
      { error: "Invoice not found" },
      {
        status: 404,
      }
    );

  if (selectedInvoice.chain === "eth") {
    if (txHash) {
      const verified = await verifyEthereumTransaction(selectedInvoice, txHash);
      return Response.json(verified ?? selectedInvoice);
    }

    return Response.json(selectedInvoice);
  }

  const invoice = await retrieveInvoice(selectedInvoice, id);

  return Response.json(invoice);
};

async function verifyEthereumTransaction(
  invoice: InvoiceRecord,
  txHash: string
): Promise<InvoiceRecord | null> {
  if (!txHash || invoice.status === "paid") return invoice;

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) return null;

  try {
    const provider = new JsonRpcProvider(rpcUrl);
    const transaction = await provider.getTransaction(txHash);
    if (!transaction || !transaction.to) return null;

    const destination = transaction.to.toLowerCase();
    const invoiceAddress = invoice.address.toLowerCase();
    if (destination !== invoiceAddress) return null;

    const requiredWei = parseUnits(invoice.amount, "ether");
    if (transaction.value < requiredWei) return null;

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) return null;

    const now = Math.floor(Date.now() / 1000);
    if (invoice.status !== "paid") {
      await db
        .update(invoiceTable)
        .set({
          status: "paid",
          confirmedWei: transaction.value.toString(),
          updatedAt: now,
        })
        .where(eq(invoiceTable.id, invoice.id));

      if (invoice.callbackUrl) {
        sendInvoicePaidWebhook(invoice.id, invoice.callbackUrl);
      }
    }

    const [fresh] = await db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, invoice.id));

    return fresh ?? invoice;
  } catch (error) {
    return null;
  }
}

function sendInvoicePaidWebhook(id: string, callbackUrl: string) {
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

  fetch(callbackUrl, {
    method: "POST",
    headers,
    body: payload,
  }).catch(() => {});
}
