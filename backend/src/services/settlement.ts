import { ResultAsync, err, ok } from "neverthrow";
import type * as schema from "../db/schema";
import { AppError } from "../errors";
import { computeRoundScores } from "../score";
import { computeSettlement } from "../settlement";
import type { RoundData } from "./groups";

type GroupRow = typeof schema.groups.$inferSelect;

export type SettlementRepo = {
	findGroup(groupId: string): Promise<GroupRow | null>;
	findPlayers(groupId: string): Promise<{ id: string; name: string }[]>;
	findRoundsWithResults(groupId: string): Promise<RoundData[]>;
	findChips(groupId: string): Promise<{ playerId: string; count: number }[]>;
	findAdvancePayments(
		groupId: string,
	): Promise<{ payer_id: string; beneficiary_ids: string; amount: number }[]>;
};

export function getSettlement(
	repo: SettlementRepo,
	groupId: string,
): ResultAsync<
	ReturnType<typeof computeSettlement> & {
		players: { id: string; name: string }[];
	},
	AppError
> {
	return ResultAsync.fromSafePromise(repo.findGroup(groupId))
		.andThen((group) =>
			group ? ok(group) : err(new AppError("Group not found", 404)),
		)
		.andThen((group) =>
			ResultAsync.fromSafePromise(
				Promise.all([
					repo.findPlayers(groupId),
					repo.findRoundsWithResults(groupId),
					repo.findChips(groupId),
					repo.findAdvancePayments(groupId),
				]),
			).map(([players, rounds, chipRows, advancePaymentRows]) => {
				const roundScores = rounds.map((round) =>
					computeRoundScores(
						round.results,
						group,
						round.tobiKillerId,
						round.rankOrder,
					),
				);
				const { breakdown, payments } = computeSettlement(
					group,
					players,
					roundScores,
					chipRows,
					advancePaymentRows,
				);
				return { players, breakdown, payments };
			}),
		);
}
