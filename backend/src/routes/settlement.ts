import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { createSettlementRepository } from "../repositories/settlement";
import { getSettlement } from "../services/settlement";
import type { Env } from "../types";

const settlement = new Hono<{ Bindings: Env }>();

settlement.get("/:groupId/settlement", async (c) => {
	const db = drizzle(c.env.DB);
	const repo = createSettlementRepository(db);
	const result = await getSettlement(repo, c.req.param("groupId"));
	return result.match(
		(data) => c.json(data),
		(err) => c.json({ error: err.message }, err.status),
	);
});

export default settlement;
