import { useParams } from "react-router-dom";
import { AddressPurpose, request } from "sats-connect";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

export default function PayPage() {
  const { id } = useParams();
  const {
    data: invoice,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const res = await fetch(`/api/payments/${id}`);
      if (res.status === 404) throw new Error("Invoice not found");
      return res.json();
    },
  });

  if (isLoading) return <p>Loading…</p>;
  if (isError || !invoice) return <p>Invoice not found.</p>;

  const statusClass =
    invoice.status === "paid"
      ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900"
      : invoice.status === "pending"
      ? "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-900"
      : "bg-gray-100 text-gray-700 border-gray-200 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border shadow-sm bg-white dark:bg-neutral-900 p-6">
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="text-xs uppercase tracking-wider text-gray-500">
            Pay
          </div>
          <div className="font-mono text-2xl md:text-3xl font-semibold tracking-tight text-center">
            {invoice.amount} BTC
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border p-4 bg-gray-50 dark:bg-neutral-800">
            <div className="text-xs text-gray-500 mb-1">Target address</div>
            <div className="font-mono text-sm break-all">{invoice.address}</div>
          </div>

          <div className="rounded-xl border p-4 bg-gray-50 dark:bg-neutral-800 flex items-center justify-between">
            <div className="text-xs text-gray-500">Status</div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs border ${statusClass}`}
            >
              {invoice.status}
            </span>
          </div>

          {invoice.chain === "btc" && (
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 cursor-pointer"
              disabled={invoice.status === "paid"}
              onClick={async () => {
                await request("getAccounts", {
                  purposes: [
                    AddressPurpose.Payment,
                    AddressPurpose.Ordinals,
                    AddressPurpose.Stacks,
                  ],
                  message: "Cool app wants to know your addresses!",
                });

                await request("sendTransfer", {
                  recipients: [
                    {
                      address: invoice.address,
                      amount: Math.round(parseFloat(invoice.amount) * 1e8),
                    },
                  ],
                });
              }}
            >
              Pay with Bitcoin via Sats Connect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
