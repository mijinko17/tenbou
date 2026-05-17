import type * as schema from "../db/schema";
import { AppError } from "../errors";
import { computeRoundScores } from "../score";

type GroupRow = typeof schema.groups.$inferSelect;

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

export type GroupRepo = {
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
	}): Promise<void>;
	findGroup(groupId: string): Promise<GroupRow | null>;
	findPlayers(groupId: string): Promise<{ id: string; name: string }[]>;
	findRoundsWithResults(groupId: string): Promise<RoundData[]>;
	findChips(groupId: string): Promise<{ playerId: string; count: number }[]>;
	findAdvancePayments(groupId: string): Promise<AdvancePaymentData[]>;
	findPlayerInGroup(
		groupId: string,
		playerId: string,
	): Promise<{ id: string } | null>;
	countPlayers(groupId: string): Promise<number>;
	deletePlayer(playerId: string): Promise<void>;
};

export type CreateGroupInput = {
	name: string;
	players: string[];
	rate: number;
	chipRate: number;
	uma: [number, number, number, number];
	tobi: number;
	genten: number;
	kaeshi: number;
};

export async function createGroup(
	repo: GroupRepo,
	input: CreateGroupInput,
): Promise<{ groupId: string }> {
	const groupId = crypto.randomUUID();
	const players = input.players.map((name) => ({
		id: crypto.randomUUID(),
		name,
	}));
	await repo.createGroup({
		groupId,
		name: input.name,
		rate: input.rate,
		chipRate: input.chipRate,
		uma: input.uma,
		tobi: input.tobi,
		genten: input.genten,
		kaeshi: input.kaeshi,
		players,
	});
	return { groupId };
}

export async function getGroup(repo: GroupRepo, groupId: string) {
	const group = await repo.findGroup(groupId);
	if (!group) throw new AppError("Group not found", 404);

	const [players, rounds, chips, advancePayments] = await Promise.all([
		repo.findPlayers(groupId),
		repo.findRoundsWithResults(groupId),
		repo.findChips(groupId),
		repo.findAdvancePayments(groupId),
	]);

	const roundsWithScores = rounds.map((round) => ({
		id: round.id,
		roundNo: round.roundNo,
		playedAt: round.playedAt,
		tobiKillerId: round.tobiKillerId,
		results: computeRoundScores(
			round.results,
			group,
			round.tobiKillerId,
			round.rankOrder,
		),
	}));

	return { group, players, rounds: roundsWithScores, chips, advancePayments };
}

export async function deletePlayer(
	repo: GroupRepo,
	groupId: string,
	playerId: string,
): Promise<void> {
	const player = await repo.findPlayerInGroup(groupId, playerId);
	if (!player) throw new AppError("Player not found", 404);

	const count = await repo.countPlayers(groupId);
	if (count <= 4) {
		throw new AppError(
			"Cannot delete: group must have at least 4 players",
			409,
		);
	}

	await repo.deletePlayer(playerId);
}
