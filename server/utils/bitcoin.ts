const PORT = process.env.BITCOIN_PORT || "8333";
const HOST = process.env.BITCOIN_HOST || "127.0.0.1";
const USER = process.env.BITCOIN_USER;
const PASS = process.env.BITCOIN_PASS;

interface GetNewAddressResponse {
  id: string;
  result: string;
  error?: Error;
}

export async function generateAddress() {
  const res = await fetch(`http://${HOST}:${PORT}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${USER}:${PASS}`).toString(
        "base64"
      )}`,
    },
    body: JSON.stringify({
      jsonrpc: "1.0",
      id: "payflux-server",
      method: "getnewaddress",
      params: [],
    }),
  });

  const data = (await res.json()) as GetNewAddressResponse;

  if (data.error) {
    throw data.error;
  }

  return data.result;
}

interface GetCurrentPriceResponse {
  usd: number;
}

export async function fiatToBTC(fiat: number): Promise<number> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
  );
  const data = (await res.json()) as { bitcoin: GetCurrentPriceResponse };

  const price = data.bitcoin.usd;
  return fiat / price;
}

const MEMPOOL_API_BASE =
  process.env.MEMPOOL_API_BASE || "https://mempool.space/api";

type MempoolAddressStats = {
  chain_stats: {
    funded_txo_sum: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_sum: number;
    spent_txo_sum: number;
    tx_count: number;
  };
};

export async function fetchAddressStats(
  address: string
): Promise<MempoolAddressStats | null> {
  try {
    const res = await fetch(`${MEMPOOL_API_BASE}/address/${address}`);
    if (!res.ok) return null;
    return (await res.json()) as MempoolAddressStats;
  } catch {
    return null;
  }
}

export function satsFromBTC(btc: number | string) {
  const n = typeof btc === "string" ? parseFloat(btc) : btc;
  return Math.round(n * 1e8);
}
