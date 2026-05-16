import { zValidator } from "@hono/zod-validator";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { z } from "zod";
import * as schema from "./db/schema";

type Group = typeof schema.groups.$inferSelect;

function computeRoundScores(
	results: { playerId: string; rawPoints: number }[],
	group: Group,
	tobiKillerId: string | null,
	rankOrder: string[] | null,
): { playerId: string; rawPoints: number; score: number }[] {
	const umas = [group.uma_1, group.uma_2, group.uma_3, group.uma_4];
	const oka = ((group.kaeshi - group.genten) / 1000) * 4;
	const tobiCount = results.filter((r) => r.rawPoints < 0).length;

	const ordered = rankOrder
		? rankOrder
		: [...results]
				.sort((a, b) => b.rawPoints - a.rawPoints)
				.map((r) => r.playerId);
	const rankMap = new Map(ordered.map((id, i) => [id, i]));

	return results.map((r) => {
		const rank = rankMap.get(r.playerId) ?? 0;
		let score = (r.rawPoints - group.kaeshi) / 1000 + umas[rank];

		if (r.rawPoints < 0) score -= group.tobi;
		if (tobiKillerId === r.playerId) score += group.tobi * tobiCount;
		if (rank === 0) score += oka;

		return { ...r, score: Math.round(score * 10) / 10 };
	});
}

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
	tobi: z.number().int().nonnegative().default(10),
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
			tobi: body.tobi,
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

// GET /groups/:groupId
app.get("/groups/:groupId", async (c) => {
	const { groupId } = c.req.param();
	const db = drizzle(c.env.DB);

	const [group] = await db
		.select()
		.from(schema.groups)
		.where(eq(schema.groups.id, groupId))
		.limit(1);

	if (!group) return c.json({ error: "Group not found" }, 404);

	const players = await db
		.select({ id: schema.players.id, name: schema.players.name })
		.from(schema.players)
		.where(eq(schema.players.group_id, groupId))
		.orderBy(schema.players.created_at);

	const rounds = await db
		.select()
		.from(schema.game_rounds)
		.where(eq(schema.game_rounds.group_id, groupId))
		.orderBy(schema.game_rounds.round_no);

	const roundIds = rounds.map((r) => r.id);
	const allResults =
		roundIds.length > 0
			? await db
					.select()
					.from(schema.game_results)
					.where(inArray(schema.game_results.round_id, roundIds))
			: [];

	const chipRows = await db
		.select({
			playerId: schema.chip_totals.player_id,
			count: schema.chip_totals.chips,
		})
		.from(schema.chip_totals)
		.where(eq(schema.chip_totals.group_id, groupId));

	const advancePaymentRows = await db
		.select()
		.from(schema.advance_payments)
		.where(eq(schema.advance_payments.group_id, groupId))
		.orderBy(schema.advance_payments.created_at);

	const roundsWithScores = rounds.map((round) => {
		const results = allResults
			.filter((r) => r.round_id === round.id)
			.map((r) => ({ playerId: r.player_id, rawPoints: r.raw_points }));
		const rankOrder = round.rank_order
			? (JSON.parse(round.rank_order) as string[])
			: null;
		return {
			id: round.id,
			roundNo: round.round_no,
			playedAt: round.played_at,
			tobiKillerId: round.tobi_killer_id,
			results: computeRoundScores(
				results,
				group,
				round.tobi_killer_id,
				rankOrder,
			),
		};
	});

	const advancePayments = advancePaymentRows.map((p) => ({
		id: p.id,
		payerId: p.payer_id,
		beneficiaryIds: JSON.parse(p.beneficiary_ids) as string[],
		description: p.description,
		amount: p.amount,
		createdAt: p.created_at,
	}));

	return c.json({
		group,
		players,
		currentPlayerId: null,
		rounds: roundsWithScores,
		chips: chipRows,
		advancePayments,
	});
});

// POST /groups/:groupId/rounds
const createRoundSchema = z.object({
	results: z
		.array(
			z.object({
				playerId: z.string().uuid(),
				rawPoints: z.number().int(),
			}),
		)
		.length(4),
	tobiKillerId: z.string().uuid().nullable().optional(),
	rankOrder: z.array(z.string().uuid()).length(4).optional(),
});

app.post(
	"/groups/:groupId/rounds",
	zValidator("json", createRoundSchema),
	async (c) => {
		const { groupId } = c.req.param();
		const body = c.req.valid("json");
		const db = drizzle(c.env.DB);

		const [group] = await db
			.select()
			.from(schema.groups)
			.where(eq(schema.groups.id, groupId))
			.limit(1);

		if (!group) return c.json({ error: "Group not found" }, 404);

		const expectedSum = group.genten * 4;
		const actualSum = body.results.reduce((s, r) => s + r.rawPoints, 0);
		if (actualSum !== expectedSum) {
			return c.json(
				{
					error: `素点の合計が${expectedSum}になっていません（現在: ${actualSum}）`,
				},
				422,
			);
		}

		const groupPlayers = await db
			.select({ id: schema.players.id })
			.from(schema.players)
			.where(eq(schema.players.group_id, groupId));

		const groupPlayerIds = new Set(groupPlayers.map((p) => p.id));
		for (const r of body.results) {
			if (!groupPlayerIds.has(r.playerId)) {
				return c.json({ error: "Invalid playerId" }, 422);
			}
		}

		// 同点チェック
		const pointCounts = new Map<number, number>();
		for (const r of body.results) {
			pointCounts.set(r.rawPoints, (pointCounts.get(r.rawPoints) ?? 0) + 1);
		}
		const hasTies = [...pointCounts.values()].some((c) => c > 1);
		if (hasTies && !body.rankOrder) {
			return c.json(
				{ error: "同点プレイヤーがいる場合、順位を指定してください" },
				422,
			);
		}
		if (body.rankOrder) {
			const rankSet = new Set(body.rankOrder);
			const allPresent = body.results.every((r) => rankSet.has(r.playerId));
			if (!allPresent) {
				return c.json(
					{ error: "rankOrder に無効なプレイヤーIDが含まれています" },
					422,
				);
			}
			for (let i = 0; i < body.rankOrder.length - 1; i++) {
				const curr =
					body.results.find((r) => r.playerId === body.rankOrder?.[i])
						?.rawPoints ?? 0;
				const next =
					body.results.find((r) => r.playerId === body.rankOrder?.[i + 1])
						?.rawPoints ?? 0;
				if (curr < next) {
					return c.json({ error: "順位の指定が点数と矛盾しています" }, 422);
				}
			}
		}

		const hasTobi = body.results.some((r) => r.rawPoints < 0);
		if (hasTobi && !body.tobiKillerId) {
			return c.json(
				{
					error:
						"飛んだプレイヤーがいる場合、飛ばしたプレイヤーを指定してください",
				},
				422,
			);
		}
		if (body.tobiKillerId) {
			const tobiPlayerIds = new Set(
				body.results.filter((r) => r.rawPoints < 0).map((r) => r.playerId),
			);
			if (tobiPlayerIds.has(body.tobiKillerId)) {
				return c.json(
					{ error: "飛ばしたプレイヤーは飛んだプレイヤー自身にはなれません" },
					422,
				);
			}
			if (!groupPlayerIds.has(body.tobiKillerId)) {
				return c.json({ error: "Invalid tobiKillerId" }, 422);
			}
		}

		const [{ count }] = await db
			.select({ count: sql<number>`count(*)` })
			.from(schema.game_rounds)
			.where(eq(schema.game_rounds.group_id, groupId));

		const roundId = crypto.randomUUID();
		const roundNo = (count ?? 0) + 1;

		await db.batch([
			db.insert(schema.game_rounds).values({
				id: roundId,
				group_id: groupId,
				round_no: roundNo,
				tobi_killer_id: body.tobiKillerId ?? null,
				rank_order: body.rankOrder ? JSON.stringify(body.rankOrder) : null,
			}),
			...body.results.map((r) =>
				db.insert(schema.game_results).values({
					id: crypto.randomUUID(),
					round_id: roundId,
					player_id: r.playerId,
					raw_points: r.rawPoints,
				}),
			),
		] as Parameters<typeof db.batch>[0]);

		return c.json({ roundId, roundNo }, 201);
	},
);

// PUT /groups/:groupId/chips
const updateChipsSchema = z.object({
	chips: z.array(
		z.object({
			playerId: z.string().uuid(),
			count: z.number().int(),
		}),
	),
});

app.put(
	"/groups/:groupId/chips",
	zValidator("json", updateChipsSchema),
	async (c) => {
		const { groupId } = c.req.param();
		const body = c.req.valid("json");
		const db = drizzle(c.env.DB);

		const [group] = await db
			.select({ id: schema.groups.id })
			.from(schema.groups)
			.where(eq(schema.groups.id, groupId))
			.limit(1);
		if (!group) return c.json({ error: "Group not found" }, 404);

		const groupPlayers = await db
			.select({ id: schema.players.id })
			.from(schema.players)
			.where(eq(schema.players.group_id, groupId));
		const groupPlayerIds = new Set(groupPlayers.map((p) => p.id));

		for (const chip of body.chips) {
			if (!groupPlayerIds.has(chip.playerId)) {
				return c.json({ error: "Invalid playerId" }, 422);
			}
		}

		const total = body.chips.reduce((s, chip) => s + chip.count, 0);
		if (total !== 0) {
			return c.json({ error: "チップ収支の合計は0である必要があります" }, 422);
		}

		await Promise.all(
			body.chips.map((chip) =>
				db
					.insert(schema.chip_totals)
					.values({
						id: crypto.randomUUID(),
						group_id: groupId,
						player_id: chip.playerId,
						chips: chip.count,
					})
					.onConflictDoUpdate({
						target: [schema.chip_totals.group_id, schema.chip_totals.player_id],
						set: { chips: chip.count },
					}),
			),
		);

		return c.json({ success: true });
	},
);

// DELETE /groups/:groupId/chips
app.delete("/groups/:groupId/chips", async (c) => {
	const { groupId } = c.req.param();
	const db = drizzle(c.env.DB);

	const [group] = await db
		.select({ id: schema.groups.id })
		.from(schema.groups)
		.where(eq(schema.groups.id, groupId))
		.limit(1);

	if (!group) return c.json({ error: "Group not found" }, 404);

	await db.delete(schema.chip_totals).where(eq(schema.chip_totals.group_id, groupId));

	return new Response(null, { status: 204 });
});

// POST /groups/:groupId/advance-payments
const createAdvancePaymentSchema = z.object({
	payerId: z.string().uuid(),
	beneficiaryIds: z.array(z.string().uuid()).min(1),
	description: z.string().min(1).max(100),
	amount: z.number().int().positive(),
});

app.post(
	"/groups/:groupId/advance-payments",
	zValidator("json", createAdvancePaymentSchema),
	async (c) => {
		const { groupId } = c.req.param();
		const body = c.req.valid("json");
		const db = drizzle(c.env.DB);

		const [group] = await db
			.select({ id: schema.groups.id })
			.from(schema.groups)
			.where(eq(schema.groups.id, groupId))
			.limit(1);
		if (!group) return c.json({ error: "Group not found" }, 404);

		const groupPlayers = await db
			.select({ id: schema.players.id })
			.from(schema.players)
			.where(eq(schema.players.group_id, groupId));
		const groupPlayerIds = new Set(groupPlayers.map((p) => p.id));

		if (!groupPlayerIds.has(body.payerId)) {
			return c.json({ error: "Invalid payerId" }, 422);
		}
		for (const bid of body.beneficiaryIds) {
			if (!groupPlayerIds.has(bid)) {
				return c.json({ error: "Invalid beneficiaryId" }, 422);
			}
		}
		if (body.beneficiaryIds.every((bid) => bid === body.payerId)) {
			return c.json(
				{ error: "立替対象が立替者のみのケースは登録できません" },
				422,
			);
		}

		await db.insert(schema.advance_payments).values({
			id: crypto.randomUUID(),
			group_id: groupId,
			payer_id: body.payerId,
			beneficiary_ids: JSON.stringify(body.beneficiaryIds),
			description: body.description,
			amount: body.amount,
			created_at: Math.floor(Date.now() / 1000),
		});

		return c.json({ success: true }, 201);
	},
);

// DELETE /groups/:groupId/rounds/:roundId
app.delete("/groups/:groupId/rounds/:roundId", async (c) => {
	const { groupId, roundId } = c.req.param();
	const db = drizzle(c.env.DB);

	const [round] = await db
		.select({ id: schema.game_rounds.id })
		.from(schema.game_rounds)
		.where(
			and(
				eq(schema.game_rounds.id, roundId),
				eq(schema.game_rounds.group_id, groupId),
			),
		)
		.limit(1);

	if (!round) return c.json({ error: "Round not found" }, 404);

	await db.batch([
		db.delete(schema.game_results).where(eq(schema.game_results.round_id, roundId)),
		db.delete(schema.game_rounds).where(eq(schema.game_rounds.id, roundId)),
	] as Parameters<typeof db.batch>[0]);

	return new Response(null, { status: 204 });
});

// DELETE /groups/:groupId/advance-payments/:paymentId
app.delete("/groups/:groupId/advance-payments/:paymentId", async (c) => {
	const { groupId, paymentId } = c.req.param();
	const db = drizzle(c.env.DB);

	const [payment] = await db
		.select({ id: schema.advance_payments.id })
		.from(schema.advance_payments)
		.where(
			and(
				eq(schema.advance_payments.id, paymentId),
				eq(schema.advance_payments.group_id, groupId),
			),
		)
		.limit(1);

	if (!payment) return c.json({ error: "Payment not found" }, 404);

	await db
		.delete(schema.advance_payments)
		.where(eq(schema.advance_payments.id, paymentId));

	return c.json({ success: true });
});

export default app;
