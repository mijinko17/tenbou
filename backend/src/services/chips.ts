import { AppError } from "../errors";

export type ChipRepo = {
	findGroup(groupId: string): Promise<{ id: string } | null>;
	findPlayerIds(groupId: string): Promise<string[]>;
	upsertChips(
		groupId: string,
		chips: { playerId: string; count: number }[],
	): Promise<void>;
	deleteChips(groupId: string): Promise<void>;
};

export type UpdateChipsInput = {
	chips: { playerId: string; count: number }[];
};

export async function updateChips(
	repo: ChipRepo,
	groupId: string,
	input: UpdateChipsInput,
): Promise<void> {
	const group = await repo.findGroup(groupId);
	if (!group) throw new AppError("Group not found", 404);

	const groupPlayerIds = new Set(await repo.findPlayerIds(groupId));
	for (const chip of input.chips) {
		if (!groupPlayerIds.has(chip.playerId)) {
			throw new AppError("Invalid playerId");
		}
	}

	const total = input.chips.reduce((s, chip) => s + chip.count, 0);
	if (total !== 0) {
		throw new AppError("チップ収支の合計は0である必要があります");
	}

	await repo.upsertChips(groupId, input.chips);
}

export async function resetChips(
	repo: ChipRepo,
	groupId: string,
): Promise<void> {
	const group = await repo.findGroup(groupId);
	if (!group) throw new AppError("Group not found", 404);
	await repo.deleteChips(groupId);
}
