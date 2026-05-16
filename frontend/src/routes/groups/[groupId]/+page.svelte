<script lang="ts">
	import { goto, invalidateAll } from "$app/navigation";
	import { page } from "$app/state";
	import { API_URL } from "$lib/api";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import ChevronUpIcon from "@lucide/svelte/icons/chevron-up";
	import InfoIcon from "@lucide/svelte/icons/info";
	import XIcon from "@lucide/svelte/icons/x";
import { Alert, AlertDescription } from "$lib/components/ui/alert";
	import { Button } from "$lib/components/ui/button";
	import * as InputGroup from "$lib/components/ui/input-group";
	import { Label } from "$lib/components/ui/label";

	import * as Table from "$lib/components/ui/table";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Select from "$lib/components/ui/select";
	import { Input } from "$lib/components/ui/input";
	import { Checkbox } from "$lib/components/ui/checkbox";

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
		chip_rate: number;
		uma_1: number;
		uma_2: number;
		uma_3: number;
		uma_4: number;
		tobi: number;
		genten: number;
		kaeshi: number;
	};
	type ChipEntry = { playerId: string; count: number };
	type AdvancePayment = {
		id: string;
		payerId: string;
		beneficiaryIds: string[];
		description: string;
		amount: number;
		createdAt: number;
	};

	const { data } = $props<{
		data: {
			group: Group | null;
			players: Player[];
			currentPlayerId: string | null;
			rounds: Round[];
			chips: ChipEntry[];
			advancePayments: AdvancePayment[];
			error?: string;
		};
	}>();

	const groupId = $derived(page.params.groupId);

	let showSettings = $state(false);

	// ドロップダウン閉後に開くアクション
	let pendingAction = $state<"form" | "chip" | "advance" | null>(null);

	function handleDropdownClose(open: boolean) {
		if (open || !pendingAction) return;
		if (pendingAction === "form") initForm();
		else if (pendingAction === "chip") initChipForm();
		else if (pendingAction === "advance") initAdvanceForm();
		pendingAction = null;
	}

	// チップ入力フォーム
	let showChipForm = $state(false);
	let chipInputs = $state<Record<string, string>>({});
	let chipSubmitError = $state<string | null>(null);
	let chipLoading = $state(false);

	const hasChips = $derived((data.chips ?? []).length > 0);

	function initChipForm() {
		const existing = Object.fromEntries((data.chips ?? []).map((c: ChipEntry) => [c.playerId, String(c.count)]));
		chipInputs = Object.fromEntries(
			(data.players ?? []).map((p: Player) => [p.id, existing[p.id] ?? ""]),
		);
		chipSubmitError = null;
		showChipForm = true;
	}

	const chipSum = $derived(
		Object.values(chipInputs).reduce((s, v) => {
			const n = parseInt(v, 10);
			return s + (Number.isNaN(n) ? 0 : n);
		}, 0),
	);

	const chipSumOk = $derived(
		Object.values(chipInputs).every((v) => v === "" || !Number.isNaN(parseInt(v, 10))) &&
		chipSum === 0,
	);

	async function submitChips() {
		chipSubmitError = null;
		const chips: ChipEntry[] = (data.players ?? []).map((p: Player) => ({
			playerId: p.id,
			count: parseInt(chipInputs[p.id] ?? "0", 10) || 0,
		}));
		if (chips.reduce((s: number, c: ChipEntry) => s + c.count, 0) !== 0) {
			chipSubmitError = "チップ収支の合計が0になっていません";
			return;
		}
		chipLoading = true;
		try {
			const res = await fetch(`${API_URL}/groups/${groupId}/chips`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ chips }),
			});
			const json = (await res.json()) as { error?: string };
			if (!res.ok) {
				chipSubmitError = json.error ?? "エラーが発生しました";
				return;
			}
			showChipForm = false;
			await invalidateAll();
		} catch {
			chipSubmitError = "通信エラーが発生しました";
		} finally {
			chipLoading = false;
		}
	}

	// 立替登録フォーム
	let showAdvanceForm = $state(false);
	let advancePayerId = $state("");
	let advanceBeneficiaryIds = $state<string[]>([]);
	let advanceDescription = $state("");
	let advanceAmount = $state("");
	let advanceSubmitError = $state<string | null>(null);
	let advanceLoading = $state(false);

	function initAdvanceForm() {
		advancePayerId = data.players[0]?.id ?? "";
		advanceBeneficiaryIds = [];
		advanceDescription = "";
		advanceAmount = "";
		advanceSubmitError = null;
		showAdvanceForm = true;
	}

	function toggleBeneficiary(playerId: string) {
		if (advanceBeneficiaryIds.includes(playerId)) {
			advanceBeneficiaryIds = advanceBeneficiaryIds.filter((id) => id !== playerId);
		} else {
			advanceBeneficiaryIds = [...advanceBeneficiaryIds, playerId];
		}
	}

	async function submitAdvancePayment() {
		advanceSubmitError = null;
		const amount = parseInt(advanceAmount, 10);
		if (!advancePayerId) {
			advanceSubmitError = "立替者を選択してください";
			return;
		}
		if (advanceBeneficiaryIds.length === 0) {
			advanceSubmitError = "被立替者を1人以上選択してください";
			return;
		}
		if (advanceBeneficiaryIds.every((id) => id === advancePayerId)) {
			advanceSubmitError = "立替対象が立替者のみのケースは登録できません";
			return;
		}
		if (!advanceDescription.trim()) {
			advanceSubmitError = "内容を入力してください";
			return;
		}
		if (Number.isNaN(amount) || amount <= 0) {
			advanceSubmitError = "金額を正の整数で入力してください";
			return;
		}
		advanceLoading = true;
		try {
			const res = await fetch(`${API_URL}/groups/${groupId}/advance-payments`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					payerId: advancePayerId,
					beneficiaryIds: advanceBeneficiaryIds,
					description: advanceDescription,
					amount,
				}),
			});
			const json = (await res.json()) as { error?: string };
			if (!res.ok) {
				advanceSubmitError = json.error ?? "エラーが発生しました";
				return;
			}
			showAdvanceForm = false;
			await invalidateAll();
		} catch {
			advanceSubmitError = "通信エラーが発生しました";
		} finally {
			advanceLoading = false;
		}
	}

	let showDeleteChipConfirm = $state(false);

	async function confirmDeleteChips() {
		const res = await fetch(`${API_URL}/groups/${groupId}/chips`, { method: "DELETE" });
		showDeleteChipConfirm = false;
		if (res.ok) await invalidateAll();
	}

	let deleteTargetRoundId = $state<string | null>(null);

	async function confirmDeleteRound() {
		if (!deleteTargetRoundId) return;
		const res = await fetch(`${API_URL}/groups/${groupId}/rounds/${deleteTargetRoundId}`, {
			method: "DELETE",
		});
		deleteTargetRoundId = null;
		if (res.ok) await invalidateAll();
	}

	let deleteTargetId = $state<string | null>(null);

	async function confirmDeleteAdvancePayment() {
		if (!deleteTargetId) return;
		const res = await fetch(`${API_URL}/groups/${groupId}/advance-payments/${deleteTargetId}`, {
			method: "DELETE",
		});
		deleteTargetId = null;
		if (res.ok) await invalidateAll();
	}

	// 成績登録フォーム
	let showForm = $state(false);
	let rawPointInputs = $state<Record<string, string>>({});
	let displayInputs = $state<Record<string, string>>({});
	let hasPartialInput = $state<Record<string, boolean>>({});
	let rankOrder = $state<string[]>([]);
	let tobiKillerId = $state("");
	let submitError = $state<string | null>(null);
	let loading = $state(false);

	function initForm() {
		rawPointInputs = Object.fromEntries((data.players ?? []).map((p: Player) => [p.id, ""]));
		displayInputs = Object.fromEntries((data.players ?? []).map((p: Player) => [p.id, ""]));
		hasPartialInput = Object.fromEntries((data.players ?? []).map((p: Player) => [p.id, false]));
		rankOrder = (data.players ?? []).map((p: Player) => p.id);
		tobiKillerId = "";
		submitError = null;
		showForm = true;
	}

	function handleScoreInput(playerId: string, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const ie = e as InputEvent;
		if (input.value !== "") {
			displayInputs[playerId] = input.value;
			hasPartialInput[playerId] = false;
		} else if (!input.validity.badInput) {
			displayInputs[playerId] = "";
			hasPartialInput[playerId] = false;
		} else if (ie.data === "-") {
			displayInputs[playerId] = "-";
			hasPartialInput[playerId] = false;
		} else if (ie.inputType?.startsWith("delete")) {
			// "-3" から "3" を削除して "-" だけ残った場合
			displayInputs[playerId] = "-";
			hasPartialInput[playerId] = false;
		} else {
			// "e" など数値として不正な文字の入力
			displayInputs[playerId] = "";
			hasPartialInput[playerId] = true;
		}
	}

	const parsedPoints = $derived(
		Object.fromEntries(
			Object.entries(rawPointInputs).map(([id, v]): [string, number] => {
				const n = parseInt(v, 10);
				return [id, Number.isNaN(n) ? NaN : n * 100];
			}),
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
		(data.players ?? []).every((p: Player) => !Number.isNaN(parsedPoints[p.id])),
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
		(data.players ?? []).filter((p: Player) => {
			const v = parsedPoints[p.id];
			return Number.isNaN(v) || v >= 0;
		}),
	);

	function formatScore(score: number): string {
		return (score > 0 ? "+" : "") + score.toFixed(1);
	}

	const chipScores = $derived(
		(data.players ?? []).map((p: Player) => {
			const count = (data.chips ?? []).find((c: ChipEntry) => c.playerId === p.id)?.count ?? 0;
			return {
				playerId: p.id,
				score: Math.round((count * (data.group?.chip_rate ?? 0)) / 1000 * 10) / 10,
			};
		}),
	);

	const totals = $derived(
		(data.players ?? []).map((p: Player) => {
			const roundScore = (data.rounds ?? []).reduce((sum: number, round: Round) => {
				const r = round.results.find((r: RoundResult) => r.playerId === p.id);
				return sum + (r?.score ?? 0);
			}, 0);
			const chipScore = chipScores.find((c: { playerId: string; score: number }) => c.playerId === p.id)?.score ?? 0;
			return {
				playerId: p.id,
				score: Math.round((roundScore + chipScore) * 10) / 10,
			};
		}),
	);

	async function submitRound() {
		submitError = null;

		const results: { playerId: string; rawPoints: number }[] = (data.players ?? []).map(
			(p: Player) => ({
				playerId: p.id,
				rawPoints: parsedPoints[p.id] as number,
			}),
		);

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
			<div class="flex items-center gap-2">
				<Button variant="outline" size="sm" onclick={() => goto(`/groups/${data.group?.id}/settlement`)}>
					精算
				</Button>
				<DropdownMenu.Root onOpenChange={handleDropdownClose}>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button variant="default" size="sm" {...props}>
							登録
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					<DropdownMenu.Item onclick={() => (pendingAction = "form")}>
						成績登録
					</DropdownMenu.Item>
					<DropdownMenu.Item onclick={() => (pendingAction = "chip")}>
						チップ登録
					</DropdownMenu.Item>
					<DropdownMenu.Item onclick={() => (pendingAction = "advance")}>
						立替登録
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
			</div>
		</div>

		{#if showSettings}
			<div class="mb-4 rounded-lg border p-4 text-sm">
				<p class="mb-2 font-semibold">グループ設定</p>
				<dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
					<dt>レート</dt><dd class="text-right text-foreground">1000点 = {data.group.rate}G</dd>
					<dt>原点</dt><dd class="text-right text-foreground">{data.group.genten}点</dd>
					<dt>返し</dt><dd class="text-right text-foreground">{data.group.kaeshi}点</dd>
					<dt>ウマ</dt><dd class="text-right text-foreground">{data.group.uma_1} / {data.group.uma_2} / {data.group.uma_3} / {data.group.uma_4}</dd>
					<dt>チップ</dt><dd class="text-right text-foreground">1枚 = {data.group.chip_rate}点</dd>
					<dt>飛び賞</dt><dd class="text-right text-foreground">{data.group.tobi}</dd>
				</dl>
			</div>
		{/if}

		<!-- チップ入力ダイアログ -->
		<Dialog.Root bind:open={showChipForm}>
			<Dialog.Content class="max-h-[90dvh] overflow-y-auto">
				<Dialog.Header>
					<Dialog.Title>チップ登録</Dialog.Title>
				</Dialog.Header>

				<div class="space-y-3">
					{#each data.players as player}
						<div class="flex items-center gap-3">
							<Label class="w-20 shrink-0 {player.id === data.currentPlayerId ? 'font-bold' : ''}">
								{player.name}
							</Label>
							<InputGroup.Root class="flex-1">
								<InputGroup.Input
									type="number"
									bind:value={chipInputs[player.id]}
									placeholder="例: 3 / -2"
								/>
								<InputGroup.Addon align="inline-end">枚</InputGroup.Addon>
							</InputGroup.Root>
						</div>
					{/each}
				</div>

				<p class="text-sm {chipSumOk ? 'text-green-600' : 'text-muted-foreground'}">
					合計: {chipSum} / 0
					{#if chipSumOk}✓{/if}
				</p>

				{#if chipSubmitError}
					<Alert variant="destructive">
						<AlertDescription>{chipSubmitError}</AlertDescription>
					</Alert>
				{/if}

				<Dialog.Footer>
					<Button variant="outline" onclick={() => (showChipForm = false)} disabled={chipLoading} class="flex-1">
						キャンセル
					</Button>
					<Button onclick={submitChips} disabled={chipLoading} class="flex-1">
						{chipLoading ? "保存中..." : "保存"}
					</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>

		<!-- 立替登録ダイアログ -->
		<Dialog.Root bind:open={showAdvanceForm}>
			<Dialog.Content class="max-h-[90dvh] overflow-y-auto">
				<Dialog.Header>
					<Dialog.Title>立替登録</Dialog.Title>
				</Dialog.Header>

				<div class="space-y-4">
					<div>
						<Label class="mb-1 block text-sm font-medium">支払者</Label>
						<Select.Root type="single" bind:value={advancePayerId}>
							<Select.Trigger class="w-full">
								{data.players.find((p: Player) => p.id === advancePayerId)?.name ?? "選択してください"}
							</Select.Trigger>
							<Select.Content>
								{#each data.players as player}
									<Select.Item value={player.id}>{player.name}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div>
						<Label class="mb-1 block text-sm font-medium">対象者</Label>
						<div class="space-y-2">
							{#each data.players as player}
								<div class="flex items-center gap-2">
									<Checkbox
										id="beneficiary-{player.id}"
										checked={advanceBeneficiaryIds.includes(player.id)}
										onCheckedChange={() => toggleBeneficiary(player.id)}
									/>
									<Label for="beneficiary-{player.id}" class="font-normal">{player.name}</Label>
								</div>
							{/each}
						</div>
					</div>
					<div>
						<Label class="mb-1 block text-sm font-medium">内容</Label>
						<Input
							type="text"
							bind:value={advanceDescription}
							placeholder="例: 飲み物代"
						/>
					</div>
					<div>
						<Label class="mb-1 block text-sm font-medium">金額</Label>
						<InputGroup.Root>
							<InputGroup.Input
								type="number"
								bind:value={advanceAmount}
								placeholder="例: 500"
							/>
							<InputGroup.Addon align="inline-end">G</InputGroup.Addon>
						</InputGroup.Root>
					</div>
				</div>

				{#if advanceSubmitError}
					<Alert variant="destructive" class="mt-4">
						<AlertDescription>{advanceSubmitError}</AlertDescription>
					</Alert>
				{/if}

				<Dialog.Footer>
					<Button variant="outline" onclick={() => (showAdvanceForm = false)} disabled={advanceLoading} class="flex-1">
						キャンセル
					</Button>
					<Button onclick={submitAdvancePayment} disabled={advanceLoading} class="flex-1">
						{advanceLoading ? "登録中..." : "登録"}
					</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>

		<!-- 成績登録ダイアログ -->
		<Dialog.Root bind:open={showForm}>
			<Dialog.Content class="max-h-[90dvh] overflow-y-auto">
				<Dialog.Header>
					<Dialog.Title>成績登録</Dialog.Title>
				</Dialog.Header>

				<Label class="mb-2 block text-base font-semibold">点数</Label>
				<div class="mb-4 space-y-3">
					{#each data.players as player}
						<div class="flex items-center gap-3">
							<Label class="w-20 shrink-0 {player.id === data.currentPlayerId ? 'font-bold' : ''}">
								{player.name}
							</Label>
									<InputGroup.Root class="flex-1">
								<div class="pointer-events-none absolute inset-0 flex items-center pl-2.5 text-base md:translate-y-px md:text-sm">
									{#if displayInputs[player.id] === "-"}
										<span class="invisible">-</span>
									{:else if displayInputs[player.id]}
										<span class="invisible">{displayInputs[player.id]}</span><span class="text-muted-foreground">00</span>
									{:else if !hasPartialInput[player.id]}
										<span class="text-muted-foreground/60">例: 267</span><span class="text-muted-foreground/40">00</span>
									{/if}
								</div>
								<InputGroup.Input
									type="number"
									bind:value={rawPointInputs[player.id]}
									oninput={(e) => handleScoreInput(player.id, e)}
									class=""
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
					<Label class="mb-2 block text-base font-semibold">飛ばしたプレイヤー</Label>
					<div class="mb-4">
						<Select.Root type="single" bind:value={tobiKillerId}>
							<Select.Trigger class="w-full">
								{killerCandidates.find((p: Player) => p.id === tobiKillerId)?.name ?? (tobiKillerId === "none" ? "無し" : "選択してください")}
							</Select.Trigger>
							<Select.Content>
								{#each killerCandidates as player}
									<Select.Item value={player.id}>{player.name}</Select.Item>
								{/each}
								<Select.Item value="none">無し</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
				{/if}

				{#if hasTies}
					<Label class="mb-2 block text-base font-semibold">順位</Label>
					<div class="mb-4 space-y-1">
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
				{/if}

				{#if submitError}
					<Alert variant="destructive" class="mb-4">
						<AlertDescription>{submitError}</AlertDescription>
					</Alert>
				{/if}

				<Dialog.Footer>
					<Button variant="outline" onclick={() => (showForm = false)} disabled={loading} class="flex-1">
						キャンセル
					</Button>
					<Button onclick={submitRound} disabled={loading} class="flex-1">
						{loading ? "登録中..." : "登録"}
					</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>

		{#if data.rounds.length === 0}
			<p class="py-12 text-center text-sm text-muted-foreground">
				まだ成績が登録されていません
			</p>
		{:else if data.rounds.length > 0}
			<div class="-mx-4 overflow-x-auto">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-px text-muted-foreground">#</Table.Head>
							{#each data.players as player}
								<Table.Head
									class="text-right {player.id === data.currentPlayerId ? 'text-primary' : ''}"
								>
									{player.name}
								</Table.Head>
							{/each}
							<Table.Head class="w-px"></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body class={hasChips ? "[&_tr:last-child]:border-b" : ""}>
						{#each data.rounds as round, i}
							<Table.Row>
								<Table.Cell class="text-muted-foreground">{i + 1}</Table.Cell>
								{#each data.players as player}
									{@const result = round.results.find((r: RoundResult) => r.playerId === player.id)}
									<Table.Cell
										class="text-right tabular-nums {result && result.score > 0
											? 'text-cyan-600'
											: result && result.score < 0
												? 'text-rose-600'
												: ''}"
									>
										{result ? formatScore(result.score) : "−"}
									</Table.Cell>
								{/each}
								<Table.Cell>
									<Button
										variant="ghost"
										size="icon-sm"
										onclick={() => (deleteTargetRoundId = round.id)}
										aria-label="削除"
									>
										<XIcon class="size-4 text-muted-foreground" />
									</Button>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
					{#if hasChips}
						<Table.Body>
							<Table.Row>
								<Table.Cell class="text-muted-foreground">チップ</Table.Cell>
								{#each chipScores as chip}
									<Table.Cell
										class="text-right tabular-nums {chip.score > 0
											? 'text-cyan-600'
											: chip.score < 0
												? 'text-rose-600'
												: ''}"
									>
										{formatScore(chip.score)}
									</Table.Cell>
								{/each}
								<Table.Cell>
									<Button
										variant="ghost"
										size="icon-sm"
										onclick={() => (showDeleteChipConfirm = true)}
										aria-label="削除"
									>
										<XIcon class="size-4 text-muted-foreground" />
									</Button>
								</Table.Cell>
							</Table.Row>
						</Table.Body>
					{/if}
					<Table.Footer>
						<Table.Row>
							<Table.Cell class="font-bold">合計</Table.Cell>
							{#each totals as total}
								<Table.Cell
									class="text-right font-bold tabular-nums {total.score > 0
										? 'text-cyan-600'
										: total.score < 0
											? 'text-rose-600'
											: ''}"
								>
									{formatScore(total.score)}
								</Table.Cell>
							{/each}
								<Table.Cell></Table.Cell>
							</Table.Row>
						</Table.Footer>
				</Table.Root>
			</div>
		{/if}

		<!-- チップ削除確認ダイアログ -->
		<Dialog.Root bind:open={showDeleteChipConfirm}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>削除の確認</Dialog.Title>
				</Dialog.Header>
				<p class="text-sm text-muted-foreground">チップ収支を削除しますか？</p>
				<Dialog.Footer>
					<Button variant="outline" onclick={() => (showDeleteChipConfirm = false)} class="flex-1">キャンセル</Button>
					<Button variant="destructive" onclick={confirmDeleteChips} class="flex-1">削除</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>

		<!-- 対局削除確認ダイアログ -->
		<Dialog.Root open={deleteTargetRoundId !== null} onOpenChange={(open) => { if (!open) deleteTargetRoundId = null; }}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>削除の確認</Dialog.Title>
				</Dialog.Header>
				<p class="text-sm text-muted-foreground">この対局の成績を削除しますか？</p>
				<Dialog.Footer>
					<Button variant="outline" onclick={() => (deleteTargetRoundId = null)} class="flex-1">キャンセル</Button>
					<Button variant="destructive" onclick={confirmDeleteRound} class="flex-1">削除</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>

		<!-- 立替削除確認ダイアログ -->
		<Dialog.Root open={deleteTargetId !== null} onOpenChange={(open) => { if (!open) deleteTargetId = null; }}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>削除の確認</Dialog.Title>
				</Dialog.Header>
				<p class="text-sm text-muted-foreground">この立替記録を削除しますか？</p>
				<Dialog.Footer>
					<Button variant="outline" onclick={() => (deleteTargetId = null)} class="flex-1">キャンセル</Button>
					<Button variant="destructive" onclick={confirmDeleteAdvancePayment} class="flex-1">削除</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>

		{#if (data.advancePayments ?? []).length > 0}
			<div class="mt-6">
				<p class="mb-2 text-sm font-semibold">立替履歴</p>
				<div class="-mx-4 overflow-x-auto">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head class="text-muted-foreground">支払者</Table.Head>
								<Table.Head class="text-muted-foreground">対象者</Table.Head>
								<Table.Head class="text-muted-foreground">内容</Table.Head>
								<Table.Head class="text-right text-muted-foreground">金額</Table.Head>
								<Table.Head></Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.advancePayments as payment}
								{@const payer = data.players.find((p: Player) => p.id === payment.payerId)}
								{@const beneficiaryNames = payment.beneficiaryIds.map((id: string) => data.players.find((p: Player) => p.id === id)?.name ?? "?").join("、")}
								<Table.Row>
									<Table.Cell>{payer?.name ?? "?"}</Table.Cell>
									<Table.Cell>{beneficiaryNames}</Table.Cell>
									<Table.Cell>{payment.description}</Table.Cell>
									<Table.Cell class="text-right tabular-nums">{payment.amount.toLocaleString()}G</Table.Cell>
									<Table.Cell class="text-right">
										<Button
											variant="ghost"
											size="icon-sm"
											onclick={() => (deleteTargetId = payment.id)}
											aria-label="削除"
										>
											<XIcon class="size-4 text-muted-foreground" />
										</Button>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			</div>
		{/if}
	{/if}
</main>
