export type SettlementGroup = {
	rate: number;
	chip_rate: number;
};

export type SettlementPlayer = {
	id: string;
	name: string;
};

export type RoundScore = {
	playerId: string;
	score: number;
};

export type ChipRow = {
	playerId: string;
	count: number;
};

export type AdvancePaymentRow = {
	payer_id: string;
	beneficiary_ids: string; // JSON配列文字列
	amount: number;
};

export type Breakdown = {
	playerId: string;
	gameScoreTotal: number;
	gameG: number;
	chipScore: number;
	chipG: number;
	subtotalG: number;
	advanceAdjustment: number;
	finalBalance: number;
};

// 五捨六入: 小数第1位が 0〜5 は切り捨て、6〜9 は切り上げ
// Math.round で浮動小数点誤差を吸収する（例: 10.6-10 = 0.5999...）
export function goShaRokuNyu(x: number): number {
	const decimal = x - Math.floor(x);
	return Math.round(decimal * 10) >= 6 ? Math.ceil(x) : Math.floor(x);
}

export function computeBreakdown(
	group: SettlementGroup,
	players: SettlementPlayer[],
	roundScores: RoundScore[][],
	chipRows: ChipRow[],
	advancePayments: AdvancePaymentRow[],
): Breakdown[] {
	// Step 1: 全半荘スコアをプレイヤーごとに合算
	const gameScoreTotals = new Map<string, number>(
		players.map((p) => [p.id, 0]),
	);
	for (const scores of roundScores) {
		for (const s of scores) {
			gameScoreTotals.set(
				s.playerId,
				Math.round(((gameScoreTotals.get(s.playerId) ?? 0) + s.score) * 10) /
					10,
			);
		}
	}

	// Step 2: gameG = 五捨六入(gameScoreTotal × rate)
	const gameG = new Map<string, number>();
	for (const [pid, score] of gameScoreTotals) {
		gameG.set(pid, goShaRokuNyu(score * group.rate));
	}

	// Step 3: chipScore・chipG
	const chipCountMap = new Map<string, number>(players.map((p) => [p.id, 0]));
	for (const chip of chipRows) {
		chipCountMap.set(chip.playerId, chip.count);
	}
	const chipScores = new Map<string, number>();
	const chipG = new Map<string, number>();
	for (const p of players) {
		const chipScore =
			Math.round(
				(((chipCountMap.get(p.id) ?? 0) * group.chip_rate) / 1000) * 10,
			) / 10;
		chipScores.set(p.id, chipScore);
		chipG.set(p.id, goShaRokuNyu(chipScore * group.rate));
	}

	// Step 4: subtotalG = gameG + chipG
	const subtotalG = new Map<string, number>();
	for (const p of players) {
		subtotalG.set(p.id, (gameG.get(p.id) ?? 0) + (chipG.get(p.id) ?? 0));
	}

	// Step 5: 帳尻合わせ（合計が0にならない場合、最高スコアのプレイヤーで調整）
	const subtotalSum = [...subtotalG.values()].reduce((s, v) => s + v, 0);
	if (subtotalSum !== 0) {
		const topPlayer = players.reduce((max, p) =>
			(subtotalG.get(p.id) ?? 0) > (subtotalG.get(max.id) ?? 0) ? p : max,
		);
		subtotalG.set(
			topPlayer.id,
			(subtotalG.get(topPlayer.id) ?? 0) - subtotalSum,
		);
	}

	// Step 6: 立替調整
	// 余りは登録順（players配列順）に並べた被立替者へ1ずつ振り分ける。支払者は対象外。
	const playerOrder = players.map((p) => p.id);
	const advanceAdj = new Map<string, number>(players.map((p) => [p.id, 0]));
	for (const payment of advancePayments) {
		const beneficiaryIds = JSON.parse(payment.beneficiary_ids) as string[];
		const perPerson = Math.floor(payment.amount / beneficiaryIds.length);
		const remainder = payment.amount - perPerson * beneficiaryIds.length;

		const remainderTargets = [...beneficiaryIds]
			.filter((bid) => bid !== payment.payer_id)
			.sort((a, b) => playerOrder.indexOf(a) - playerOrder.indexOf(b));

		advanceAdj.set(
			payment.payer_id,
			(advanceAdj.get(payment.payer_id) ?? 0) + payment.amount,
		);
		for (const bid of beneficiaryIds) {
			const idx = remainderTargets.indexOf(bid);
			const extra = idx >= 0 && idx < remainder ? 1 : 0;
			advanceAdj.set(bid, (advanceAdj.get(bid) ?? 0) - (perPerson + extra));
		}
	}

	// Step 7: 最終収支
	return players.map((p) => ({
		playerId: p.id,
		gameScoreTotal: gameScoreTotals.get(p.id) ?? 0,
		gameG: gameG.get(p.id) ?? 0,
		chipScore: chipScores.get(p.id) ?? 0,
		chipG: chipG.get(p.id) ?? 0,
		subtotalG: subtotalG.get(p.id) ?? 0,
		advanceAdjustment: advanceAdj.get(p.id) ?? 0,
		finalBalance: (subtotalG.get(p.id) ?? 0) + (advanceAdj.get(p.id) ?? 0),
	}));
}
