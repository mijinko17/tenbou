import { AppError } from "../errors";

export type AdvancePaymentRepo = {
	findGroup(groupId: string): Promise<{ id: string } | null>;
	findPlayerIds(groupId: string): Promise<string[]>;
	createPayment(data: {
		id: string;
		groupId: string;
		payerId: string;
		beneficiaryIds: string[];
		description: string;
		amount: number;
		createdAt: number;
	}): Promise<void>;
	findPayment(
		groupId: string,
		paymentId: string,
	): Promise<{ id: string } | null>;
	deletePayment(paymentId: string): Promise<void>;
};

export type CreateAdvancePaymentInput = {
	payerId: string;
	beneficiaryIds: string[];
	description: string;
	amount: number;
};

export async function createAdvancePayment(
	repo: AdvancePaymentRepo,
	groupId: string,
	input: CreateAdvancePaymentInput,
): Promise<void> {
	const group = await repo.findGroup(groupId);
	if (!group) throw new AppError("Group not found", 404);

	const groupPlayerIds = new Set(await repo.findPlayerIds(groupId));
	if (!groupPlayerIds.has(input.payerId)) {
		throw new AppError("Invalid payerId");
	}
	for (const bid of input.beneficiaryIds) {
		if (!groupPlayerIds.has(bid)) {
			throw new AppError("Invalid beneficiaryId");
		}
	}
	if (input.beneficiaryIds.every((bid) => bid === input.payerId)) {
		throw new AppError("立替対象が立替者のみのケースは登録できません");
	}

	await repo.createPayment({
		id: crypto.randomUUID(),
		groupId,
		payerId: input.payerId,
		beneficiaryIds: input.beneficiaryIds,
		description: input.description,
		amount: input.amount,
		createdAt: Math.floor(Date.now() / 1000),
	});
}

export async function deleteAdvancePayment(
	repo: AdvancePaymentRepo,
	groupId: string,
	paymentId: string,
): Promise<void> {
	const payment = await repo.findPayment(groupId, paymentId);
	if (!payment) throw new AppError("Payment not found", 404);
	await repo.deletePayment(paymentId);
}
