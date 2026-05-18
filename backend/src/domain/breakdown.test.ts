import { describe, expect, it } from "vitest";
import { computeBreakdown } from "./breakdown";

const group = { rate: 1, chip_rate: 1000 };

const players = [
	{ id: "A", name: "Alice" },
	{ id: "B", name: "Bob" },
	{ id: "C", name: "Charlie" },
	{ id: "D", name: "Dave" },
];

function toMap<T extends { playerId: string }>(
	breakdown: T[],
	key: keyof T,
): Record<string, number> {
	return Object.fromEntries(
		breakdown.map((r) => [r.playerId, r[key] as number]),
	);
}

function sumFinalBalance(breakdown: { finalBalance: number }[]): number {
	return breakdown.reduce((s, r) => s + r.finalBalance, 0);
}

describe("computeBreakdown - ゲーム成績のみ", () => {
	it("gameScoreTotalとfinalBalanceが正しく計算され、合計が0になる", () => {
		const breakdown = computeBreakdown(
			group,
			players,
			[
				[
					{ playerId: "A", score: 25 },
					{ playerId: "B", score: 5 },
					{ playerId: "C", score: -5 },
					{ playerId: "D", score: -25 },
				],
			],
			[],
			[],
		);

		const totals = toMap(breakdown, "gameScoreTotal");
		expect(totals.A).toBe(25);
		expect(totals.B).toBe(5);
		expect(totals.C).toBe(-5);
		expect(totals.D).toBe(-25);

		const fb = toMap(breakdown, "finalBalance");
		expect(fb.A).toBe(25);
		expect(fb.B).toBe(5);
		expect(fb.C).toBe(-5);
		expect(fb.D).toBe(-25);

		expect(sumFinalBalance(breakdown)).toBe(0);
	});
});

describe("computeBreakdown - チップのみ", () => {
	it("chipScoreとfinalBalanceが正しく計算され、合計が0になる", () => {
		// chip_rate=1000: chipScore = count * 1000 / 1000 = count
		const breakdown = computeBreakdown(
			group,
			players,
			[],
			[
				{ playerId: "A", count: 10 },
				{ playerId: "B", count: -5 },
				{ playerId: "C", count: -3 },
				{ playerId: "D", count: -2 },
			],
			[],
		);

		const chips = toMap(breakdown, "chipScore");
		expect(chips.A).toBe(10);
		expect(chips.B).toBe(-5);
		expect(chips.C).toBe(-3);
		expect(chips.D).toBe(-2);

		const fb = toMap(breakdown, "finalBalance");
		expect(fb.A).toBe(10);
		expect(fb.B).toBe(-5);
		expect(fb.C).toBe(-3);
		expect(fb.D).toBe(-2);

		expect(sumFinalBalance(breakdown)).toBe(0);
	});
});

describe("computeBreakdown - 立替のみ", () => {
	it("advanceAdjustmentとfinalBalanceが正しく計算され、合計が0になる", () => {
		// A が [A, B, C, D] に 1200G 立替 → per_person=300, remainder=0
		const breakdown = computeBreakdown(
			group,
			players,
			[],
			[],
			[
				{
					payer_id: "A",
					beneficiary_ids: JSON.stringify(["A", "B", "C", "D"]),
					amount: 1200,
				},
			],
		);

		const adj = toMap(breakdown, "advanceAdjustment");
		expect(adj.A).toBe(900); // +1200 受け取り - 300 自己負担
		expect(adj.B).toBe(-300);
		expect(adj.C).toBe(-300);
		expect(adj.D).toBe(-300);

		expect(sumFinalBalance(breakdown)).toBe(0);
	});
});

describe("computeBreakdown - 複合ケース（ゲーム+チップ+立替）", () => {
	it("全要素が正しく合算され、finalBalance合計が0になる", () => {
		// Round 1: A=+25, B=+5, C=-5, D=-25
		// Round 2: A=+10, B=0, C=-5, D=-5
		// gameScoreTotal: A=35, B=5, C=-10, D=-30

		// chips (chip_rate=1000): A=5, B=-3, C=-1, D=-1
		// chipScore = count (rate=1 なので chipG = count)

		// 立替1（自身を含む）: A が [A, B, C, D] に 1200G 立替
		//   per_person=300, remainder=0
		//   A: +900, B: -300, C: -300, D: -300

		// 立替2（自身を含まない）: B が [A, C, D] に 600G 立替
		//   per_person=200, remainder=0
		//   B: +600, A: -200, C: -200, D: -200

		// advanceAdjustment: A=+700, B=+300, C=-500, D=-500
		// finalBalance:       A=740,  B=302,  C=-511, D=-531  合計=0

		const breakdown = computeBreakdown(
			group,
			players,
			[
				[
					{ playerId: "A", score: 25 },
					{ playerId: "B", score: 5 },
					{ playerId: "C", score: -5 },
					{ playerId: "D", score: -25 },
				],
				[
					{ playerId: "A", score: 10 },
					{ playerId: "B", score: 0 },
					{ playerId: "C", score: -5 },
					{ playerId: "D", score: -5 },
				],
			],
			[
				{ playerId: "A", count: 5 },
				{ playerId: "B", count: -3 },
				{ playerId: "C", count: -1 },
				{ playerId: "D", count: -1 },
			],
			[
				{
					payer_id: "A",
					beneficiary_ids: JSON.stringify(["A", "B", "C", "D"]),
					amount: 1200,
				},
				{
					payer_id: "B",
					beneficiary_ids: JSON.stringify(["A", "C", "D"]),
					amount: 600,
				},
			],
		);

		const totals = toMap(breakdown, "gameScoreTotal");
		expect(totals.A).toBe(35);
		expect(totals.B).toBe(5);
		expect(totals.C).toBe(-10);
		expect(totals.D).toBe(-30);

		const chips = toMap(breakdown, "chipScore");
		expect(chips.A).toBe(5);
		expect(chips.B).toBe(-3);
		expect(chips.C).toBe(-1);
		expect(chips.D).toBe(-1);

		const adj = toMap(breakdown, "advanceAdjustment");
		expect(adj.A).toBe(700); // 900 - 200
		expect(adj.B).toBe(300); // -300 + 600
		expect(adj.C).toBe(-500); // -300 - 200
		expect(adj.D).toBe(-500); // -300 - 200

		const fb = toMap(breakdown, "finalBalance");
		expect(fb.A).toBe(740); // 35 + 5 + 700
		expect(fb.B).toBe(302); // 5 - 3 + 300
		expect(fb.C).toBe(-511); // -10 - 1 - 500
		expect(fb.D).toBe(-531); // -30 - 1 - 500

		expect(sumFinalBalance(breakdown)).toBe(0);
	});
});

describe("computeBreakdown - 立替の割り切れないケース", () => {
	it("対象者4人・4002円は余り2を登録順先頭2人が負担する", () => {
		// 4002 / 4 = 1000, remainder = 2
		// remainderTargets = [B, C, D]（payer A を除外、登録順でソート）
		// B, C が1円ずつ余分に負担: B=-1001, C=-1001, D=-1000
		const breakdown = computeBreakdown(
			group,
			players,
			[],
			[],
			[
				{
					payer_id: "A",
					beneficiary_ids: JSON.stringify(["A", "B", "C", "D"]),
					amount: 4002,
				},
			],
		);

		const adj = toMap(breakdown, "advanceAdjustment");
		expect(adj.A).toBe(3002); // +4002 - 1000
		expect(adj.B).toBe(-1001); // 1000 + 余り1
		expect(adj.C).toBe(-1001); // 1000 + 余り1
		expect(adj.D).toBe(-1000);

		expect(sumFinalBalance(breakdown)).toBe(0);
	});

	it("対象者3人・4000円（支払者含む）は余り1を登録順先頭が負担する", () => {
		// 4000 / 3 = 1333, remainder = 1
		// remainderTargets = [B, C]（payer A を除外、登録順でソート）
		// B が余り1を負担: B=-1334, C=-1333
		const breakdown = computeBreakdown(
			group,
			players,
			[],
			[],
			[
				{
					payer_id: "A",
					beneficiary_ids: JSON.stringify(["A", "B", "C"]),
					amount: 4000,
				},
			],
		);

		const adj = toMap(breakdown, "advanceAdjustment");
		expect(adj.A).toBe(2667); // +4000 - 1333
		expect(adj.B).toBe(-1334); // 1333 + 余り1
		expect(adj.C).toBe(-1333);
		expect(adj.D).toBe(0); // 関与なし

		expect(sumFinalBalance(breakdown)).toBe(0);
	});

	it("対象者3人・4000円（支払者含まず）は余り1を登録順先頭が負担する", () => {
		// 4000 / 3 = 1333, remainder = 1
		// payer A は beneficiary_ids に含まれないため remainderTargets = [B, C, D]
		// B が余り1を負担: B=-1334, C=-1333, D=-1333
		const breakdown = computeBreakdown(
			group,
			players,
			[],
			[],
			[
				{
					payer_id: "A",
					beneficiary_ids: JSON.stringify(["B", "C", "D"]),
					amount: 4000,
				},
			],
		);

		const adj = toMap(breakdown, "advanceAdjustment");
		expect(adj.A).toBe(4000); // 受け取りのみ、自己負担なし
		expect(adj.B).toBe(-1334); // 1333 + 余り1
		expect(adj.C).toBe(-1333);
		expect(adj.D).toBe(-1333);

		expect(sumFinalBalance(breakdown)).toBe(0);
	});
});
