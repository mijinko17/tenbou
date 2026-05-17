import type { ResultAsync } from "neverthrow";
import type { AppError } from "../../errors";
import type { Group } from "../group";

export type RoundRepository = {
	findGroup(groupId: string): ResultAsync<Group | null, AppError>;
	findPlayerIds(groupId: string): ResultAsync<string[], AppError>;
	countRounds(groupId: string): ResultAsync<number, AppError>;
	createRound(data: {
		roundId: string;
		groupId: string;
		roundNo: number;
		tobiKillerId: string | null;
		rankOrder: string[] | null;
		results: {
			id: string;
			roundId: string;
			playerId: string;
			rawPoints: number;
		}[];
	}): ResultAsync<void, AppError>;
	findRound(
		groupId: string,
		roundId: string,
	): ResultAsync<{ id: string } | null, AppError>;
	deleteRound(roundId: string): ResultAsync<void, AppError>;
};
