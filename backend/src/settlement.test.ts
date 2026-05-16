import { describe, expect, it } from "vitest";
import { computeSettlement, goShaRokuNyu } from "./settlement";

const group = { rate: 1, chip_rate: 1000 };

const players = [
	{ id: "A", name: "Alice" },
	{ id: "B", name: "Bob" },
	{ id: "C", name: "Charlie" },
	{ id: "D", name: "Dave" },
];

describe("goShaRokuNyu", () => {
	it("小数第1位が0〜5は切り捨て", () => {
		expect(goShaRokuNyu(10.5)).toBe(10);
		expect(goShaRokuNyu(10.3)).toBe(10);
		expect(goShaRokuNyu(10.0)).toBe(10);
	});

	it("小数第1位が6〜9は切り上げ", () => {
		expect(goShaRokuNyu(10.6)).toBe(11);
		expect(goShaRokuNyu(10.9)).toBe(11);
	});

	it("負の数にも正しく適用", () => {
		// floor(-10.3)=-11, decimal=0.7→切り上げ → ceil(-10.3)=-10
		expect(goShaRokuNyu(-10.3)).toBe(-10);
		// floor(-10.7)=-11, decimal=0.3→切り捨て → floor(-10.7)=-11
		expect(goShaRokuNyu(-10.7)).toBe(-11);
	});
});

describe("computeSettlement - 立替調整", () => {
	it("支払者も被立替者に含む4人4000Gの立替は1000/1000/1000になる", () => {
		// 再現ケース: A が A,B,C,D 全員分 4000G を立替
		// per_person=1000, remainder=0 のとき支払者に余分な1Gが乗らないことを確認
		const payments = [
			{
				payer_id: "A",
				beneficiary_ids: JSON.stringify(["A", "B", "C", "D"]),
				amount: 4000,
			},
		];

		const { payments: result } = computeSettlement(
			group,
			players,
			[],
			[],
			payments,
		);

		const amounts = result.map((p) => p.amount).sort((a, b) => a - b);
		expect(amounts).toEqual([1000, 1000, 1000]);
		expect(result.every((p) => p.to === "A")).toBe(true);
	});

	it("支払者を除く3人への余りは登録順に1ずつ振り分けられる", () => {
		// A が B,C,D に 10G 立替。per_person=3, remainder=1 → B が4, C,D が3
		const payments = [
			{
				payer_id: "A",
				beneficiary_ids: JSON.stringify(["B", "C", "D"]),
				amount: 10,
			},
		];

		const { breakdown } = computeSettlement(
			group,
			players,
			[],
			[],
			payments,
		);

		const adj = Object.fromEntries(
			breakdown.map((r) => [r.playerId, r.advanceAdjustment]),
		);
		expect(adj.A).toBe(10);
		expect(adj.B).toBe(-4); // 登録順1位→余り1を負担
		expect(adj.C).toBe(-3);
		expect(adj.D).toBe(-3);
	});

	it("支払者が被立替者にも含まれる場合、支払者は余りの対象外", () => {
		// A が A,B,C に 10G 立替。per_person=3, remainder=1
		// remainderTargets = [B, C]（Aを除外）→ B が4, A,C が3
		const payments = [
			{
				payer_id: "A",
				beneficiary_ids: JSON.stringify(["A", "B", "C"]),
				amount: 10,
			},
		];

		const { breakdown } = computeSettlement(
			group,
			players,
			[],
			[],
			payments,
		);

		const adj = Object.fromEntries(
			breakdown.map((r) => [r.playerId, r.advanceAdjustment]),
		);
		expect(adj.A).toBe(10 - 3); // 受け取り10 - 被立替3 = +7
		expect(adj.B).toBe(-4);     // 登録順1位→余り1を負担
		expect(adj.C).toBe(-3);
	});

	it("最終収支の合計は常に0になる", () => {
		const payments = [
			{
				payer_id: "A",
				beneficiary_ids: JSON.stringify(["A", "B", "C", "D"]),
				amount: 4000,
			},
		];

		const { breakdown } = computeSettlement(
			group,
			players,
			[],
			[],
			payments,
		);

		const total = breakdown.reduce((s, r) => s + r.finalBalance, 0);
		expect(total).toBe(0);
	});
});
