import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { z } from "zod";

type Env = {
	DB: D1Database;
	CREATION_PASSWORD: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use(
	cors({
		origin: ["http://localhost:5173", "https://tenbou.pages.dev"],
		credentials: true,
	}),
);

app.get("/", (c) => c.json({ status: "ok" }));

// POST /groups
const createGroupSchema = z.object({
	name: z.string().min(1).max(30),
	players: z.array(z.string().min(1).max(10)).min(4).max(5),
	rate: z.number().int().positive(),
	chipRate: z.number().int().positive(),
	uma: z
		.tuple([
			z.number().int(),
			z.number().int(),
			z.number().int(),
			z.number().int(),
		])
		.refine(
			(arr) => arr.reduce((a, b) => a + b, 0) === 0,
			"ウマの合計は0である必要があります",
		),
	genten: z.number().int().positive(),
	kaeshi: z.number().int().positive(),
});

app.post("/groups", zValidator("json", createGroupSchema), async (c) => {
	if (c.req.query("key") !== c.env.CREATION_PASSWORD) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const body = c.req.valid("json");
	const db = c.env.DB;

	const groupId = crypto.randomUUID();
	const inviteToken = crypto.randomUUID();
	const playerIds = body.players.map(() => crypto.randomUUID());
	const expiresAt = new Date(
		Date.now() + 7 * 24 * 60 * 60 * 1000,
	).toISOString();

	await db.batch([
		db
			.prepare(
				"INSERT INTO groups (id, name, rate, chip_rate, uma_1, uma_2, uma_3, uma_4, genten, kaeshi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			)
			.bind(
				groupId,
				body.name,
				body.rate,
				body.chipRate,
				body.uma[0],
				body.uma[1],
				body.uma[2],
				body.uma[3],
				body.genten,
				body.kaeshi,
			),
		...playerIds.map((pid, i) =>
			db
				.prepare("INSERT INTO players (id, group_id, name) VALUES (?, ?, ?)")
				.bind(pid, groupId, body.players[i]),
		),
		db
			.prepare(
				"INSERT INTO invite_tokens (token, group_id, expires_at) VALUES (?, ?, ?)",
			)
			.bind(inviteToken, groupId, expiresAt),
	]);

	return c.json({ groupId, inviteToken }, 201);
});

// GET /invite/:token
app.get("/invite/:token", async (c) => {
	const token = c.req.param("token");
	const db = c.env.DB;

	const invite = await db
		.prepare("SELECT group_id, expires_at FROM invite_tokens WHERE token = ?")
		.bind(token)
		.first<{ group_id: string; expires_at: string }>();

	if (!invite) return c.json({ error: "Invalid token" }, 404);
	if (new Date(invite.expires_at) < new Date())
		return c.json({ error: "Token expired" }, 410);

	const group = await db
		.prepare(
			"SELECT id, name, rate, chip_rate, uma_1, uma_2, uma_3, uma_4, genten, kaeshi FROM groups WHERE id = ?",
		)
		.bind(invite.group_id)
		.first();

	const { results: players } = await db
		.prepare(
			"SELECT id, name FROM players WHERE group_id = ? ORDER BY created_at",
		)
		.bind(invite.group_id)
		.all<{ id: string; name: string }>();

	return c.json({ group, players });
});

// POST /invite/:token
const joinSchema = z.union([
	z.object({ playerId: z.string().uuid() }),
	z.object({ name: z.string().min(1).max(10) }),
]);

app.post("/invite/:token", zValidator("json", joinSchema), async (c) => {
	const token = c.req.param("token");
	const db = c.env.DB;

	const invite = await db
		.prepare("SELECT group_id, expires_at FROM invite_tokens WHERE token = ?")
		.bind(token)
		.first<{ group_id: string; expires_at: string }>();

	if (!invite) return c.json({ error: "Invalid token" }, 404);
	if (new Date(invite.expires_at) < new Date())
		return c.json({ error: "Token expired" }, 410);

	const body = c.req.valid("json");
	let playerId: string;

	if ("playerId" in body) {
		const player = await db
			.prepare("SELECT id FROM players WHERE id = ? AND group_id = ?")
			.bind(body.playerId, invite.group_id)
			.first();
		if (!player) return c.json({ error: "Player not found" }, 404);
		playerId = body.playerId;
	} else {
		const { results: existing } = await db
			.prepare("SELECT id FROM players WHERE group_id = ?")
			.bind(invite.group_id)
			.all();
		if (existing.length >= 5) return c.json({ error: "Group is full" }, 409);

		playerId = crypto.randomUUID();
		await db
			.prepare("INSERT INTO players (id, group_id, name) VALUES (?, ?, ?)")
			.bind(playerId, invite.group_id, body.name)
			.run();
	}

	const sessionToken = crypto.randomUUID();
	const expiresAt = new Date(
		Date.now() + 7 * 24 * 60 * 60 * 1000,
	).toISOString();

	await db
		.prepare(
			"INSERT OR REPLACE INTO sessions (token, player_id, expires_at) VALUES (?, ?, ?)",
		)
		.bind(sessionToken, playerId, expiresAt)
		.run();

	setCookie(c, "session", sessionToken, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		expires: new Date(expiresAt),
	});

	return c.json({ playerId, groupId: invite.group_id });
});

// DELETE /groups/:groupId/players/:playerId
app.delete("/groups/:groupId/players/:playerId", async (c) => {
	const { groupId, playerId } = c.req.param();
	const db = c.env.DB;

	const sessionToken = getCookie(c, "session");
	if (!sessionToken) return c.json({ error: "Unauthorized" }, 401);

	const session = await db
		.prepare(
			"SELECT player_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
		)
		.bind(sessionToken)
		.first<{ player_id: string }>();

	if (!session) return c.json({ error: "Unauthorized" }, 401);
	if (session.player_id !== playerId)
		return c.json({ error: "Forbidden" }, 403);

	const player = await db
		.prepare("SELECT id FROM players WHERE id = ? AND group_id = ?")
		.bind(playerId, groupId)
		.first();
	if (!player) return c.json({ error: "Player not found" }, 404);

	const { results: allPlayers } = await db
		.prepare("SELECT id FROM players WHERE group_id = ?")
		.bind(groupId)
		.all();
	if (allPlayers.length <= 4) {
		return c.json(
			{ error: "Cannot delete: group must have at least 4 players" },
			409,
		);
	}

	await db.batch([
		db.prepare("DELETE FROM sessions WHERE player_id = ?").bind(playerId),
		db.prepare("DELETE FROM players WHERE id = ?").bind(playerId),
	]);

	return c.json({ success: true });
});

export default app;
