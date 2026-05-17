import { Hono } from "hono";
import { cors } from "hono/cors";
import advancePayments from "./presentation/advance-payments";
import chips from "./presentation/chips";
import groups from "./presentation/groups";
import rounds from "./presentation/rounds";
import settlement from "./presentation/settlement";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use(
	cors({
		origin: ["http://localhost:5173", "https://tenbou.pages.dev"],
		credentials: true,
	}),
);

app.get("/", (c) => c.json({ status: "ok" }));

app.route("/groups", groups);
app.route("/groups", rounds);
app.route("/groups", chips);
app.route("/groups", advancePayments);
app.route("/groups", settlement);

export default app;
