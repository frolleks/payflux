import { NextRequest, NextResponse } from "next/server";
import { isPaid } from "@/lib/paywallStore";
import { payflux } from "@/lib/payflux";

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

  const invoice = await payflux.invoices.retrieve(id);
  // Pass-through essential fields. Processor returns full invoice object.
  if (invoice.success) {
    return NextResponse.json({
      id: invoice.id ?? id,
      status: invoice.status ?? "pending",
      amount: invoice.amount,
      address: invoice.address,
      confirmedSats: invoice.confirmedSats,
      unconfirmedSats: invoice.unconfirmedSats,
      chain: invoice.chain,
    });
  }
}
