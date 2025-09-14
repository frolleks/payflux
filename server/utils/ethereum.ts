import { db } from "./db";
import { HDNodeWallet } from "ethers";

export async function fiatToETH(fiat: number): Promise<number> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
  );
  const data = (await res.json()) as { ethereum: { usd: number } };
  const price = data.ethereum.usd;
  return fiat / price;
}

export async function generateETHAddress(): Promise<string> {
  const counterKey = ["ethIndex"];

  await db.open("database.db");

  const raw = await db.get(counterKey);
  let index = parseInt(String(raw?.data ?? "0"), 10);

  const phrase = process.env.MNEMONIC!;
  if (!phrase) throw new Error("MNEMONIC environment variable is not set");

  const path = `m/44'/60'/0'/0/${index}`;
  const hdNode = HDNodeWallet.fromPhrase(phrase, path);
  const address = hdNode.address;

  index += 1;
  await db.set(counterKey, String(index));

  return address;
}

export async function fetchAddressStatsETH(
  address: string
): Promise<{ confirmed: number; unconfirmed: number } | null> {
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
    return { confirmed: balance, unconfirmed: 0 }; // Ethereum doesn't have unconfirmed balance in the same way as Bitcoin
  } catch (error) {
    return null;
  }
}
