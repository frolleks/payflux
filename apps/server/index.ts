import { Hono } from "hono";
import { payments } from "./routes/payments";
import { funds } from "./routes/funds";

const app = new Hono();

app.route("/api/payments", payments);
app.route("/api/funds", funds);

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
