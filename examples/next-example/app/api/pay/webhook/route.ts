import { NextRequest, NextResponse } from "next/server";
import { markPaid, verifyHmac } from "@/lib/paywallStore";

export async function POST(req: NextRequest) {
  // Read raw body for HMAC verification
  const raw = await req.text();

  const signature = req.headers.get("x-payflux-signature");
  const alg = req.headers.get("x-payflux-signature-alg") ?? "sha256";
  const secret = process.env.WEBHOOK_SECRET;

  // If secret configured, require valid signature
  if (secret) {
    if (alg !== "sha256" || !verifyHmac(secret, raw, signature)) {
      return NextResponse.json(
        { ok: false, error: "invalid signature" },
        { status: 401 }
      );
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json" },
      { status: 400 }
    );
  }

  const { id, status } = parsed ?? {};
  if (id && status === "paid") {
    markPaid(id);
  }

  return NextResponse.json({ ok: true });
}
