export type Payment = {
	from: string;
	to: string;
	amount: number;
};

export function minimizePayments(
	balances: { playerId: string; balance: number }[],
): Payment[] {
	const mutableBalances = balances.map((b) => ({ ...b }));
	const payments: Payment[] = [];
	while (true) {
		mutableBalances.sort((a, b) => b.balance - a.balance);
		const creditor = mutableBalances.find((x) => x.balance > 0);
		const debtor = mutableBalances.find((x) => x.balance < 0);
		if (!creditor || !debtor) break;
		const amount = Math.min(creditor.balance, -debtor.balance);
		payments.push({ from: debtor.playerId, to: creditor.playerId, amount });
		creditor.balance -= amount;
		debtor.balance += amount;
	}
	return payments;
}
