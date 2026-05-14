<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { page } from "$app/stores";
	import { API_URL } from "$lib/api";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import ChevronUpIcon from "@lucide/svelte/icons/chevron-up";
	import InfoIcon from "@lucide/svelte/icons/info";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";
	import { Button } from "$lib/components/ui/button";
	import * as InputGroup from "$lib/components/ui/input-group";
	import { Label } from "$lib/components/ui/label";
	import * as RadioGroup from "$lib/components/ui/radio-group";
	import * as Table from "$lib/components/ui/table";

	type Player = { id: string; name: string };
	type RoundResult = { playerId: string; rawPoints: number; score: number };
	type Round = {
		id: string;
		roundNo: number;
		tobiKillerId: string | null;
		results: RoundResult[];
	};
	type Group = {
		id: string;
		name: string;
		rate: number;
		uma_1: number;
		uma_2: number;
		uma_3: number;
		uma_4: number;
		tobi: number;
		genten: number;
		kaeshi: number;
	};

	const { data } = $props<{
		data: {
			group: Group | null;
			players: Player[];
			currentPlayerId: string | null;
			rounds: Round[];
			error?: string;
		};
	}>();

	const groupId = $derived($page.params.groupId);

	let showSettings = $state(false);

	// 成績登録フォーム
	let showForm = $state(false);
	let rawPointInputs = $state<Record<string, string>>({});
	let rankOrder = $state<string[]>([]);
	let tobiKillerId = $state("");
	let submitError = $state<string | null>(null);
	let loading = $state(false);

	function openForm() {
		rawPointInputs = Object.fromEntries((data.players ?? []).map((p: Player) => [p.id, ""]));
		rankOrder = (data.players ?? []).map((p: Player) => p.id);
		tobiKillerId = "";
		submitError = null;
		showForm = true;
	}

	const parsedPoints = $derived(
		Object.fromEntries(
			Object.entries(rawPointInputs).map(([id, v]) => [id, parseInt(v, 10)]),
		),
	);

	const pointsSum = $derived(
		Object.values(parsedPoints).reduce((sum, v) => sum + (Number.isNaN(v) ? 0 : v), 0),
	);

	const expectedSum = $derived((data.group?.genten ?? 0) * 4);

	const sumOk = $derived(
		Object.values(parsedPoints).every((v) => !Number.isNaN(v)) && pointsSum === expectedSum,
	);

	const allPointsEntered = $derived(
		(data.players ?? []).every((p) => !Number.isNaN(parsedPoints[p.id])),
	);

	// 素点が変わるたびに rankOrder を点数順でリセット
	$effect(() => {
		rankOrder = [...(data.players ?? [])]
			.sort((a: Player, b: Player) => {
				const pa = parsedPoints[a.id];
				const pb = parsedPoints[b.id];
				if (Number.isNaN(pa) && Number.isNaN(pb)) return 0;
				if (Number.isNaN(pa)) return 1;
				if (Number.isNaN(pb)) return -1;
				return pb - pa;
			})
			.map((p: Player) => p.id);
	});

	const hasTies = $derived(
		allPointsEntered &&
			rankOrder.some((id, i) => i > 0 && parsedPoints[id] === parsedPoints[rankOrder[i - 1]]),
	);

	function swapRank(i: number, j: number) {
		const next = [...rankOrder];
		[next[i], next[j]] = [next[j], next[i]];
		rankOrder = next;
	}

	const hasTobi = $derived(Object.values(parsedPoints).some((v) => !Number.isNaN(v) && v < 0));

	const killerCandidates = $derived(
		(data.players ?? []).filter((p) => {
			const v = parsedPoints[p.id];
			return Number.isNaN(v) || v >= 0;
		}),
	);

	function formatScore(score: number): string {
		return (score > 0 ? "+" : "") + score.toFixed(1);
	}

	const totals = $derived(
		(data.players ?? []).map((p) => ({
			playerId: p.id,
			score:
				Math.round(
					(data.rounds ?? []).reduce((sum, round) => {
						const r = round.results.find((r) => r.playerId === p.id);
						return sum + (r?.score ?? 0);
					}, 0) * 10,
				) / 10,
		})),
	);

	async function submitRound() {
		submitError = null;

		const results = (data.players ?? []).map((p) => ({
			playerId: p.id,
			rawPoints: parsedPoints[p.id],
		}));

		if (results.some((r) => Number.isNaN(r.rawPoints))) {
			submitError = "すべてのプレイヤーの素点を入力してください";
			return;
		}
		if (!sumOk) {
			submitError = `素点の合計が${expectedSum}になっていません（現在: ${pointsSum}）`;
			return;
		}
		if (hasTobi && !tobiKillerId) {
			submitError = "飛ばしたプレイヤーを選択してください";
			return;
		}

		if (hasTies) {
			submitError = null;
		}

		loading = true;
		try {
			const body: { results: typeof results; tobiKillerId?: string; rankOrder?: string[] } = {
				results,
			};
			if (hasTies) body.rankOrder = rankOrder;
			if (hasTobi && tobiKillerId !== "none") body.tobiKillerId = tobiKillerId;

			const res = await fetch(`${API_URL}/groups/${groupId}/rounds`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			const json = (await res.json()) as { error?: string };
			if (!res.ok) {
				submitError = json.error ?? "エラーが発生しました";
				return;
			}

			showForm = false;
			await invalidateAll();
		} catch {
			submitError = "通信エラーが発生しました";
		} finally {
			loading = false;
		}
	}
</script>

<main class="mx-auto max-w-2xl px-4 py-6">
	{#if data.error}
		<Alert variant="destructive">
			<AlertDescription>{data.error}</AlertDescription>
		</Alert>
	{:else if data.group}
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<h1 class="text-xl font-bold">{data.group.name}</h1>
				<Button
					variant="ghost"
					size="icon-sm"
					onclick={() => (showSettings = !showSettings)}
					aria-label="グループ設定を表示"
				>
					<InfoIcon class="size-4" />
				</Button>
			</div>
			<Button onclick={openForm} disabled={showForm} class="shrink-0">成績を登録</Button>
		</div>

		{#if showSettings}
			<div class="mb-4 rounded-lg border p-4 text-sm">
				<p class="mb-2 font-semibold">グループ設定</p>
				<dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
					<dt>レート</dt><dd class="text-right text-foreground">1000点 = {data.group.rate}G</dd>
					<dt>原点</dt><dd class="text-right text-foreground">{data.group.genten}点</dd>
					<dt>返し</dt><dd class="text-right text-foreground">{data.group.kaeshi}点</dd>
					<dt>ウマ（1着）</dt><dd class="text-right text-foreground">{data.group.uma_1}</dd>
					<dt>ウマ（2着）</dt><dd class="text-right text-foreground">{data.group.uma_2}</dd>
					<dt>ウマ（3着）</dt><dd class="text-right text-foreground">{data.group.uma_3}</dd>
					<dt>ウマ（4着）</dt><dd class="text-right text-foreground">{data.group.uma_4}</dd>
					<dt>飛び賞</dt><dd class="text-right text-foreground">{data.group.tobi}</dd>
				</dl>
			</div>
		{/if}

		{#if showForm}
			<div class="mb-6 rounded-lg border p-4">
				<h2 class="mb-4 font-semibold">点数</h2>

				<div class="mb-4 space-y-3">
					{#each data.players as player}
						<div class="flex items-center gap-3">
							<Label class="w-20 shrink-0 {player.id === data.currentPlayerId ? 'font-bold' : ''}">
								{player.name}
							</Label>
							<InputGroup.Root class="flex-1">
								<InputGroup.Input
									type="number"
									bind:value={rawPointInputs[player.id]}
									placeholder="例: 32000"
								/>
								<InputGroup.Addon align="inline-end">点</InputGroup.Addon>
							</InputGroup.Root>
						</div>
					{/each}
				</div>

				<p class="mb-4 text-sm {sumOk ? 'text-green-600' : 'text-muted-foreground'}">
					合計: {pointsSum} / {expectedSum}
					{#if sumOk}✓{/if}
				</p>

				{#if hasTobi}
					<div class="mb-4">
						<Label class="mb-2 block font-semibold">飛ばしたプレイヤー</Label>
						<RadioGroup.Root bind:value={tobiKillerId} class="gap-3">
							{#each killerCandidates as player}
								<div class="flex items-center gap-2">
									<RadioGroup.Item value={player.id} id="killer-{player.id}" />
									<Label for="killer-{player.id}">{player.name}</Label>
								</div>
							{/each}
							<div class="flex items-center gap-2">
								<RadioGroup.Item value="none" id="killer-none" />
								<Label for="killer-none">無し</Label>
							</div>
						</RadioGroup.Root>
					</div>
				{/if}

				{#if hasTies}
					<div class="mb-4">
						<Label class="mb-2 block font-semibold">順位</Label>
						<div class="space-y-1">
							{#each rankOrder as playerId, i}
								{@const player = data.players.find((p: Player) => p.id === playerId)}
								{@const pts = parsedPoints[playerId]}
								{@const prevPts = i > 0 ? parsedPoints[rankOrder[i - 1]] : null}
								{@const nextPts = i < rankOrder.length - 1 ? parsedPoints[rankOrder[i + 1]] : null}
								{@const isTied = prevPts === pts || nextPts === pts}
								<div
									class="flex items-center gap-2 rounded border px-3 py-2 {isTied
										? 'border-amber-300 bg-amber-50'
										: ''}"
								>
									<span class="w-5 shrink-0 text-sm text-muted-foreground">{i + 1}</span>
									<span class="flex-1 text-sm font-medium">{player?.name}</span>
									<span class="text-xs text-muted-foreground">{pts}</span>
									<div class="flex gap-1">
										<Button
											variant="ghost"
											size="icon-sm"
											onclick={() => swapRank(i, i - 1)}
											disabled={prevPts !== pts}
											aria-label="上へ"
										>
											<ChevronUpIcon />
										</Button>
										<Button
											variant="ghost"
											size="icon-sm"
											onclick={() => swapRank(i, i + 1)}
											disabled={nextPts !== pts}
											aria-label="下へ"
										>
											<ChevronDownIcon />
										</Button>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if submitError}
					<Alert variant="destructive" class="mb-4">
						<AlertDescription>{submitError}</AlertDescription>
					</Alert>
				{/if}

				<div class="flex gap-2">
					<Button
						variant="outline"
						onclick={() => (showForm = false)}
						disabled={loading}
						class="flex-1"
					>
						キャンセル
					</Button>
					<Button onclick={submitRound} disabled={loading} class="flex-1">
						{loading ? "登録中..." : "登録"}
					</Button>
				</div>
			</div>
		{/if}

		{#if data.rounds.length === 0 && !showForm}
			<p class="py-12 text-center text-sm text-muted-foreground">
				まだ成績が登録されていません
			</p>
		{:else if data.rounds.length > 0}
			<div class="-mx-4 overflow-x-auto">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="text-muted-foreground">#</Table.Head>
							{#each data.players as player}
								<Table.Head
									class="text-right {player.id === data.currentPlayerId ? 'text-primary' : ''}"
								>
									{player.name}
								</Table.Head>
							{/each}
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.rounds as round}
							<Table.Row>
								<Table.Cell class="text-muted-foreground">{round.roundNo}</Table.Cell>
								{#each data.players as player}
									{@const result = round.results.find((r) => r.playerId === player.id)}
									<Table.Cell
										class="text-right tabular-nums {result && result.score > 0
											? 'text-blue-600'
											: result && result.score < 0
												? 'text-red-500'
												: ''}"
									>
										{result ? formatScore(result.score) : "−"}
									</Table.Cell>
								{/each}
							</Table.Row>
						{/each}
					</Table.Body>
					<Table.Footer>
						<Table.Row>
							<Table.Cell class="font-bold">合計</Table.Cell>
							{#each totals as total}
								<Table.Cell
									class="text-right font-bold tabular-nums {total.score > 0
										? 'text-blue-600'
										: total.score < 0
											? 'text-red-500'
											: ''}"
								>
									{formatScore(total.score)}
								</Table.Cell>
							{/each}
						</Table.Row>
					</Table.Footer>
				</Table.Root>
			</div>
		{/if}
	{/if}
</main>
