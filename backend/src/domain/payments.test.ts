import { describe, expect, it } from "vitest";
import { minimizePayments } from "./payments";
import type { Payment } from "./payments";

// payments を適用したときの playerId の純収支を返す
function netBalance(payments: Payment[], playerId: string): number {
	const received = payments
		.filter((p) => p.to === playerId)
		.reduce((s, p) => s + p.amount, 0);
	const paid = payments
		.filter((p) => p.from === playerId)
		.reduce((s, p) => s + p.amount, 0);
	return received - paid;
}

describe("minimizePayments", () => {
	it("全員の収支が0のとき支払いは発生しない", () => {
		const payments = minimizePayments([
			{ playerId: "A", balance: 0 },
			{ playerId: "B", balance: 0 },
			{ playerId: "C", balance: 0 },
		]);

		expect(payments).toHaveLength(0);
	});

	it("2者間：支払い後の収支が入力と一致する", () => {
		const balances = [
			{ playerId: "A", balance: 10 },
			{ playerId: "B", balance: -10 },
		];

		const payments = minimizePayments(balances);

		for (const { playerId, balance } of balances) {
			expect(netBalance(payments, playerId)).toBe(balance);
		}
	});

	it("債権者1人・債務者2人：支払い後の収支が入力と一致する", () => {
		const balances = [
			{ playerId: "A", balance: 10 },
			{ playerId: "B", balance: -3 },
			{ playerId: "C", balance: -7 },
		];

		const payments = minimizePayments(balances);

		for (const { playerId, balance } of balances) {
			expect(netBalance(payments, playerId)).toBe(balance);
		}
	});

	it("債権者2人・債務者1人：支払い後の収支が入力と一致する", () => {
		const balances = [
			{ playerId: "A", balance: 7 },
			{ playerId: "B", balance: 3 },
			{ playerId: "C", balance: -10 },
		];

		const payments = minimizePayments(balances);

		for (const { playerId, balance } of balances) {
			expect(netBalance(payments, playerId)).toBe(balance);
		}
	});

	it("債権者2人・債務者2人：支払い後の収支が入力と一致する", () => {
		const balances = [
			{ playerId: "A", balance: 15 },
			{ playerId: "B", balance: -5 },
			{ playerId: "C", balance: 5 },
			{ playerId: "D", balance: -15 },
		];

		const payments = minimizePayments(balances);

		for (const { playerId, balance } of balances) {
			expect(netBalance(payments, playerId)).toBe(balance);
		}
	});

	it("債務者1人・債権者3人：支払い後の収支が入力と一致する", () => {
		const balances = [
			{ playerId: "A", balance: 1250 },
			{ playerId: "B", balance: 870 },
			{ playerId: "C", balance: 430 },
			{ playerId: "D", balance: -2550 },
		];

		const payments = minimizePayments(balances);

		for (const { playerId, balance } of balances) {
			expect(netBalance(payments, playerId)).toBe(balance);
		}
	});

	it("債務者3人・債権者1人：支払い後の収支が入力と一致する", () => {
		const balances = [
			{ playerId: "A", balance: 3100 },
			{ playerId: "B", balance: -1800 },
			{ playerId: "C", balance: -800 },
			{ playerId: "D", balance: -500 },
		];

		const payments = minimizePayments(balances);

		for (const { playerId, balance } of balances) {
			expect(netBalance(payments, playerId)).toBe(balance);
		}
	});
});
