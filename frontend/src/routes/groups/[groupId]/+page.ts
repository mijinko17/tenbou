import { API_URL } from "$lib/api";
import type { PageLoad } from "./$types";

export const ssr = false;

export const load: PageLoad = async ({ params, fetch }) => {
	const res = await fetch(`${API_URL}/groups/${params.groupId}`);
	if (!res.ok) {
		const json = (await res.json().catch(() => ({}))) as { error?: string };
		return {
			group: null,
			players: [],
			currentPlayerId: null,
			rounds: [],
			error: json.error ?? "エラーが発生しました",
		};
	}
	return res.json();
};
