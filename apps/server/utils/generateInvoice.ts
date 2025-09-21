import { generateAddress, fiatToBTC } from "./bitcoin";
import { db } from "./db";
import { invoiceTable } from "./db/schema";
import { fiatToETH, generateETHAddress } from "./ethereum";

export async function generateInvoice(
  amount: number,
  chain: "btc" | "eth",
  callbackUrl: string
) {
  try {
    if (chain === "btc") {
      const address = await generateAddress();
      const id = crypto.randomUUID();
      const btcAmount = await fiatToBTC(amount);

      const now = Math.floor(Date.now() / 1000);

      const invoice = {
        id,
        address,
        amount: btcAmount.toString(),
        chain,
        callbackUrl,
        status: "pending",
        confirmedSats: 0,
        unconfirmedSats: 0,
        confirmedWei: "0",
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(invoiceTable).values(invoice);

      return { success: true, ...invoice };
    } else if (chain === "eth") {
      const address = await generateETHAddress();
      const id = crypto.randomUUID();
      const ethAmount = await fiatToETH(amount);
      const now = Math.floor(Date.now() / 1000);

      const invoice = {
        id,
        address,
        amount: ethAmount.toFixed(18),
        chain,
        callbackUrl,
        status: "pending",
        confirmedSats: 0,
        unconfirmedSats: 0,
        confirmedWei: "0",
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(invoiceTable).values(invoice);

      return { success: true, ...invoice };
    }
  } catch (error) {
    return { success: false, error };
  }
}
