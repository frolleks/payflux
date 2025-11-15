import { useParams } from "react-router";
import { Button } from "@/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { parseEther, BrowserProvider } from "ethers";
import { useCallback, useEffect, useState } from "react";

const normalizeTxHash = (hash?: string | null) => {
  if (!hash) return "";
  const trimmed = hash.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
    return `0x${trimmed.slice(2)}`;
  }
  return `0x${trimmed}`;
};

type InvoiceStatus = "pending" | "unconfirmed" | "paid";
interface Invoice {
  id: string;
  address: string;
  amount: number | string;
  callbackUrl?: string;
  status: InvoiceStatus | string;
  confirmedSats?: number;
  unconfirmedSats?: number;
}

export default function PayPage() {
  const [txHash, setTxHash] = useState("");
  const [autoPaymentAttempted, setAutoPaymentAttempted] = useState(false);

  const { id } = useParams();
  const {
    data: invoice,
    isLoading,
    isError,
  } = useQuery<Invoice>({
    queryKey: ["invoice", id, txHash || null],
    queryFn: async () => {
      const query = txHash ? `?txHash=${encodeURIComponent(txHash)}` : "";
      const res = await fetch(`/api/payments/${id}${query}`);
      if (res.status === 404) throw new Error("Invoice not found");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data as unknown as Invoice | undefined;
      return data && data.status !== "paid" ? 10000 : false;
    },
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    setTxHash("");
    setAutoPaymentAttempted(false);
  }, [id]);

  const handlePayment = useCallback(async () => {
    try {
      if (!invoice) return;
      if ("phantom" in window) {
        const anyWindow: any = window;
        const provider = new BrowserProvider(anyWindow.phantom?.ethereum);

        if (provider) {
          await provider.send("eth_requestAccounts", []);
          const signer = await provider.getSigner(); // first account

          const tx = await signer.sendTransaction({
            to: invoice.address,
            value: "0x" + parseEther(invoice.amount.toString()).toString(16),
          });

          setTxHash(normalizeTxHash(tx.hash));
        }
      }
    } catch (error) {}
  }, [invoice]);

  useEffect(() => {
    if (!invoice) return;
    if (txHash || autoPaymentAttempted) return;

    setAutoPaymentAttempted(true);
    void handlePayment();
  }, [invoice, txHash, autoPaymentAttempted, handlePayment]);

  if (isLoading) return <p>Loading…</p>;
  if (isError || !invoice) return <p>Invoice not found.</p>;

  const statusClass =
    invoice.status === "paid"
      ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900"
      : invoice.status === "unconfirmed"
      ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900"
      : invoice.status === "pending"
      ? "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-900"
      : "bg-gray-100 text-gray-700 border-gray-200 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700";

  const currencyLabel = "ETH";
  const amountDisplay = invoice.amount.toString();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border shadow-sm bg-white dark:bg-neutral-900 p-6">
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="text-xs uppercase tracking-wider text-gray-500">
            Pay
          </div>
          <div className="font-mono text-2xl md:text-3xl font-semibold tracking-tight text-center">
            {amountDisplay} {currencyLabel}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border p-4 bg-gray-50 dark:bg-neutral-800">
            <div className="text-xs text-gray-500 mb-1">Target address</div>
            <div className="font-mono text-sm break-all">{invoice.address}</div>
          </div>

          {txHash !== "" ? (
            <div className="rounded-xl border p-4 bg-gray-50 dark:bg-neutral-800">
              <div className="text-xs text-gray-500 mb-1">Transaction hash</div>
              <div className="font-mono text-sm break-all">{txHash}</div>
            </div>
          ) : null}

          <div className="rounded-xl border p-4 bg-gray-50 dark:bg-neutral-800 flex items-center justify-between">
            <div className="text-xs text-gray-500">Status</div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs border ${statusClass}`}
            >
              {invoice.status}
            </span>
          </div>

          <Button
            className={`w-full cursor-pointer`}
            disabled={invoice.status === "paid"}
            onClick={handlePayment}
          >
            Pay
          </Button>
        </div>
      </div>
    </div>
  );
}
