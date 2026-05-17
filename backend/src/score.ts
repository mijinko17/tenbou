import type * as schema from "./db/schema";

type Group = typeof schema.groups.$inferSelect;

export function computeRoundScores(
	results: { playerId: string; rawPoints: number }[],
	group: Group,
	tobiKillerId: string | null,
	rankOrder: string[] | null,
): { playerId: string; rawPoints: number; score: number }[] {
	const umas = [group.uma_1, group.uma_2, group.uma_3, group.uma_4];
	const oka = ((group.kaeshi - group.genten) / 1000) * 4;
	const tobiCount = results.filter((r) => r.rawPoints < 0).length;

	const ordered = rankOrder
		? rankOrder
		: [...results]
				.sort((a, b) => b.rawPoints - a.rawPoints)
				.map((r) => r.playerId);
	const rankMap = new Map(ordered.map((id, i) => [id, i]));

	return results.map((r) => {
		const rank = rankMap.get(r.playerId) ?? 0;
		let score = (r.rawPoints - group.kaeshi) / 1000 + umas[rank];

		if (r.rawPoints < 0) score -= group.tobi;
		if (tobiKillerId === r.playerId) score += group.tobi * tobiCount;
		if (rank === 0) score += oka;

		return { ...r, score: Math.round(score * 10) / 10 };
	});
}
