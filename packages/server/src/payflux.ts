interface PayfluxRetrieveInvoiceResponse {
  id: string;
  address: string;
  amount: string;
  chain: "btc" | "eth";
  callbackUrl: string;
  status: "pending" | "paid" | "unconfirmed";
  confirmedSats: number;
  unconfirmedSats: number;
  confirmedWei: number;
  createdAt: number;
  updatedAt: number;
}

interface PayfluxCreateInvoiceResponse {
  id: string;
  paymentUrl: string;
}

export class Payflux {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  invoices = {
    create: async (
      amount: number,
      chain: "btc" | "eth",
      callbackUrl: string
    ): Promise<
      | ({ success: true } & PayfluxCreateInvoiceResponse)
      | { success: false; error: string }
    > => {
      try {
        const res = await fetch(`${this.baseUrl}/api/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, chain, callbackUrl }),
        });

        if (!res.ok) {
          let errorMsg = `HTTP ${res.status}`;
          try {
            const errJson = await res.json();
            errorMsg = errJson.error || errorMsg;
          } catch {
            /* ignore */
          }
          return { success: false, error: errorMsg };
        }

        const data = (await res.json()) as PayfluxCreateInvoiceResponse;
        return { success: true, id: data.id, paymentUrl: data.paymentUrl };
      } catch (e: any) {
        return { success: false, error: e.message || "Network error" };
      }
    },
    retrieve: async (
      id: string
    ): Promise<
      | ({ success: true } & PayfluxRetrieveInvoiceResponse)
      | { success: false; error: any }
    > => {
      try {
        const res = await fetch(
          `${this.baseUrl}/api/payments/${encodeURIComponent(id)}`
        );

        if (!res.ok) {
          let error: any = `HTTP ${res.status}`;
          try {
            const errJson = await res.json();
            error = errJson?.error || error;
          } catch {
            /* ignore */
          }
          return { success: false, error };
        }

        const data = (await res.json()) as PayfluxRetrieveInvoiceResponse;
        return { success: true, ...data };
      } catch (e: any) {
        return { success: false, error: e?.message ?? "Network error" };
      }
    },
  };
}
