import { and, eq, inArray } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import { ResultAsync } from "neverthrow";
import type { GroupRepository } from "../../domain/repositories/group";
import { AppError } from "../../errors";
import * as schema from "../db/schema";

type Db = ReturnType<typeof drizzle>;

const dbErr = (e: unknown) => new AppError(String(e), 500);

export function createGroupRepository(db: Db): GroupRepository {
	return {
		createGroup({
			groupId,
			name,
			rate,
			chipRate,
			uma,
			tobi,
			genten,
			kaeshi,
			players,
		}) {
			return ResultAsync.fromPromise(
				db
					.batch([
						db.insert(schema.groups).values({
							id: groupId,
							name,
							rate,
							chip_rate: chipRate,
							uma_1: uma[0],
							uma_2: uma[1],
							uma_3: uma[2],
							uma_4: uma[3],
							tobi,
							genten,
							kaeshi,
						}),
						...players.map((p) =>
							db.insert(schema.players).values({
								id: p.id,
								group_id: groupId,
								name: p.name,
							}),
						),
					] as Parameters<typeof db.batch>[0])
					.then(() => undefined),
				dbErr,
			);
		},

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

		findPlayers(groupId) {
			return ResultAsync.fromPromise(
				db
					.select({ id: schema.players.id, name: schema.players.name })
					.from(schema.players)
					.where(eq(schema.players.group_id, groupId))
					.orderBy(schema.players.created_at),
				dbErr,
			);
		},

		findRoundsWithResults(groupId) {
			return ResultAsync.fromPromise(
				db
					.select()
					.from(schema.game_rounds)
					.where(eq(schema.game_rounds.group_id, groupId))
					.orderBy(schema.game_rounds.round_no)
					.then(async (rounds) => {
						const roundIds = rounds.map((r) => r.id);
						const allResults =
							roundIds.length > 0
								? await db
										.select()
										.from(schema.game_results)
										.where(inArray(schema.game_results.round_id, roundIds))
								: [];

						return rounds.map((round) => ({
							id: round.id,
							roundNo: round.round_no,
							playedAt: round.played_at,
							tobiKillerId: round.tobi_killer_id,
							rankOrder: round.rank_order
								? (JSON.parse(round.rank_order) as string[])
								: null,
							results: allResults
								.filter((r) => r.round_id === round.id)
								.map((r) => ({
									playerId: r.player_id,
									rawPoints: r.raw_points,
								})),
						}));
					}),
				dbErr,
			);
		},

		findChips(groupId) {
			return ResultAsync.fromPromise(
				db
					.select({
						playerId: schema.chip_totals.player_id,
						count: schema.chip_totals.chips,
					})
					.from(schema.chip_totals)
					.where(eq(schema.chip_totals.group_id, groupId)),
				dbErr,
			);
		},

		findAdvancePayments(groupId) {
			return ResultAsync.fromPromise(
				db
					.select()
					.from(schema.advance_payments)
					.where(eq(schema.advance_payments.group_id, groupId))
					.orderBy(schema.advance_payments.created_at)
					.then((rows) =>
						rows.map((p) => ({
							id: p.id,
							payerId: p.payer_id,
							beneficiaryIds: JSON.parse(p.beneficiary_ids) as string[],
							description: p.description,
							amount: p.amount,
							createdAt: p.created_at,
						})),
					),
				dbErr,
			);
		},
	};
}
