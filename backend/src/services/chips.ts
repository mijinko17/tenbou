import { type ResultAsync, err, ok } from "neverthrow";
import { AppError } from "../errors";

export type ChipRepo = {
	findGroup(groupId: string): ResultAsync<{ id: string } | null, AppError>;
	findPlayerIds(groupId: string): ResultAsync<string[], AppError>;
	upsertChips(
		groupId: string,
		chips: { playerId: string; count: number }[],
	): ResultAsync<void, AppError>;
	deleteChips(groupId: string): ResultAsync<void, AppError>;
};

export type UpdateChipsInput = {
	chips: { playerId: string; count: number }[];
};

export function updateChips(
	repo: ChipRepo,
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
	repo: ChipRepo,
	groupId: string,
): ResultAsync<void, AppError> {
	return repo
		.findGroup(groupId)
		.andThen((group) =>
			group ? ok(undefined) : err(new AppError("Group not found", 404)),
		)
		.andThen(() => repo.deleteChips(groupId));
}
