import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import * as schema from "../db/schema";
import { computeRoundScores } from "../score";
import type { Env } from "../types";

const groups = new Hono<{ Bindings: Env }>();

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

groups.post("/", zValidator("json", createGroupSchema), async (c) => {
	const body = c.req.valid("json");
	const db = drizzle(c.env.DB);

	const groupId = crypto.randomUUID();
	const playerIds = body.players.map(() => crypto.randomUUID());

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
	] as Parameters<typeof db.batch>[0]);

	return c.json({ groupId }, 201);
});

groups.get("/:groupId", async (c) => {
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
		rounds: roundsWithScores,
		chips: chipRows,
		advancePayments,
	});
});

groups.delete("/:groupId/players/:playerId", async (c) => {
	const { groupId, playerId } = c.req.param();
	const db = drizzle(c.env.DB);

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

	await db.delete(schema.players).where(eq(schema.players.id, playerId));

	return c.json({ success: true });
});

export default groups;
