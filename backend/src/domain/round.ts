import { type Result, err, ok } from "neverthrow";
import { AppError } from "../errors";
import type { Group } from "./group";

export type RoundInput = {
	results: { playerId: string; rawPoints: number }[];
	tobiKillerId?: string | null;
	rankOrder?: string[];
};

export function validateSum(
	group: Group,
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

export function validatePlayerIds(
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

export function validateTies(input: RoundInput): Result<void, AppError> {
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

export function validateTobi(
	input: RoundInput,
	groupPlayerIds: Set<string>,
): Result<void, AppError> {
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
