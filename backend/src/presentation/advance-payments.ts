import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import {
	createAdvancePayment,
	deleteAdvancePayment,
} from "../application/advance-payments";
import { createAdvancePaymentRepository } from "../infrastructure/repositories/advance-payment";
import type { Env } from "../types";

const advancePayments = new Hono<{ Bindings: Env }>();

const createAdvancePaymentSchema = z.object({
	payerId: z.string().uuid(),
	beneficiaryIds: z.array(z.string().uuid()).min(1),
	description: z.string().min(1).max(100),
	amount: z.number().int().positive(),
});

advancePayments.post(
	"/:groupId/advance-payments",
	zValidator("json", createAdvancePaymentSchema),
	async (c) => {
		const db = drizzle(c.env.DB);
		const repo = createAdvancePaymentRepository(db);
		const result = await createAdvancePayment(
			repo,
			c.req.param("groupId"),
			c.req.valid("json"),
		);
		return result.match(
			() => c.json({ success: true }, 201),
			(err) => c.json({ error: err.message }, err.status),
		);
	},
);

advancePayments.delete("/:groupId/advance-payments/:paymentId", async (c) => {
	const { groupId, paymentId } = c.req.param();
	const db = drizzle(c.env.DB);
	const repo = createAdvancePaymentRepository(db);
	const result = await deleteAdvancePayment(repo, groupId, paymentId);
	return result.match(
		() => c.json({ success: true }),
		(err) => c.json({ error: err.message }, err.status),
	);
});

export default advancePayments;
