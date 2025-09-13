import { Hono } from "hono";
import { payments } from "./routes/payments";
import { serveStatic } from "hono/bun";

const app = new Hono();

app.route("/api/payments", payments);

app.get("/health", (c) => c.json({ status: "ok" }));

app.use("/*", serveStatic({ root: "./dist" })); // static assets
app.use("/*", serveStatic({ path: "./dist/index.html" })); // SPA fallback

export default app;
