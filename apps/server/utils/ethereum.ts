import { db } from "./db";
import { HDNodeWallet } from "ethers";
import { kvTable } from "./db/schema";
import { eq } from "drizzle-orm";
import type { GetCurrentPriceResponse } from "./types";

export async function fiatToETH(fiat: number): Promise<number> {
  const res = await fetch(
    "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT"
  );
  const data = (await res.json()) as GetCurrentPriceResponse;
  const price = data.price;
  return fiat / price;
}

export async function generateETHAddress(): Promise<string> {
  const [row] = await db
    .select()
    .from(kvTable)
    .where(eq(kvTable.key, "ethIndex"));

  let index = 0;
  if (row && row.value) index = parseInt(row.value, 10) || 0;

  const phrase = process.env.MNEMONIC!;
  if (!phrase) throw new Error("MNEMONIC environment variable is not set");

  const path = `m/44'/60'/0'/0/${index}`;
  const hdNode = HDNodeWallet.fromPhrase(phrase, path);
  const address = hdNode.address;

  index += 1;
  const exists = !!row;
  if (exists) {
    await db
      .update(kvTable)
      .set({ value: String(index) })
      .where(eq(kvTable.key, "ethIndex"));
  } else {
    await db.insert(kvTable).values({ key: "ethIndex", value: String(index) });
  }

  return address;
}

export async function fetchAddressStatsETH(
  address: string
): Promise<{ confirmed: number } | null> {
  const API_KEY = process.env.ETHERSCAN_API_KEY;

  try {
    const res = await fetch(
      process.env.NODE_ENV === "production"
        ? `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${API_KEY}`
        : `https://api-sepolia.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${API_KEY}`
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.status !== "1") return null;
    const balance = parseInt(data.result, 10);
    return { confirmed: balance };
  } catch (error) {
    return null;
  }
}
