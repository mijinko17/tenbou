import type { ResultAsync } from "neverthrow";
import type { AppError } from "../../errors";
import type { Group } from "../group";
import type { AdvancePaymentRow } from "../settlement";
import type { RoundData } from "./group";

export type SettlementRepository = {
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
	): ResultAsync<AdvancePaymentRow[], AppError>;
};
