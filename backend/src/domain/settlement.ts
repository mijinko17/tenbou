export type {
	SettlementGroup,
	SettlementPlayer,
	RoundScore,
	ChipRow,
	AdvancePaymentRow,
	Breakdown,
} from "./breakdown";
export { goShaRokuNyu } from "./breakdown";
export type { Payment } from "./payments";

import { computeBreakdown } from "./breakdown";
import type {
	AdvancePaymentRow,
	Breakdown,
	ChipRow,
	RoundScore,
	SettlementGroup,
	SettlementPlayer,
} from "./breakdown";
import { minimizePayments } from "./payments";
import type { Payment } from "./payments";

export function computeSettlement(
	group: SettlementGroup,
	players: SettlementPlayer[],
	roundScores: RoundScore[][],
	chipRows: ChipRow[],
	advancePayments: AdvancePaymentRow[],
): { breakdown: Breakdown[]; payments: Payment[] } {
	const breakdown = computeBreakdown(
		group,
		players,
		roundScores,
		chipRows,
		advancePayments,
	);
	const payments = minimizePayments(
		breakdown.map((r) => ({ playerId: r.playerId, balance: r.finalBalance })),
	);
	return { breakdown, payments };
}
