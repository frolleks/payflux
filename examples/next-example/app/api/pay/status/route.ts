import { NextRequest, NextResponse } from "next/server";
import { getProcessorBaseUrl, isPaid } from "@/lib/paywallStore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  // If webhook has already marked it paid locally, short-circuit.
  if (isPaid(id)) {
    return NextResponse.json({ id, status: "paid" });
  }

  const processorBase = getProcessorBaseUrl();

  const res = await fetch(
    `${processorBase}/api/payments/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "processor_error", detail: text || res.statusText },
      { status: 502 }
    );
  }

  const data = await res.json();
  // Pass-through essential fields. Processor returns full invoice object.
  return NextResponse.json({
    id: data.id ?? id,
    status: data.status ?? "pending",
    amount: data.amount,
    address: data.address,
    confirmedSats: data.confirmedSats,
    unconfirmedSats: data.unconfirmedSats,
    chain: data.chain,
  });
}
