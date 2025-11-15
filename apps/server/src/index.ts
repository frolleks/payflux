import { serve } from "bun";
import { getTotalFunds } from "@/routes/funds";
import { createNewPayment, getPayment } from "@/routes/payments";

import index from "@/ui/index.html";

const server = serve({
  routes: {
    "/*": index,

    "/api/payments": {
      POST: async (req) => await createNewPayment(req),
    },

    "/api/payments/:id": async (req) => await getPayment(req),

    "/api/funds/total": async (req) => await getTotalFunds(req),

    "/api/health": (req) => {
      return Response.json({
        status: "ok",
        timestamp: new Date().toISOString(),
      });
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
