import { ResultAsync, err, ok } from "neverthrow";
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
	}): ResultAsync<void, AppError>;
	findGroup(groupId: string): ResultAsync<GroupRow | null, AppError>;
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

export function createGroup(
	repo: GroupRepo,
	input: CreateGroupInput,
): ResultAsync<{ groupId: string }, AppError> {
	const groupId = crypto.randomUUID();
	const players = input.players.map((name) => ({
		id: crypto.randomUUID(),
		name,
	}));
	return repo
		.createGroup({
			groupId,
			name: input.name,
			rate: input.rate,
			chipRate: input.chipRate,
			uma: input.uma,
			tobi: input.tobi,
			genten: input.genten,
			kaeshi: input.kaeshi,
			players,
		})
		.map(() => ({ groupId }));
}

export function getGroup(
	repo: GroupRepo,
	groupId: string,
): ResultAsync<
	{
		group: GroupRow;
		players: { id: string; name: string }[];
		rounds: {
			id: string;
			roundNo: number;
			playedAt: string;
			tobiKillerId: string | null;
			results: { playerId: string; rawPoints: number; score: number }[];
		}[];
		chips: { playerId: string; count: number }[];
		advancePayments: AdvancePaymentData[];
	},
	AppError
> {
	return repo
		.findGroup(groupId)
		.andThen((group) =>
			group ? ok(group) : err(new AppError("Group not found", 404)),
		)
		.andThen((group) =>
			ResultAsync.combine([
				repo.findPlayers(groupId),
				repo.findRoundsWithResults(groupId),
				repo.findChips(groupId),
				repo.findAdvancePayments(groupId),
			]).map(([players, rounds, chips, advancePayments]) => ({
				group,
				players,
				rounds: rounds.map((round) => ({
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
				})),
				chips,
				advancePayments,
			})),
		);
}

export function deletePlayer(
	repo: GroupRepo,
	groupId: string,
	playerId: string,
): ResultAsync<void, AppError> {
	return repo
		.findPlayerInGroup(groupId, playerId)
		.andThen((player) =>
			player ? ok(undefined) : err(new AppError("Player not found", 404)),
		)
		.andThen(() => repo.countPlayers(groupId))
		.andThen((count) =>
			count <= 4
				? err(
						new AppError(
							"Cannot delete: group must have at least 4 players",
							409,
						),
					)
				: ok(undefined),
		)
		.andThen(() => repo.deletePlayer(playerId));
}
