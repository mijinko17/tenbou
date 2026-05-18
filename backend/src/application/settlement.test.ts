import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import type { Group } from "../domain/group";
import type { RoundData } from "../domain/repositories/group";
import type { SettlementRepository } from "../domain/repositories/settlement";
import type { AdvancePaymentRow } from "../domain/settlement";
import { AppError } from "../errors";
import { getSettlement } from "./settlement";

const baseGroup: Group = {
	id: "g1",
	name: "テスト",
	rate: 50,
	chip_rate: 2,
	uma_1: 20,
	uma_2: 10,
	uma_3: -10,
	uma_4: -20,
	tobi: 10,
	genten: 25000,
	kaeshi: 30000,
	created_at: "2024-01-01",
};

const players = [
	{ id: "p1", name: "太郎" },
	{ id: "p2", name: "次郎" },
	{ id: "p3", name: "三郎" },
	{ id: "p4", name: "四郎" },
];

function makeRepo(
	overrides?: Partial<SettlementRepository>,
): SettlementRepository {
	return {
		findGroup: () => okAsync(baseGroup),
		findPlayers: () => okAsync(players),
		findRoundsWithResults: () => okAsync([]),
		findChips: () => okAsync([]),
		findAdvancePayments: () => okAsync([]),
		...overrides,
	};
}

function findBreakdown(
	breakdown: { playerId: string; finalBalance: number }[],
	playerId: string,
) {
	const entry = breakdown.find((b) => b.playerId === playerId);
	if (!entry) throw new Error(`breakdown not found for ${playerId}`);
	return entry;
}

// genten * 4 = 100000 になる素点セット
const validRound: RoundData = {
	id: "r1",
	roundNo: 1,
	playedAt: "2024-01-01",
	tobiKillerId: null,
	rankOrder: null,
	results: [
		{ playerId: "p1", rawPoints: 40000 },
		{ playerId: "p2", rawPoints: 30000 },
		{ playerId: "p3", rawPoints: 20000 },
		{ playerId: "p4", rawPoints: 10000 },
	],
};

describe("getSettlement", () => {
	it("グループが存在しない場合は404を返す", async () => {
		const repo = makeRepo({ findGroup: () => okAsync(null) });
		const result = await getSettlement(repo, "g1");
		expect(result._unsafeUnwrapErr()).toMatchObject({ status: 404 });
	});

	it("ラウンドなし・チップなし・立替なしで精算結果を返す", async () => {
		const repo = makeRepo();
		const result = await getSettlement(repo, "g1");
		const value = result._unsafeUnwrap();
		expect(value.players).toEqual(players);
		expect(value.breakdown).toHaveLength(players.length);
		expect(value.payments).toBeInstanceOf(Array);
		// ラウンドなしなので全員 finalBalance = 0
		for (const b of value.breakdown) {
			expect(b.finalBalance).toBe(0);
		}
		expect(value.payments).toHaveLength(0);
	});

	it("ラウンドありの場合にbreakdownとpaymentsが計算される", async () => {
		const repo = makeRepo({
			findRoundsWithResults: () => okAsync([validRound]),
		});
		const result = await getSettlement(repo, "g1");
		const value = result._unsafeUnwrap();
		expect(value.breakdown).toHaveLength(players.length);
		// 1位（p1）は利益、最下位（p4）は損
		const p1 = findBreakdown(value.breakdown, "p1");
		const p4 = findBreakdown(value.breakdown, "p4");
		expect(p1.finalBalance).toBeGreaterThan(p4.finalBalance);
	});

	it("チップが精算に反映される", async () => {
		// count=500, chip_rate=2 → chipScore=1.0 → chipG=50 となり finalBalance に差が出る
		const chips = [
			{ playerId: "p1", count: 500 },
			{ playerId: "p2", count: -500 },
			{ playerId: "p3", count: 0 },
			{ playerId: "p4", count: 0 },
		];
		const repoNoChips = makeRepo({
			findRoundsWithResults: () => okAsync([validRound]),
		});
		const repoWithChips = makeRepo({
			findRoundsWithResults: () => okAsync([validRound]),
			findChips: () => okAsync(chips),
		});
		const [r1, r2] = await Promise.all([
			getSettlement(repoNoChips, "g1"),
			getSettlement(repoWithChips, "g1"),
		]);
		const p1NoChip = findBreakdown(r1._unsafeUnwrap().breakdown, "p1");
		const p1WithChip = findBreakdown(r2._unsafeUnwrap().breakdown, "p1");
		// チップ+500 で finalBalance が増えること
		expect(p1WithChip.finalBalance).toBeGreaterThan(p1NoChip.finalBalance);
	});

	it("立替払いが精算に反映される", async () => {
		// AdvancePaymentRow は payer_id / beneficiary_ids(JSON文字列) / amount のみ
		const advancePayments: AdvancePaymentRow[] = [
			{
				payer_id: "p1",
				beneficiary_ids: JSON.stringify(["p2", "p3"]),
				amount: 3000,
			},
		];
		const repo = makeRepo({
			findAdvancePayments: () => okAsync(advancePayments),
		});
		const result = await getSettlement(repo, "g1");
		const value = result._unsafeUnwrap();
		// p1 は 3000 立替しているので finalBalance が増える
		const p1 = findBreakdown(value.breakdown, "p1");
		const p2 = findBreakdown(value.breakdown, "p2");
		expect(p1.finalBalance).toBeGreaterThan(0);
		expect(p2.finalBalance).toBeLessThan(0);
	});
});
