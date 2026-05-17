import type { ResultAsync } from "neverthrow";
import type { AppError } from "../../errors";
import type { Group } from "../group";

export type RoundData = {
	id: string;
	roundNo: number;
	playedAt: string;
	tobiKillerId: string | null;
	rankOrder: string[] | null;
	results: { playerId: string; rawPoints: number }[];
};

export type AdvancePaymentData = {
	id: string;
	payerId: string;
	beneficiaryIds: string[];
	description: string;
	amount: number;
	createdAt: number;
};

export type GroupRepository = {
	createGroup(data: {
		groupId: string;
		name: string;
		rate: number;
		chipRate: number;
		uma: [number, number, number, number];
		tobi: number;
		genten: number;
		kaeshi: number;
		players: { id: string; name: string }[];
	}): ResultAsync<void, AppError>;
	findGroup(groupId: string): ResultAsync<Group | null, AppError>;
	findPlayers(
		groupId: string,
	): ResultAsync<{ id: string; name: string }[], AppError>;
	findRoundsWithResults(groupId: string): ResultAsync<RoundData[], AppError>;
	findChips(
		groupId: string,
	): ResultAsync<{ playerId: string; count: number }[], AppError>;
	findAdvancePayments(
		groupId: string,
	): ResultAsync<AdvancePaymentData[], AppError>;
	findPlayerInGroup(
		groupId: string,
		playerId: string,
	): ResultAsync<{ id: string } | null, AppError>;
	countPlayers(groupId: string): ResultAsync<number, AppError>;
	deletePlayer(playerId: string): ResultAsync<void, AppError>;
};
