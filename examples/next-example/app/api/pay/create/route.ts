import { NextRequest, NextResponse } from "next/server";
import { getProcessorBaseUrl } from "@/lib/paywallStore";

import { Payflux } from "@payflux/server";

function buildAppBaseUrl(req: NextRequest) {
  const envBase = process.env.APP_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/, "");
  const host = req.headers.get("host") ?? "localhost:3001";
  const scheme = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${scheme}://${host}`;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const appBase = buildAppBaseUrl(req);
  const processorBase = getProcessorBaseUrl();
  const payflux = new Payflux(processorBase);

  const amount = Number(body?.amount ?? 1); // USD
  const chain = body?.chain ?? "btc";

  const callbackUrl = `${appBase}/api/pay/webhook`;

  const invoice = await payflux.invoices.create(amount, chain, callbackUrl);

  if (invoice.success) {
    const paymentUrl = new URL(invoice.paymentUrl, processorBase).toString();
    const id = invoice.id;

    return NextResponse.json({ id, paymentUrl });
  }
}
