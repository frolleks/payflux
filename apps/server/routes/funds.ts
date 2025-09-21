import {
  HDNodeWallet,
  JsonRpcProvider,
  getDefaultProvider,
  formatEther,
} from "ethers";
import { Hono } from "hono";
import { db } from "../utils/db";
import { kvTable } from "../utils/db/schema";
import { eq } from "drizzle-orm";

export const funds = new Hono();

funds.get("/total", async (c) => {
  const phrase = process.env.MNEMONIC;
  if (!phrase) return c.json({ error: "MNEMONIC not set" }, 500);

  // RPC URL from env or default to Ethers.js fallback
  const rpc = process.env.RPC_URL;
  const provider = new JsonRpcProvider(rpc);

  // Read how many ETH-derived addresses we've allocated (ethIndex)
  const [row] = await db
    .select()
    .from(kvTable)
    .where(eq(kvTable.key, "ethIndex"));
  let maxIndex = 0;
  if (row && row.value) maxIndex = parseInt(row.value, 10) || 0;

  const results: Array<{ index: number; address: string; balanceWei: string }> =
    [];
  let total = BigInt(0);

  for (let i = 0; i < maxIndex; i++) {
    const path = `m/44'/60'/0'/0/${i}`;
    const hd = HDNodeWallet.fromPhrase(phrase, path);
    const address = hd.address;
    try {
      const balance = await provider.getBalance(address); // bigint in ethers v6
      results.push({ index: i, address, balanceWei: balance.toString() });
      total = total + BigInt(balance.toString());
    } catch (err) {
      // continue on RPC errors but include zero balance
      results.push({ index: i, address, balanceWei: "0" });
    }
  }

  return c.json({
    totalWei: total.toString(),
    totalEther: formatEther(total),
    wallets: results,
  });
});
