import { type ResultAsync, err, ok } from "neverthrow";
import type { RoundRepository } from "../domain/repositories/round";
import type { RoundInput } from "../domain/round";
import {
	validatePlayerIds,
	validateSum,
	validateTies,
	validateTobi,
} from "../domain/round";
import { AppError } from "../errors";

export type CreateRoundInput = RoundInput;

export function createRound(
	repo: RoundRepository,
	groupId: string,
	input: CreateRoundInput,
): ResultAsync<{ roundId: string; roundNo: number }, AppError> {
	return repo
		.findGroup(groupId)
		.andThen((group) =>
			group ? ok(group) : err(new AppError("Group not found", 404)),
		)
		.andThen((group) => validateSum(group, input.results))
		.andThen(() => repo.findPlayerIds(groupId))
		.map((ids) => new Set(ids))
		.andThen((groupPlayerIds) =>
			validatePlayerIds(input.results, groupPlayerIds)
				.andThen(() => validateTies(input))
				.andThen(() => validateTobi(input, groupPlayerIds)),
		)
		.andThen(() => repo.countRounds(groupId))
		.andThen((roundCount) => {
			const roundId = crypto.randomUUID();
			const roundNo = roundCount + 1;
			return repo
				.createRound({
					roundId,
					groupId,
					roundNo,
					tobiKillerId: input.tobiKillerId ?? null,
					rankOrder: input.rankOrder ?? null,
					results: input.results.map((r) => ({
						id: crypto.randomUUID(),
						roundId,
						playerId: r.playerId,
						rawPoints: r.rawPoints,
					})),
				})
				.map(() => ({ roundId, roundNo }));
		});
}

export function deleteRound(
	repo: RoundRepository,
	groupId: string,
	roundId: string,
): ResultAsync<void, AppError> {
	return repo
		.findRound(groupId, roundId)
		.andThen((round) =>
			round ? ok(undefined) : err(new AppError("Round not found", 404)),
		)
		.andThen(() => repo.deleteRound(roundId));
}
