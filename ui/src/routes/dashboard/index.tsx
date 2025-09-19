import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

type WalletInfo = {
  index: number;
  address: string;
  balanceWei: string;
};

type FundsResponse = {
  totalWei: string;
  totalEther: string;
  wallets: WalletInfo[];
};

async function fetchFunds(): Promise<FundsResponse> {
  const res = await fetch("/api/funds/total");
  if (!res.ok) throw new Error("failed to fetch funds");
  return res.json();
}

export default function Dashboard() {
  const { data, error, isLoading, refetch } = useQuery<FundsResponse>({
    queryKey: ["funds", "total"],
    queryFn: fetchFunds,
    staleTime: 10_000,
  });

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard — Funds</h1>
          <div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </header>

        <section className="rounded-md border p-4">
          {isLoading ? (
            <div>Loading…</div>
          ) : error ? (
            <div className="text-red-600">
              Error: {(error as Error).message}
            </div>
          ) : data ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">Total balance</div>
              <div className="text-3xl font-bold">{data.totalEther} ETH</div>
              <div className="text-xs text-gray-500">{data.totalWei} wei</div>

              <div className="mt-4">
                <h3 className="text-sm font-medium">Wallets</h3>
                <ul className="mt-2 divide-y">
                  {data.wallets.map((w) => (
                    <li
                      key={w.address}
                      className="py-2 flex items-start justify-between"
                    >
                      <div className="text-xs break-all">{w.address}</div>
                      <div className="text-sm font-mono">
                        {w.balanceWei} wei
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div>No data</div>
          )}
        </section>
      </div>
    </div>
  );
}
