import { AppError } from "../errors";
import type * as schema from "../db/schema";

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

export async function createRound(
	repo: RoundRepo,
	groupId: string,
	input: CreateRoundInput,
): Promise<{ roundId: string; roundNo: number }> {
	const group = await repo.findGroup(groupId);
	if (!group) throw new AppError("Group not found", 404);

	const expectedSum = group.genten * 4;
	const actualSum = input.results.reduce((s, r) => s + r.rawPoints, 0);
	if (actualSum !== expectedSum) {
		throw new AppError(
			`素点の合計が${expectedSum}になっていません（現在: ${actualSum}）`,
		);
	}

	const groupPlayerIds = new Set(await repo.findPlayerIds(groupId));
	for (const r of input.results) {
		if (!groupPlayerIds.has(r.playerId)) {
			throw new AppError("Invalid playerId");
		}
	}

	const pointCounts = new Map<number, number>();
	for (const r of input.results) {
		pointCounts.set(r.rawPoints, (pointCounts.get(r.rawPoints) ?? 0) + 1);
	}
	const hasTies = [...pointCounts.values()].some((c) => c > 1);
	if (hasTies && !input.rankOrder) {
		throw new AppError("同点プレイヤーがいる場合、順位を指定してください");
	}
	if (input.rankOrder) {
		const rankSet = new Set(input.rankOrder);
		if (!input.results.every((r) => rankSet.has(r.playerId))) {
			throw new AppError("rankOrder に無効なプレイヤーIDが含まれています");
		}
		for (let i = 0; i < input.rankOrder.length - 1; i++) {
			const curr =
				input.results.find((r) => r.playerId === input.rankOrder?.[i])
					?.rawPoints ?? 0;
			const next =
				input.results.find((r) => r.playerId === input.rankOrder?.[i + 1])
					?.rawPoints ?? 0;
			if (curr < next) {
				throw new AppError("順位の指定が点数と矛盾しています");
			}
		}
	}

	const hasTobi = input.results.some((r) => r.rawPoints < 0);
	if (hasTobi && !input.tobiKillerId) {
		throw new AppError(
			"飛んだプレイヤーがいる場合、飛ばしたプレイヤーを指定してください",
		);
	}
	if (input.tobiKillerId) {
		const tobiPlayerIds = new Set(
			input.results.filter((r) => r.rawPoints < 0).map((r) => r.playerId),
		);
		if (tobiPlayerIds.has(input.tobiKillerId)) {
			throw new AppError(
				"飛ばしたプレイヤーは飛んだプレイヤー自身にはなれません",
			);
		}
		if (!groupPlayerIds.has(input.tobiKillerId)) {
			throw new AppError("Invalid tobiKillerId");
		}
	}

	const roundCount = await repo.countRounds(groupId);
	const roundId = crypto.randomUUID();
	const roundNo = roundCount + 1;

	await repo.createRound({
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
	});

	return { roundId, roundNo };
}

export async function deleteRound(
	repo: RoundRepo,
	groupId: string,
	roundId: string,
): Promise<void> {
	const round = await repo.findRound(groupId, roundId);
	if (!round) throw new AppError("Round not found", 404);
	await repo.deleteRound(roundId);
}
