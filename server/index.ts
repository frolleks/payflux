import { Hono } from "hono";
import { payments } from "./routes/payments";

const app = new Hono();

app.route("/api/payments", payments);

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
