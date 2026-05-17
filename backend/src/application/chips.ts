import { type ResultAsync, err, ok } from "neverthrow";
import type { ChipRepository } from "../domain/repositories/chip";
import { AppError } from "../errors";

export type UpdateChipsInput = {
	chips: { playerId: string; count: number }[];
};

export function updateChips(
	repo: ChipRepository,
	groupId: string,
	input: UpdateChipsInput,
): ResultAsync<void, AppError> {
	return repo
		.findGroup(groupId)
		.andThen((group) =>
			group ? ok(undefined) : err(new AppError("Group not found", 404)),
		)
		.andThen(() => repo.findPlayerIds(groupId))
		.andThen((ids) => {
			const groupPlayerIds = new Set(ids);
			for (const chip of input.chips) {
				if (!groupPlayerIds.has(chip.playerId)) {
					return err(new AppError("Invalid playerId"));
				}
			}
			const total = input.chips.reduce((s, chip) => s + chip.count, 0);
			if (total !== 0) {
				return err(new AppError("チップ収支の合計は0である必要があります"));
			}
			return ok(undefined);
		})
		.andThen(() => repo.upsertChips(groupId, input.chips));
}

export function resetChips(
	repo: ChipRepository,
	groupId: string,
): ResultAsync<void, AppError> {
	return repo
		.findGroup(groupId)
		.andThen((group) =>
			group ? ok(undefined) : err(new AppError("Group not found", 404)),
		)
		.andThen(() => repo.deleteChips(groupId));
}
