import { zValidator } from "@hono/zod-validator";
import { and, eq, gt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { z } from "zod";
import * as schema from "./db/schema";

type Env = {
	DB: D1Database;
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
	const body = c.req.valid("json");
	const db = drizzle(c.env.DB);

	const groupId = crypto.randomUUID();
	const inviteToken = crypto.randomUUID();
	const playerIds = body.players.map(() => crypto.randomUUID());
	const expiresAt = new Date(
		Date.now() + 7 * 24 * 60 * 60 * 1000,
	).toISOString();

	await db.batch([
		db.insert(schema.groups).values({
			id: groupId,
			name: body.name,
			rate: body.rate,
			chip_rate: body.chipRate,
			uma_1: body.uma[0],
			uma_2: body.uma[1],
			uma_3: body.uma[2],
			uma_4: body.uma[3],
			genten: body.genten,
			kaeshi: body.kaeshi,
		}),
		...playerIds.map((pid, i) =>
			db.insert(schema.players).values({
				id: pid,
				group_id: groupId,
				name: body.players[i],
			}),
		),
		db.insert(schema.invite_tokens).values({
			token: inviteToken,
			group_id: groupId,
			expires_at: expiresAt,
		}),
	] as Parameters<typeof db.batch>[0]);

	return c.json({ groupId, inviteToken }, 201);
});

// GET /invite/:token
app.get("/invite/:token", async (c) => {
	const token = c.req.param("token");
	const db = drizzle(c.env.DB);

	const [invite] = await db
		.select({
			group_id: schema.invite_tokens.group_id,
			expires_at: schema.invite_tokens.expires_at,
		})
		.from(schema.invite_tokens)
		.where(eq(schema.invite_tokens.token, token))
		.limit(1);

	if (!invite) return c.json({ error: "Invalid token" }, 404);
	if (new Date(invite.expires_at) < new Date())
		return c.json({ error: "Token expired" }, 410);

	const [group] = await db
		.select()
		.from(schema.groups)
		.where(eq(schema.groups.id, invite.group_id))
		.limit(1);

	const players = await db
		.select({ id: schema.players.id, name: schema.players.name })
		.from(schema.players)
		.where(eq(schema.players.group_id, invite.group_id))
		.orderBy(schema.players.created_at);

	return c.json({ group, players });
});

// POST /invite/:token
const joinSchema = z.union([
	z.object({ playerId: z.string().uuid() }),
	z.object({ name: z.string().min(1).max(10) }),
]);

app.post("/invite/:token", zValidator("json", joinSchema), async (c) => {
	const token = c.req.param("token");
	const db = drizzle(c.env.DB);

	const [invite] = await db
		.select({
			group_id: schema.invite_tokens.group_id,
			expires_at: schema.invite_tokens.expires_at,
		})
		.from(schema.invite_tokens)
		.where(eq(schema.invite_tokens.token, token))
		.limit(1);

	if (!invite) return c.json({ error: "Invalid token" }, 404);
	if (new Date(invite.expires_at) < new Date())
		return c.json({ error: "Token expired" }, 410);

	const body = c.req.valid("json");
	let playerId: string;

	if ("playerId" in body) {
		const [player] = await db
			.select({ id: schema.players.id })
			.from(schema.players)
			.where(
				and(
					eq(schema.players.id, body.playerId),
					eq(schema.players.group_id, invite.group_id),
				),
			)
			.limit(1);
		if (!player) return c.json({ error: "Player not found" }, 404);
		playerId = body.playerId;
	} else {
		const existing = await db
			.select({ id: schema.players.id })
			.from(schema.players)
			.where(eq(schema.players.group_id, invite.group_id));
		if (existing.length >= 5) return c.json({ error: "Group is full" }, 409);

		playerId = crypto.randomUUID();
		await db.insert(schema.players).values({
			id: playerId,
			group_id: invite.group_id,
			name: body.name,
		});
	}

	const sessionToken = crypto.randomUUID();
	const expiresAt = new Date(
		Date.now() + 7 * 24 * 60 * 60 * 1000,
	).toISOString();

	await db
		.insert(schema.sessions)
		.values({ token: sessionToken, player_id: playerId, expires_at: expiresAt })
		.onConflictDoUpdate({
			target: schema.sessions.token,
			set: { player_id: playerId, expires_at: expiresAt },
		});

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
	const db = drizzle(c.env.DB);

	const sessionToken = getCookie(c, "session");
	if (!sessionToken) return c.json({ error: "Unauthorized" }, 401);

	const [session] = await db
		.select({ player_id: schema.sessions.player_id })
		.from(schema.sessions)
		.where(
			and(
				eq(schema.sessions.token, sessionToken),
				gt(schema.sessions.expires_at, sql`datetime('now')`),
			),
		)
		.limit(1);

	if (!session) return c.json({ error: "Unauthorized" }, 401);
	if (session.player_id !== playerId)
		return c.json({ error: "Forbidden" }, 403);

	const [player] = await db
		.select({ id: schema.players.id })
		.from(schema.players)
		.where(
			and(
				eq(schema.players.id, playerId),
				eq(schema.players.group_id, groupId),
			),
		)
		.limit(1);
	if (!player) return c.json({ error: "Player not found" }, 404);

	const allPlayers = await db
		.select({ id: schema.players.id })
		.from(schema.players)
		.where(eq(schema.players.group_id, groupId));
	if (allPlayers.length <= 4) {
		return c.json(
			{ error: "Cannot delete: group must have at least 4 players" },
			409,
		);
	}

	await db.batch([
		db.delete(schema.sessions).where(eq(schema.sessions.player_id, playerId)),
		db.delete(schema.players).where(eq(schema.players.id, playerId)),
	]);

	return c.json({ success: true });
});

export default app;
