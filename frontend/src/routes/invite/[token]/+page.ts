import { API_URL } from "$lib/api";
import type { PageLoad } from "./$types";

export const ssr = false;

export const load: PageLoad = async ({ params, fetch }) => {
	const res = await fetch(`${API_URL}/invite/${params.token}`, {
		credentials: "include",
	});
	if (res.status === 404)
		return { group: null, players: [], error: "招待リンクが見つかりません" };
	if (res.status === 410)
		return {
			group: null,
			players: [],
			error: "招待リンクの有効期限が切れています",
		};
	if (!res.ok)
		return { group: null, players: [], error: "エラーが発生しました" };
	return res.json();
};
