import { and, eq, sql } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import { ResultAsync } from "neverthrow";
import type { RoundRepository } from "../../domain/repositories/round";
import { AppError } from "../../errors";
import * as schema from "../db/schema";

type Db = ReturnType<typeof drizzle>;

const dbErr = (e: unknown) => new AppError(String(e), 500);

export function createRoundRepository(db: Db): RoundRepository {
	return {
		findGroup(groupId) {
			return ResultAsync.fromPromise(
				db
					.select()
					.from(schema.groups)
					.where(eq(schema.groups.id, groupId))
					.limit(1)
					.then(([group]) => group ?? null),
				dbErr,
			);
		},

		findPlayerIds(groupId) {
			return ResultAsync.fromPromise(
				db
					.select({ id: schema.players.id })
					.from(schema.players)
					.where(eq(schema.players.group_id, groupId))
					.then((players) => players.map((p) => p.id)),
				dbErr,
			);
		},

		countRounds(groupId) {
			return ResultAsync.fromPromise(
				db
					.select({ count: sql<number>`count(*)` })
					.from(schema.game_rounds)
					.where(eq(schema.game_rounds.group_id, groupId))
					.then(([{ count }]) => count ?? 0),
				dbErr,
			);
		},

		createRound({
			roundId,
			groupId,
			roundNo,
			tobiKillerId,
			rankOrder,
			results,
		}) {
			return ResultAsync.fromPromise(
				db
					.batch([
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
					] as Parameters<typeof db.batch>[0])
					.then(() => undefined),
				dbErr,
			);
		},

		findRound(groupId, roundId) {
			return ResultAsync.fromPromise(
				db
					.select({ id: schema.game_rounds.id })
					.from(schema.game_rounds)
					.where(
						and(
							eq(schema.game_rounds.id, roundId),
							eq(schema.game_rounds.group_id, groupId),
						),
					)
					.limit(1)
					.then(([round]) => round ?? null),
				dbErr,
			);
		},

		deleteRound(roundId) {
			return ResultAsync.fromPromise(
				db
					.batch([
						db
							.delete(schema.game_results)
							.where(eq(schema.game_results.round_id, roundId)),
						db
							.delete(schema.game_rounds)
							.where(eq(schema.game_rounds.id, roundId)),
					] as Parameters<typeof db.batch>[0])
					.then(() => undefined),
				dbErr,
			);
		},
	};
}
