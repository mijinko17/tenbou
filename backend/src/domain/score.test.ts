import { describe, expect, it } from "vitest";
import type { Group } from "./group";
import { computeRoundScores } from "./score";

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

// oka = ((30000 - 25000) / 1000) * 4 = 20

describe("computeRoundScores", () => {
	it("標準ケース: スコア合計が0になる", () => {
		const results = [
			{ playerId: "p1", rawPoints: 40000 },
			{ playerId: "p2", rawPoints: 30000 },
			{ playerId: "p3", rawPoints: 20000 },
			{ playerId: "p4", rawPoints: 10000 },
		];

		const scores = computeRoundScores(results, baseGroup, null, null);
		const total = scores.reduce((s, r) => s + r.score, 0);
		expect(total).toBeCloseTo(0, 5);
	});

	it("素点と順位からスコアを正しく計算する", () => {
		const results = [
			{ playerId: "p1", rawPoints: 40000 },
			{ playerId: "p2", rawPoints: 30000 },
			{ playerId: "p3", rawPoints: 20000 },
			{ playerId: "p4", rawPoints: 10000 },
		];

		const scores = computeRoundScores(results, baseGroup, null, null);
		const map = new Map(scores.map((s) => [s.playerId, s.score]));

		// p1(rank0): (40000-30000)/1000 + 20(uma) + 20(oka) = 50
		expect(map.get("p1")).toBe(50);
		// p2(rank1): (30000-30000)/1000 + 10(uma) = 10
		expect(map.get("p2")).toBe(10);
		// p3(rank2): (20000-30000)/1000 + (-10)(uma) = -20
		expect(map.get("p3")).toBe(-20);
		// p4(rank3): (10000-30000)/1000 + (-20)(uma) = -40
		expect(map.get("p4")).toBe(-40);
	});

	it("rankOrderが指定された場合、点数でなく指定順に従って順位を決める", () => {
		// p1とp2が同点でrankOrderで順位を指定
		const results = [
			{ playerId: "p1", rawPoints: 35000 },
			{ playerId: "p2", rawPoints: 35000 },
			{ playerId: "p3", rawPoints: 20000 },
			{ playerId: "p4", rawPoints: 10000 },
		];
		// rankOrderなしだと素点でソートされ同順位が不定
		const rankOrder = ["p2", "p1", "p3", "p4"];

		const scores = computeRoundScores(results, baseGroup, null, rankOrder);
		const map = new Map(scores.map((s) => [s.playerId, s.score]));

		// p2(rank0): (35000-30000)/1000 + 20(uma) + 20(oka) = 45
		expect(map.get("p2")).toBe(45);
		// p1(rank1): (35000-30000)/1000 + 10(uma) = 15
		expect(map.get("p1")).toBe(15);
	});

	it("飛びプレイヤーにはtobiペナルティが適用される", () => {
		const results = [
			{ playerId: "p1", rawPoints: 60000 },
			{ playerId: "p2", rawPoints: 30000 },
			{ playerId: "p3", rawPoints: 20000 },
			{ playerId: "p4", rawPoints: -10000 }, // 飛び
		];

		const scores = computeRoundScores(results, baseGroup, "p1", null);
		const map = new Map(scores.map((s) => [s.playerId, s.score]));

		// p4(rank3, 飛び): (-10000-30000)/1000 + (-20)(uma) - 10(tobi) = -70
		expect(map.get("p4")).toBe(-70);
	});

	it("tobiKillerIdのプレイヤーに飛びボーナスが加算される", () => {
		const results = [
			{ playerId: "p1", rawPoints: 60000 },
			{ playerId: "p2", rawPoints: 30000 },
			{ playerId: "p3", rawPoints: 20000 },
			{ playerId: "p4", rawPoints: -10000 }, // 飛び
		];

		const scores = computeRoundScores(results, baseGroup, "p1", null);
		const map = new Map(scores.map((s) => [s.playerId, s.score]));

		// p1(rank0, tobiKiller, 飛び1人): (60000-30000)/1000 + 20(uma) + 20(oka) + 10*1(tobiBonus) = 80
		expect(map.get("p1")).toBe(80);
	});

	it("飛び2人の場合、tobiKillerには tobi*2 が加算される", () => {
		const results = [
			{ playerId: "p1", rawPoints: 80000 },
			{ playerId: "p2", rawPoints: 30000 },
			{ playerId: "p3", rawPoints: -5000 }, // 飛び
			{ playerId: "p4", rawPoints: -5000 }, // 飛び
		];

		const scores = computeRoundScores(results, baseGroup, "p1", null);
		const map = new Map(scores.map((s) => [s.playerId, s.score]));

		// p1(rank0, tobiKiller, 飛び2人): (80000-30000)/1000 + 20(uma) + 20(oka) + 10*2(tobiBonus) = 110
		expect(map.get("p1")).toBe(110);
	});

	it("飛びプレイヤーがいて tobiKillerId が null の場合、トビペナルティは適用されない", () => {
		const results = [
			{ playerId: "p1", rawPoints: 60000 },
			{ playerId: "p2", rawPoints: 30000 },
			{ playerId: "p3", rawPoints: 20000 },
			{ playerId: "p4", rawPoints: -10000 }, // 飛び
		];

		const scores = computeRoundScores(results, baseGroup, null, null);
		const map = new Map(scores.map((s) => [s.playerId, s.score]));

		// p4(rank3): (-10000-30000)/1000 + (-20)(uma) = -60 (ペナルティなし)
		expect(map.get("p4")).toBe(-60);

		// ペナルティもボーナスもないためスコア合計は 0
		const total = scores.reduce((s, r) => s + r.score, 0);
		expect(total).toBeCloseTo(0, 5);
	});
});
