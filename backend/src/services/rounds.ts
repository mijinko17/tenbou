import { type Result, ResultAsync, err, ok } from "neverthrow";
import type * as schema from "../db/schema";
import { AppError } from "../errors";

type GroupRow = typeof schema.groups.$inferSelect;

export type RoundRepo = {
	findGroup(groupId: string): Promise<GroupRow | null>;
	findPlayerIds(groupId: string): Promise<string[]>;
	countRounds(groupId: string): Promise<number>;
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
	}): Promise<void>;
	findRound(groupId: string, roundId: string): Promise<{ id: string } | null>;
	deleteRound(roundId: string): Promise<void>;
};

export type CreateRoundInput = {
	results: { playerId: string; rawPoints: number }[];
	tobiKillerId?: string | null;
	rankOrder?: string[];
};

function validateSum(
	group: GroupRow,
	results: { rawPoints: number }[],
): Result<void, AppError> {
	const expectedSum = group.genten * 4;
	const actualSum = results.reduce((s, r) => s + r.rawPoints, 0);
	if (actualSum !== expectedSum) {
		return err(
			new AppError(
				`素点の合計が${expectedSum}になっていません（現在: ${actualSum}）`,
			),
		);
	}
	return ok(undefined);
}

function validatePlayerIds(
	results: { playerId: string }[],
	groupPlayerIds: Set<string>,
): Result<void, AppError> {
	for (const r of results) {
		if (!groupPlayerIds.has(r.playerId)) {
			return err(new AppError("Invalid playerId"));
		}
	}
	return ok(undefined);
}

function validateTies(input: CreateRoundInput): Result<void, AppError> {
	const pointCounts = new Map<number, number>();
	for (const r of input.results) {
		pointCounts.set(r.rawPoints, (pointCounts.get(r.rawPoints) ?? 0) + 1);
	}
	const hasTies = [...pointCounts.values()].some((c) => c > 1);
	if (hasTies && !input.rankOrder) {
		return err(
			new AppError("同点プレイヤーがいる場合、順位を指定してください"),
		);
	}
	if (input.rankOrder) {
		const rankSet = new Set(input.rankOrder);
		if (!input.results.every((r) => rankSet.has(r.playerId))) {
			return err(
				new AppError("rankOrder に無効なプレイヤーIDが含まれています"),
			);
		}
		for (let i = 0; i < input.rankOrder.length - 1; i++) {
			const curr =
				input.results.find((r) => r.playerId === input.rankOrder?.[i])
					?.rawPoints ?? 0;
			const next =
				input.results.find((r) => r.playerId === input.rankOrder?.[i + 1])
					?.rawPoints ?? 0;
			if (curr < next) {
				return err(new AppError("順位の指定が点数と矛盾しています"));
			}
		}
	}
	return ok(undefined);
}

function validateTobi(
	input: CreateRoundInput,
	groupPlayerIds: Set<string>,
): Result<void, AppError> {
	const hasTobi = input.results.some((r) => r.rawPoints < 0);
	if (hasTobi && !input.tobiKillerId) {
		return err(
			new AppError(
				"飛んだプレイヤーがいる場合、飛ばしたプレイヤーを指定してください",
			),
		);
	}
	if (input.tobiKillerId) {
		const tobiPlayerIds = new Set(
			input.results.filter((r) => r.rawPoints < 0).map((r) => r.playerId),
		);
		if (tobiPlayerIds.has(input.tobiKillerId)) {
			return err(
				new AppError("飛ばしたプレイヤーは飛んだプレイヤー自身にはなれません"),
			);
		}
		if (!groupPlayerIds.has(input.tobiKillerId)) {
			return err(new AppError("Invalid tobiKillerId"));
		}
	}
	return ok(undefined);
}

export function createRound(
	repo: RoundRepo,
	groupId: string,
	input: CreateRoundInput,
): ResultAsync<{ roundId: string; roundNo: number }, AppError> {
	return ResultAsync.fromSafePromise(repo.findGroup(groupId))
		.andThen((group) =>
			group ? ok(group) : err(new AppError("Group not found", 404)),
		)
		.andThen((group) => validateSum(group, input.results))
		.andThen(() => ResultAsync.fromSafePromise(repo.findPlayerIds(groupId)))
		.map((ids) => new Set(ids))
		.andThen((groupPlayerIds) =>
			validatePlayerIds(input.results, groupPlayerIds)
				.andThen(() => validateTies(input))
				.andThen(() => validateTobi(input, groupPlayerIds)),
		)
		.andThen(() => ResultAsync.fromSafePromise(repo.countRounds(groupId)))
		.andThen((roundCount) => {
			const roundId = crypto.randomUUID();
			const roundNo = roundCount + 1;
			return ResultAsync.fromSafePromise(
				repo.createRound({
					roundId,
					groupId,
					roundNo,
					tobiKillerId: input.tobiKillerId ?? null,
					rankOrder: input.rankOrder ?? null,
					results: input.results.map((r) => ({
						id: crypto.randomUUID(),
						roundId,
						playerId: r.playerId,
						rawPoints: r.rawPoints,
					})),
				}),
			).map(() => ({ roundId, roundNo }));
		});
}

export function deleteRound(
	repo: RoundRepo,
	groupId: string,
	roundId: string,
): ResultAsync<void, AppError> {
	return ResultAsync.fromSafePromise(repo.findRound(groupId, roundId))
		.andThen((round) =>
			round ? ok(undefined) : err(new AppError("Round not found", 404)),
		)
		.andThen(() => ResultAsync.fromSafePromise(repo.deleteRound(roundId)));
}
