"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type PayStatus = "idle" | "pending" | "unconfirmed" | "paid" | "error";

type CreateResponse = {
  id: string;
  paymentUrl: string;
};

type StatusResponse = {
  id: string;
  status: PayStatus | "pending" | "unconfirmed" | "paid";
  amount?: number; // BTC
  address?: string;
  confirmedSats?: number;
  unconfirmedSats?: number;
  chain?: string;
};

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export default function PaywallPage() {
  const [id, setId] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PayStatus>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [amountBTC, setAmountBTC] = useState<number | null>(null);
  const [confirmedSats, setConfirmedSats] = useState<number | null>(null);
  const [unconfirmedSats, setUnconfirmedSats] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const reset = useCallback(() => {
    setId(null);
    setPaymentUrl(null);
    setStatus("idle");
    setAddress(null);
    setAmountBTC(null);
    setConfirmedSats(null);
    setUnconfirmedSats(null);
    setError(null);
    try {
      localStorage.removeItem("invoiceId");
      localStorage.removeItem("paymentUrl");
    } catch {}
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    router.replace("/paywall");
  }, [router]);

  const startPolling = useCallback((invoiceId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/pay/status?id=${encodeURIComponent(invoiceId)}`,
          {
            cache: "no-store",
          }
        );
        if (!res.ok) {
          // Surface but keep polling
          const text = await res.text().catch(() => "");
          setError(text || res.statusText);
          return;
        }
        const data = (await res.json()) as StatusResponse;
        const s = (data.status as PayStatus) ?? "pending";
        setStatus(s);
        if (typeof data.amount === "number") setAmountBTC(data.amount);
        if (typeof data.address === "string") setAddress(data.address);
        if (typeof data.confirmedSats === "number")
          setConfirmedSats(data.confirmedSats);
        if (typeof data.unconfirmedSats === "number")
          setUnconfirmedSats(data.unconfirmedSats);

        if (s === "paid") {
          // stop polling
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (e: any) {
        setError(e?.message || "failed to fetch status");
      }
    };

    // kick off immediately, then every 5s
    poll();
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(poll, 5000);
  }, []);

  const createInvoice = useCallback(async () => {
    setError(null);
    setStatus("pending");
    try {
      // Example: 1 USD worth in BTC on the processor; chain BTC
      const res = await fetch("/api/pay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 1, chain: "eth" }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setStatus("error");
        setError(text || res.statusText);
        return;
      }
      const data = (await res.json()) as CreateResponse;
      setId(data.id);
      setPaymentUrl(data.paymentUrl);
      try {
        localStorage.setItem("invoiceId", data.id);
        localStorage.setItem("paymentUrl", data.paymentUrl);
      } catch {}
      router.replace(`/paywall?id=${encodeURIComponent(data.id)}`);
      startPolling(data.id);
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "failed to create invoice");
    }
  }, [startPolling]);

  const onManualRefresh = useCallback(() => {
    if (id) startPolling(id);
  }, [id, startPolling]);

  useEffect(() => {
    // Restore invoice from URL (?id=) or localStorage on load
    const spId = searchParams?.get("id");
    if (spId && !id) {
      setId(spId);
      try {
        const storedUrl = localStorage.getItem("paymentUrl");
        if (storedUrl) setPaymentUrl(storedUrl);
      } catch {}
      startPolling(spId);
      return;
    }
    if (!id) {
      try {
        const storedId = localStorage.getItem("invoiceId");
        const storedUrl = localStorage.getItem("paymentUrl");
        if (storedId) {
          setId(storedId);
          if (storedUrl) setPaymentUrl(storedUrl);
          startPolling(storedId);
        }
      } catch {}
    }
  }, [searchParams, id, startPolling]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const btcAmountStr = useMemo(() => {
    if (amountBTC == null || Number.isNaN(amountBTC)) return null;
    // Show up to 8 decimal places for BTC
    return amountBTC.toFixed(18);
  }, [amountBTC]);

  const statusBadge = useMemo(() => {
    const base =
      "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset";
    switch (status) {
      case "idle":
        return (
          <span
            className={classNames(
              base,
              "bg-gray-100 text-gray-700 ring-gray-300"
            )}
          >
            idle
          </span>
        );
      case "pending":
        return (
          <span
            className={classNames(
              base,
              "bg-yellow-100 text-yellow-800 ring-yellow-300"
            )}
          >
            pending
          </span>
        );
      case "unconfirmed":
        return (
          <span
            className={classNames(
              base,
              "bg-orange-100 text-orange-800 ring-orange-300"
            )}
          >
            unconfirmed
          </span>
        );
      case "paid":
        return (
          <span
            className={classNames(
              base,
              "bg-green-100 text-green-700 ring-green-300"
            )}
          >
            paid
          </span>
        );
      case "error":
        return (
          <span
            className={classNames(base, "bg-red-100 text-red-700 ring-red-300")}
          >
            error
          </span>
        );
      default:
        return null;
    }
  }, [status]);

  const locked = status !== "paid";

  return (
    <div className="min-h-screen w-full flex flex-col items-center p-6 sm:p-10">
      <div className="w-full max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Paywalled Content (Crypto)</h1>
          {statusBadge}
        </header>

        {locked ? (
          <div className="rounded-lg border border-black/10 dark:border-white/15 p-5 space-y-4">
            <p className="text-sm">
              This content is locked. Pay a small amount in crypto to unlock.
            </p>

            {id ? (
              <div className="space-y-3">
                <div className="text-sm">
                  <div>
                    <span className="font-medium">Invoice ID:</span>{" "}
                    <code className="rounded bg-black/5 dark:bg-white/10 px-1 py-0.5">
                      {id}
                    </code>
                  </div>
                  {address ? (
                    <div className="mt-1">
                      <span className="font-medium">Address:</span>{" "}
                      <code className="break-all rounded bg-black/5 dark:bg-white/10 px-1 py-0.5">
                        {address}
                      </code>
                    </div>
                  ) : null}
                  {btcAmountStr ? (
                    <div className="mt-1">
                      <span className="font-medium">Amount:</span>{" "}
                      <code className="rounded bg-black/5 dark:bg-white/10 px-1 py-0.5">
                        {btcAmountStr}
                      </code>
                    </div>
                  ) : null}
                  {(confirmedSats != null || unconfirmedSats != null) && (
                    <div className="mt-1 text-xs opacity-80">
                      Confirmed: {confirmedSats ?? 0} sats • Unconfirmed:{" "}
                      {unconfirmedSats ?? 0} sats
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {paymentUrl ? (
                    <a
                      href={paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium hover:opacity-90"
                    >
                      Open payment page
                    </a>
                  ) : null}
                  <button
                    onClick={onManualRefresh}
                    className="rounded-md border border-black/10 dark:border-white/20 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    Check status now
                  </button>
                  <button
                    onClick={reset}
                    className="rounded-md border border-black/10 dark:border-white/20 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    Start over
                  </button>
                </div>

                <p className="text-xs opacity-80">
                  This page polls status every 5 seconds and will unlock
                  automatically once paid and confirmed on-chain. A webhook also
                  updates status server-side for faster unlocks.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={createInvoice}
                  className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium hover:opacity-90"
                >
                  Unlock with Crypto
                </button>
                {error ? (
                  <span className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {!locked ? (
          <div className="rounded-lg border border-emerald-300/50 bg-emerald-50 dark:bg-emerald-900/20 p-6 space-y-3">
            <h2 className="text-xl font-semibold text-emerald-800 dark:text-emerald-200">
              Unlocked: Premium Content
            </h2>
            <p className="text-sm leading-6">
              Thanks for your payment. Here is the exclusive content. In a real
              application, this would render protected data fetched only after
              verifying payment status server-side.
            </p>
            <ul className="list-disc pl-6 text-sm">
              <li>Exclusive article, video, or download link</li>
              <li>
                Time-limited or per-invoice access can be enforced server-side
              </li>
              <li>Webhook ensures near real-time unlock</li>
            </ul>
          </div>
        ) : null}

        {error && (
          <div className="rounded-md border border-red-300/60 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="text-xs opacity-70">
          Dev tips:
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>
              Ensure the processor backend is running at http://localhost:3000
              (Bun dev in this repo) or set PROCESSOR_BASE_URL in the Next app
              environment.
            </li>
            <li>
              Run this Next app on a different port (e.g. 3001) to avoid
              collision with the processor. Set APP_BASE_URL (e.g.
              http://localhost:3001) if needed.
            </li>
            <li>
              Set WEBHOOK_SECRET in both processor and Next app for HMAC
              verification.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
