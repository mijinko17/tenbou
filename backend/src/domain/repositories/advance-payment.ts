import type { ResultAsync } from "neverthrow";
import type { AppError } from "../../errors";

export type AdvancePaymentRepository = {
	findGroup(groupId: string): ResultAsync<{ id: string } | null, AppError>;
	findPlayerIds(groupId: string): ResultAsync<string[], AppError>;
	createPayment(data: {
		id: string;
		groupId: string;
		payerId: string;
		beneficiaryIds: string[];
		description: string;
		amount: number;
		createdAt: number;
	}): ResultAsync<void, AppError>;
	findPayment(
		groupId: string,
		paymentId: string,
	): ResultAsync<{ id: string } | null, AppError>;
	deletePayment(paymentId: string): ResultAsync<void, AppError>;
};
