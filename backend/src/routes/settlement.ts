import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import * as schema from "../db/schema";
import { computeRoundScores } from "../score";
import { computeSettlement } from "../settlement";
import type { Env } from "../types";

const settlement = new Hono<{ Bindings: Env }>();

settlement.get("/:groupId/settlement", async (c) => {
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
		.where(eq(schema.game_rounds.group_id, groupId));

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

	const roundScores = rounds.map((round) => {
		const results = allResults
			.filter((r) => r.round_id === round.id)
			.map((r) => ({ playerId: r.player_id, rawPoints: r.raw_points }));
		const rankOrder = round.rank_order
			? (JSON.parse(round.rank_order) as string[])
			: null;
		return computeRoundScores(results, group, round.tobi_killer_id, rankOrder);
	});

	const { breakdown, payments } = computeSettlement(
		group,
		players,
		roundScores,
		chipRows,
		advancePaymentRows,
	);

	return c.json({ players, breakdown, payments });
});

export default settlement;
