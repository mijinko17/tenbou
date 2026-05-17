import { zValidator } from "@hono/zod-validator";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import * as schema from "../db/schema";
import type { Env } from "../types";

const rounds = new Hono<{ Bindings: Env }>();

const createRoundSchema = z.object({
	results: z
		.array(
			z.object({
				playerId: z.string().uuid(),
				rawPoints: z.number().int(),
			}),
		)
		.length(4),
	tobiKillerId: z.string().uuid().nullable().optional(),
	rankOrder: z.array(z.string().uuid()).length(4).optional(),
});

rounds.post(
	"/:groupId/rounds",
	zValidator("json", createRoundSchema),
	async (c) => {
		const { groupId } = c.req.param();
		const body = c.req.valid("json");
		const db = drizzle(c.env.DB);

		const [group] = await db
			.select()
			.from(schema.groups)
			.where(eq(schema.groups.id, groupId))
			.limit(1);

		if (!group) return c.json({ error: "Group not found" }, 404);

		const expectedSum = group.genten * 4;
		const actualSum = body.results.reduce((s, r) => s + r.rawPoints, 0);
		if (actualSum !== expectedSum) {
			return c.json(
				{
					error: `素点の合計が${expectedSum}になっていません（現在: ${actualSum}）`,
				},
				422,
			);
		}

		const groupPlayers = await db
			.select({ id: schema.players.id })
			.from(schema.players)
			.where(eq(schema.players.group_id, groupId));

		const groupPlayerIds = new Set(groupPlayers.map((p) => p.id));
		for (const r of body.results) {
			if (!groupPlayerIds.has(r.playerId)) {
				return c.json({ error: "Invalid playerId" }, 422);
			}
		}

		const pointCounts = new Map<number, number>();
		for (const r of body.results) {
			pointCounts.set(r.rawPoints, (pointCounts.get(r.rawPoints) ?? 0) + 1);
		}
		const hasTies = [...pointCounts.values()].some((c) => c > 1);
		if (hasTies && !body.rankOrder) {
			return c.json(
				{ error: "同点プレイヤーがいる場合、順位を指定してください" },
				422,
			);
		}
		if (body.rankOrder) {
			const rankSet = new Set(body.rankOrder);
			const allPresent = body.results.every((r) => rankSet.has(r.playerId));
			if (!allPresent) {
				return c.json(
					{ error: "rankOrder に無効なプレイヤーIDが含まれています" },
					422,
				);
			}
			for (let i = 0; i < body.rankOrder.length - 1; i++) {
				const curr =
					body.results.find((r) => r.playerId === body.rankOrder?.[i])
						?.rawPoints ?? 0;
				const next =
					body.results.find((r) => r.playerId === body.rankOrder?.[i + 1])
						?.rawPoints ?? 0;
				if (curr < next) {
					return c.json({ error: "順位の指定が点数と矛盾しています" }, 422);
				}
			}
		}

		const hasTobi = body.results.some((r) => r.rawPoints < 0);
		if (hasTobi && !body.tobiKillerId) {
			return c.json(
				{
					error: "飛んだプレイヤーがいる場合、飛ばしたプレイヤーを指定してください",
				},
				422,
			);
		}
		if (body.tobiKillerId) {
			const tobiPlayerIds = new Set(
				body.results.filter((r) => r.rawPoints < 0).map((r) => r.playerId),
			);
			if (tobiPlayerIds.has(body.tobiKillerId)) {
				return c.json(
					{ error: "飛ばしたプレイヤーは飛んだプレイヤー自身にはなれません" },
					422,
				);
			}
			if (!groupPlayerIds.has(body.tobiKillerId)) {
				return c.json({ error: "Invalid tobiKillerId" }, 422);
			}
		}

		const [{ count }] = await db
			.select({ count: sql<number>`count(*)` })
			.from(schema.game_rounds)
			.where(eq(schema.game_rounds.group_id, groupId));

		const roundId = crypto.randomUUID();
		const roundNo = (count ?? 0) + 1;

		await db.batch([
			db.insert(schema.game_rounds).values({
				id: roundId,
				group_id: groupId,
				round_no: roundNo,
				tobi_killer_id: body.tobiKillerId ?? null,
				rank_order: body.rankOrder ? JSON.stringify(body.rankOrder) : null,
			}),
			...body.results.map((r) =>
				db.insert(schema.game_results).values({
					id: crypto.randomUUID(),
					round_id: roundId,
					player_id: r.playerId,
					raw_points: r.rawPoints,
				}),
			),
		] as Parameters<typeof db.batch>[0]);

		return c.json({ roundId, roundNo }, 201);
	},
);

rounds.delete("/:groupId/rounds/:roundId", async (c) => {
	const { groupId, roundId } = c.req.param();
	const db = drizzle(c.env.DB);

	const [round] = await db
		.select({ id: schema.game_rounds.id })
		.from(schema.game_rounds)
		.where(
			and(
				eq(schema.game_rounds.id, roundId),
				eq(schema.game_rounds.group_id, groupId),
			),
		)
		.limit(1);

	if (!round) return c.json({ error: "Round not found" }, 404);

	await db.batch([
		db
			.delete(schema.game_results)
			.where(eq(schema.game_results.round_id, roundId)),
		db.delete(schema.game_rounds).where(eq(schema.game_rounds.id, roundId)),
	] as Parameters<typeof db.batch>[0]);

	return new Response(null, { status: 204 });
});

export default rounds;
