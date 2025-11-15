import { JsonRpcProvider } from "ethers";
import { db } from "../db";
import { invoiceTable } from "../db/schema";
import { fiatToETH, generateETHWallet } from "./ethereum";

export async function generateInvoice(amount: number, callbackUrl: string) {
  try {
    const wallet = await generateETHWallet();
    const id = crypto.randomUUID();
    const ethAmount = await fiatToETH(amount);
    const now = Math.floor(Date.now() / 1000);
    const provider = new JsonRpcProvider(process.env.RPC_URL);
    const nonce = await provider.getTransactionCount(wallet.address, "latest");

    const invoice = {
      id,
      address: wallet.address,
      amount: ethAmount.toFixed(18),
      chain: "eth",
      callbackUrl,
      status: "pending",
      confirmedSats: 0,
      unconfirmedSats: 0,
      confirmedWei: "0",
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(invoiceTable).values(invoice);

    return invoice;
  } catch (error) {
    return { error };
  }
}
