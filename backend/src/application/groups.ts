import { ResultAsync, err, errAsync, ok } from "neverthrow";
import type { Group } from "../domain/group";
import type {
	AdvancePaymentData,
	GroupRepository,
} from "../domain/repositories/group";
import { computeRoundScores } from "../domain/score";
import { AppError } from "../errors";

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
	repo: GroupRepository,
	input: CreateGroupInput,
): ResultAsync<{ groupId: string }, AppError> {
	const umaSum = input.uma.reduce((s, v) => s + v, 0);
	if (umaSum !== 0) {
		return errAsync(new AppError("ウマの合計は0である必要があります"));
	}
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
	repo: GroupRepository,
	groupId: string,
): ResultAsync<
	{
		group: Group;
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
