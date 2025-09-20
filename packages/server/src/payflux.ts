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
      | { success: true; id: string; paymentUrl: string }
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

        const data = (await res.json()) as { id: string; paymentUrl: string };
        return { success: true, id: data.id, paymentUrl: data.paymentUrl };
      } catch (e: any) {
        return { success: false, error: e.message || "Network error" };
      }
    },
  };
}
