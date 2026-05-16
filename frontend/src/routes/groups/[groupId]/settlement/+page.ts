import { API_URL } from "$lib/api";
import type { PageLoad } from "./$types";

export const ssr = false;

export type Player = { id: string; name: string };

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

export type Payment = { from: string; to: string; amount: number };

export const load: PageLoad = async ({ params, fetch }) => {
	const res = await fetch(`${API_URL}/groups/${params.groupId}/settlement`);
	if (!res.ok) {
		const json = (await res.json().catch(() => ({}))) as { error?: string };
		return {
			groupId: params.groupId,
			players: [] as Player[],
			breakdown: [] as Breakdown[],
			payments: [] as Payment[],
			error: json.error ?? "エラーが発生しました",
		};
	}
	const data = (await res.json()) as {
		players: Player[];
		breakdown: Breakdown[];
		payments: Payment[];
	};
	return { groupId: params.groupId, ...data, error: null };
};
