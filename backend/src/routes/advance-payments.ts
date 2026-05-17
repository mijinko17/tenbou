import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { createAdvancePaymentRepository } from "../repositories/advance-payments";
import {
	createAdvancePayment,
	deleteAdvancePayment,
} from "../services/advance-payments";
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
		await createAdvancePayment(
			repo,
			c.req.param("groupId"),
			c.req.valid("json"),
		);
		return c.json({ success: true }, 201);
	},
);

advancePayments.delete("/:groupId/advance-payments/:paymentId", async (c) => {
	const { groupId, paymentId } = c.req.param();
	const db = drizzle(c.env.DB);
	const repo = createAdvancePaymentRepository(db);
	await deleteAdvancePayment(repo, groupId, paymentId);
	return c.json({ success: true });
});

export default advancePayments;
