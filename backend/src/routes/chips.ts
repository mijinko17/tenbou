import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { createChipRepository } from "../repositories/chips";
import { resetChips, updateChips } from "../services/chips";
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
		const db = drizzle(c.env.DB);
		const repo = createChipRepository(db);
		await updateChips(repo, c.req.param("groupId"), c.req.valid("json"));
		return c.json({ success: true });
	},
);

chips.delete("/:groupId/chips", async (c) => {
	const db = drizzle(c.env.DB);
	const repo = createChipRepository(db);
	await resetChips(repo, c.req.param("groupId"));
	return new Response(null, { status: 204 });
});

export default chips;
