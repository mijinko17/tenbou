import { ResultAsync, err, ok } from "neverthrow";
import type { SettlementRepository } from "../domain/repositories/settlement";
import { computeRoundScores } from "../domain/score";
import { computeSettlement } from "../domain/settlement";
import { AppError } from "../errors";

export function getSettlement(
	repo: SettlementRepository,
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
