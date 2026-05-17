import type { ResultAsync } from "neverthrow";
import type { AppError } from "../../errors";

export type ChipRepository = {
	findGroup(groupId: string): ResultAsync<{ id: string } | null, AppError>;
	findPlayerIds(groupId: string): ResultAsync<string[], AppError>;
	upsertChips(
		groupId: string,
		chips: { playerId: string; count: number }[],
	): ResultAsync<void, AppError>;
	deleteChips(groupId: string): ResultAsync<void, AppError>;
};
