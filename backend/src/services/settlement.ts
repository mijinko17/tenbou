import { ResultAsync, err, ok } from "neverthrow";
import type * as schema from "../db/schema";
import { AppError } from "../errors";
import { computeRoundScores } from "../score";
import { computeSettlement } from "../settlement";
import type { RoundData } from "./groups";

type GroupRow = typeof schema.groups.$inferSelect;

export type SettlementRepo = {
	findGroup(groupId: string): ResultAsync<GroupRow | null, AppError>;
	findPlayers(
		groupId: string,
	): ResultAsync<{ id: string; name: string }[], AppError>;
	findRoundsWithResults(groupId: string): ResultAsync<RoundData[], AppError>;
	findChips(
		groupId: string,
	): ResultAsync<{ playerId: string; count: number }[], AppError>;
	findAdvancePayments(
		groupId: string,
	): ResultAsync<
		{ payer_id: string; beneficiary_ids: string; amount: number }[],
		AppError
	>;
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
	return repo
		.findGroup(groupId)
		.andThen((group) =>
			group ? ok(group) : err(new AppError("Group not found", 404)),
		)
		.andThen((group) =>
			ResultAsync.combine([
				repo.findPlayers(groupId),
				repo.findRoundsWithResults(groupId),
				repo.findChips(groupId),
				repo.findAdvancePayments(groupId),
			]).map(([players, rounds, chipRows, advancePaymentRows]) => {
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
