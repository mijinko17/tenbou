import { AppError } from "../errors";
import { computeRoundScores } from "../score";
import { computeSettlement } from "../settlement";
import type { RoundData } from "./groups";
import type * as schema from "../db/schema";

type GroupRow = typeof schema.groups.$inferSelect;

export type SettlementRepo = {
	findGroup(groupId: string): Promise<GroupRow | null>;
	findPlayers(groupId: string): Promise<{ id: string; name: string }[]>;
	findRoundsWithResults(groupId: string): Promise<RoundData[]>;
	findChips(groupId: string): Promise<{ playerId: string; count: number }[]>;
	findAdvancePayments(
		groupId: string,
	): Promise<{ payer_id: string; beneficiary_ids: string; amount: number }[]>;
};

export async function getSettlement(
	repo: SettlementRepo,
	groupId: string,
) {
	const group = await repo.findGroup(groupId);
	if (!group) throw new AppError("Group not found", 404);

	const [players, rounds, chipRows, advancePaymentRows] = await Promise.all([
		repo.findPlayers(groupId),
		repo.findRoundsWithResults(groupId),
		repo.findChips(groupId),
		repo.findAdvancePayments(groupId),
	]);

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
}
