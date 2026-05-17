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
		const result = await updateChips(
			repo,
			c.req.param("groupId"),
			c.req.valid("json"),
		);
		return result.match(
			() => c.json({ success: true }),
			(err) => c.json({ error: err.message }, err.status),
		);
	},
);

chips.delete("/:groupId/chips", async (c) => {
	const db = drizzle(c.env.DB);
	const repo = createChipRepository(db);
	const result = await resetChips(repo, c.req.param("groupId"));
	return result.match(
		() => new Response(null, { status: 204 }),
		(err) => c.json({ error: err.message }, err.status),
	);
});

export default chips;
