import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import * as schema from "../db/schema";
import type { Env } from "../types";

const chips = new Hono<{ Bindings: Env }>();

const updateChipsSchema = z.object({
	chips: z.array(
		z.object({
			playerId: z.string().uuid(),
			count: z.number().int(),
		}),
	),
});

chips.put(
	"/:groupId/chips",
	zValidator("json", updateChipsSchema),
	async (c) => {
		const { groupId } = c.req.param();
		const body = c.req.valid("json");
		const db = drizzle(c.env.DB);

		const [group] = await db
			.select({ id: schema.groups.id })
			.from(schema.groups)
			.where(eq(schema.groups.id, groupId))
			.limit(1);
		if (!group) return c.json({ error: "Group not found" }, 404);

		const groupPlayers = await db
			.select({ id: schema.players.id })
			.from(schema.players)
			.where(eq(schema.players.group_id, groupId));
		const groupPlayerIds = new Set(groupPlayers.map((p) => p.id));

		for (const chip of body.chips) {
			if (!groupPlayerIds.has(chip.playerId)) {
				return c.json({ error: "Invalid playerId" }, 422);
			}
		}

		const total = body.chips.reduce((s, chip) => s + chip.count, 0);
		if (total !== 0) {
			return c.json(
				{ error: "チップ収支の合計は0である必要があります" },
				422,
			);
		}

		await Promise.all(
			body.chips.map((chip) =>
				db
					.insert(schema.chip_totals)
					.values({
						id: crypto.randomUUID(),
						group_id: groupId,
						player_id: chip.playerId,
						chips: chip.count,
					})
					.onConflictDoUpdate({
						target: [
							schema.chip_totals.group_id,
							schema.chip_totals.player_id,
						],
						set: { chips: chip.count },
					}),
			),
		);

		return c.json({ success: true });
	},
);

chips.delete("/:groupId/chips", async (c) => {
	const { groupId } = c.req.param();
	const db = drizzle(c.env.DB);

	const [group] = await db
		.select({ id: schema.groups.id })
		.from(schema.groups)
		.where(eq(schema.groups.id, groupId))
		.limit(1);

	if (!group) return c.json({ error: "Group not found" }, 404);

	await db
		.delete(schema.chip_totals)
		.where(eq(schema.chip_totals.group_id, groupId));

	return new Response(null, { status: 204 });
});

export default chips;
