import { Hono } from "hono";
import { cors } from "hono/cors";
import { AppError } from "./errors";
import advancePayments from "./routes/advance-payments";
import chips from "./routes/chips";
import groups from "./routes/groups";
import rounds from "./routes/rounds";
import settlement from "./routes/settlement";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use(
	cors({
		origin: ["http://localhost:5173", "https://tenbou.pages.dev"],
		credentials: true,
	}),
);

app.onError((err, c) => {
	if (err instanceof AppError) {
		return c.json({ error: err.message }, err.status);
	}
	throw err;
});

app.get("/", (c) => c.json({ status: "ok" }));

app.route("/groups", groups);
app.route("/groups", rounds);
app.route("/groups", chips);
app.route("/groups", advancePayments);
app.route("/groups", settlement);

export default app;
