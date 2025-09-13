import { NextRequest, NextResponse } from "next/server";
import { getProcessorBaseUrl } from "@/lib/paywallStore";

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

  const amount = Number(body?.amount ?? 1); // USD
  const chain = (body?.chain ?? "btc") as string;

  const appBase = buildAppBaseUrl(req);
  const processorBase = getProcessorBaseUrl();

  const callbackUrl = `${appBase}/api/pay/webhook`;

  const res = await fetch(`${processorBase}/api/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      chain,
      callbackUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "processor_error", detail: text || res.statusText },
      { status: 502 }
    );
  }

  const data = (await res.json()) as { paymentUrl: string };
  const paymentUrl = new URL(data.paymentUrl, processorBase).toString();

  // Extract invoice id from /pay/:id path part
  const id = data.paymentUrl.split("/").filter(Boolean).pop();

  return NextResponse.json({ id, paymentUrl });
}
