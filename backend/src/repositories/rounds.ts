import { and, eq, sql } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { RoundRepo } from "../services/rounds";

type Db = ReturnType<typeof drizzle>;

export function createRoundRepository(db: Db): RoundRepo {
	return {
		async findGroup(groupId) {
			const [group] = await db
				.select()
				.from(schema.groups)
				.where(eq(schema.groups.id, groupId))
				.limit(1);
			return group ?? null;
		},

		async findPlayerIds(groupId) {
			const players = await db
				.select({ id: schema.players.id })
				.from(schema.players)
				.where(eq(schema.players.group_id, groupId));
			return players.map((p) => p.id);
		},

		async countRounds(groupId) {
			const [{ count }] = await db
				.select({ count: sql<number>`count(*)` })
				.from(schema.game_rounds)
				.where(eq(schema.game_rounds.group_id, groupId));
			return count ?? 0;
		},

		async createRound({ roundId, groupId, roundNo, tobiKillerId, rankOrder, results }) {
			await db.batch([
				db.insert(schema.game_rounds).values({
					id: roundId,
					group_id: groupId,
					round_no: roundNo,
					tobi_killer_id: tobiKillerId,
					rank_order: rankOrder ? JSON.stringify(rankOrder) : null,
				}),
				...results.map((r) =>
					db.insert(schema.game_results).values({
						id: r.id,
						round_id: r.roundId,
						player_id: r.playerId,
						raw_points: r.rawPoints,
					}),
				),
			] as Parameters<typeof db.batch>[0]);
		},

		async findRound(groupId, roundId) {
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
			return round ?? null;
		},

		async deleteRound(roundId) {
			await db.batch([
				db
					.delete(schema.game_results)
					.where(eq(schema.game_results.round_id, roundId)),
				db.delete(schema.game_rounds).where(eq(schema.game_rounds.id, roundId)),
			] as Parameters<typeof db.batch>[0]);
		},
	};
}
