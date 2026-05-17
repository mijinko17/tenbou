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

export function createGroup(
	repo: GroupRepo,
	input: CreateGroupInput,
): ResultAsync<{ groupId: string }, AppError> {
	const groupId = crypto.randomUUID();
	const players = input.players.map((name) => ({
		id: crypto.randomUUID(),
		name,
	}));
	return ResultAsync.fromSafePromise(
		repo.createGroup({
			groupId,
			name: input.name,
			rate: input.rate,
			chipRate: input.chipRate,
			uma: input.uma,
			tobi: input.tobi,
			genten: input.genten,
			kaeshi: input.kaeshi,
			players,
		}),
	).map(() => ({ groupId }));
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
	return ResultAsync.fromSafePromise(repo.findGroup(groupId))
		.andThen((group) =>
			group ? ok(group) : err(new AppError("Group not found", 404)),
		)
		.andThen((group) =>
			ResultAsync.fromSafePromise(
				Promise.all([
					repo.findPlayers(groupId),
					repo.findRoundsWithResults(groupId),
					repo.findChips(groupId),
					repo.findAdvancePayments(groupId),
				]),
			).map(([players, rounds, chips, advancePayments]) => ({
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
	return ResultAsync.fromSafePromise(repo.findPlayerInGroup(groupId, playerId))
		.andThen((player) =>
			player ? ok(undefined) : err(new AppError("Player not found", 404)),
		)
		.andThen(() => ResultAsync.fromSafePromise(repo.countPlayers(groupId)))
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
		.andThen(() => ResultAsync.fromSafePromise(repo.deletePlayer(playerId)));
}
