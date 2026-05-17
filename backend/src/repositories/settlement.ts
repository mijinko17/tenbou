import { eq, inArray } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { SettlementRepo } from "../services/settlement";

type Db = ReturnType<typeof drizzle>;

export function createSettlementRepository(db: Db): SettlementRepo {
	return {
		async findGroup(groupId) {
			const [group] = await db
				.select()
				.from(schema.groups)
				.where(eq(schema.groups.id, groupId))
				.limit(1);
			return group ?? null;
		},

		async findPlayers(groupId) {
			return db
				.select({ id: schema.players.id, name: schema.players.name })
				.from(schema.players)
				.where(eq(schema.players.group_id, groupId))
				.orderBy(schema.players.created_at);
		},

		async findRoundsWithResults(groupId) {
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
					.map((r) => ({ playerId: r.player_id, rawPoints: r.raw_points })),
			}));
		},

		async findChips(groupId) {
			return db
				.select({
					playerId: schema.chip_totals.player_id,
					count: schema.chip_totals.chips,
				})
				.from(schema.chip_totals)
				.where(eq(schema.chip_totals.group_id, groupId));
		},

		async findAdvancePayments(groupId) {
			return db
				.select({
					payer_id: schema.advance_payments.payer_id,
					beneficiary_ids: schema.advance_payments.beneficiary_ids,
					amount: schema.advance_payments.amount,
				})
				.from(schema.advance_payments)
				.where(eq(schema.advance_payments.group_id, groupId))
				.orderBy(schema.advance_payments.created_at);
		},
	};
}
