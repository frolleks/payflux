# Next.js Paywalled Content Example (BTC + Webhook)

This example shows how to gate content behind a Bitcoin payment using the Payflux processor in this repo and a webhook to unlock content in near real-time.

What’s included:

- Paywall page at /paywall
- API routes:
  - POST /api/pay/create: create invoice via the processor
  - GET /api/pay/status?id=:id: check invoice status via the processor
  - POST /api/pay/webhook: receive processor webhook and mark invoice as paid
- In-memory store to mark paid invoices (for demo only)

Prerequisites

- Run the Payflux processor (Hono + Bun) from the repo root
- Node.js 18+ (or Bun), npm/yarn/pnpm, and Next.js dev environment

1. Configure environment variables
   Create examples/next-example/.env.local with:

```
# Where the Payflux processor (Hono server) is running
# default: http://localhost:3000 if omitted
PROCESSOR_BASE_URL=http://localhost:3000

# Public base URL for this Next app (used for webhook callback URLs)
# default: http://localhost:3001 if omitted
APP_BASE_URL=http://localhost:3001

# Shared secret to validate webhook signatures.
# Must match WEBHOOK_SECRET configured on the processor (root .env).
WEBHOOK_SECRET=your_shared_secret_here
```

Also ensure the processor (repo root) has a .env with:

```
WEBHOOK_SECRET=your_shared_secret_here
# and your Bitcoin Core settings:
BITCOIN_HOST=
BITCOIN_PORT=
BITCOIN_USER=
BITCOIN_PASS=
```

2. Start the processor (repo root)
   From the repository root (NOT inside this example), follow the top-level README to install deps and run dev. For example:

```
bun install
bun dev
```

This should serve the processor at http://localhost:3000 by default, exposing:

- POST /api/payments to create invoices
- GET /api/payments/:id to check status
- UI payment page at /pay/:id

3. Install and run this Next example on port 3001
   In a new terminal:

```
cd examples/next-example
npm install
npm run dev
```

Then open http://localhost:3001 and click “Open Paywall Demo →”, or navigate directly to http://localhost:3001/paywall.

4. Flow

- Click “Unlock with Bitcoin” on /paywall
- The app calls POST /api/pay/create → which requests an invoice from the processor → returns paymentUrl and invoice id
- Open the processor payment page in a new tab (button “Open payment page”)
- The paywall polls GET /api/pay/status?id=:id periodically. Once paid:
  - The processor also fires a webhook to POST /api/pay/webhook with HMAC signature headers
  - The Next app verifies HMAC (using WEBHOOK_SECRET) and marks the invoice as paid in-memory
  - The page unlocks automatically (status shows “paid”)

5. Notes and caveats

- In-memory paid state: examples/next-example/lib/paywallStore.ts uses a simple Set to mark paid invoices. This resets on server restart and is for demo only. Replace with a database for real use.
- HMAC verification: required if you set WEBHOOK_SECRET. The processor sends:
  - X-Payflux-Signature-Alg: sha256
  - X-Payflux-Signature: hex(HMAC_SHA256(secret, raw_body))
- Payment confirmations:
  - Status may be “pending”, “unconfirmed”, or “paid” based on mempool.space chain/mempool stats
- Ports:
  - Processor runs on 3000 by default
  - This example is configured to run on 3001 (see package.json)

6. Troubleshooting

- Webhook not triggering unlock:
  - Ensure both apps share the same WEBHOOK_SECRET
  - Confirm the processor can reach APP_BASE_URL/api/pay/webhook (firewalls, tunnels if not local)
  - Check processor logs around “paid” updates
- Status never becomes paid:
  - Ensure your Bitcoin Core settings are correct and that an on-chain payment meeting the required BTC amount was made to the invoice address
  - For dev, use testnet and a testnet faucet
- CORS:
  - All cross-server calls happen from Next server routes to the processor, avoiding browser CORS issues

7. Files of interest

- app/paywall/page.tsx: UI/logic for creating and polling invoices
- app/api/pay/create/route.ts: Creates invoice via processor and returns id/paymentUrl
- app/api/pay/status/route.ts: Fetches invoice from processor or returns “paid” if webhook already marked it paid
- app/api/pay/webhook/route.ts: Validates HMAC and marks invoice paid in-memory
- lib/paywallStore.ts: In-memory store + HMAC verification + processor base URL helper

Security considerations (for production)

- Persist invoices and payment states in a real database
- Enforce authorization and scope on webhook endpoints
- Validate invoice IDs and payload schemas strictly
- Consider idempotency keys for webhook handling
- Do not reveal sensitive data client-side until server-side verification confirms payment
