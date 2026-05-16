<script lang="ts">
	import { goto } from "$app/navigation";
	import { API_URL } from "$lib/api";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { InputGroup, InputGroupAddon, InputGroupInput } from "$lib/components/ui/input-group";
	import { Label } from "$lib/components/ui/label";
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";

	let groupName = $state("");
	let players = $state(["", "", "", ""]);
	let rate = $state(50);
	let chipRate = $state(2000);
	let umaPreset = $state<"10-20" | "10-30" | "custom">("10-20");
	let umaCustom = $state([20, 10, -10, -20]);
	let tobi = $state(10);

	let gentenRaw = $state(25);
	let gentenDisplay = $state("25");
	let gentenPartial = $state(false);
	const genten = $derived(gentenRaw * 1000);

	let kaeshiRaw = $state(30);
	let kaeshiDisplay = $state("30");
	let kaeshiPartial = $state(false);
	const kaeshi = $derived(kaeshiRaw * 1000);

	let groupId = $state<string | null>(null);
	let inviteToken = $state<string | null>(null);
	let errorMsg = $state<string | null>(null);
	let loading = $state(false);

	const uma = $derived(
		umaPreset === "10-20"
			? ([20, 10, -10, -20] as [number, number, number, number])
			: umaPreset === "10-30"
				? ([30, 10, -10, -30] as [number, number, number, number])
				: (umaCustom as [number, number, number, number]),
	);

	const inviteUrl = $derived(
		inviteToken ? `${location.origin}/invite/${inviteToken}` : "",
	);
	const dashboardUrl = $derived(
		groupId ? `${location.origin}/groups/${groupId}` : "",
	);

	function handleThousandInput(
		e: Event,
		setDisplay: (v: string) => void,
		setPartial: (v: boolean) => void,
	) {
		const input = e.currentTarget as HTMLInputElement;
		if (input.value !== "") {
			setDisplay(input.value);
			setPartial(false);
		} else if (!input.validity.badInput) {
			setDisplay("");
			setPartial(false);
		} else {
			setDisplay("");
			setPartial(true);
		}
	}

	async function submit() {
		errorMsg = null;
		loading = true;
		try {
			const res = await fetch(`${API_URL}/groups`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					name: groupName,
					players: players.map((p) => p.trim()).filter(Boolean),
					rate,
					chipRate,
					uma,
					tobi,
					genten,
					kaeshi,
				}),
			});

			const data = (await res.json()) as {
				groupId?: string;
				inviteToken?: string;
				error?: string;
			};
			if (!res.ok) {
				errorMsg = data.error ?? "エラーが発生しました";
				return;
			}
			groupId = data.groupId ?? null;
			inviteToken = data.inviteToken ?? null;
		} catch {
			errorMsg = "通信エラーが発生しました";
		} finally {
			loading = false;
		}
	}

	async function copyLink() {
		await navigator.clipboard.writeText(inviteUrl);
	}
</script>

<main class="mx-auto max-w-lg px-4 py-8">
	<h1 class="mb-6 text-2xl font-bold">グループ作成</h1>

	{#if groupId}
		<div class="rounded-lg border border-green-200 bg-green-50 p-4 space-y-4">
			<p class="font-semibold text-green-800">グループを作成しました！</p>

			<div class="space-y-1">
				<p class="text-sm text-green-700">ダッシュボード:</p>
				<p class="rounded bg-white border px-3 py-2 font-mono text-sm break-all">{dashboardUrl}</p>
			</div>

			<div class="flex gap-2">
				<Button onclick={() => goto(`/groups/${groupId}`)}>ダッシュボードへ</Button>
				<Button variant="outline" onclick={copyLink}>招待リンクをコピー</Button>
			</div>
		</div>
	{:else}
		<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="space-y-6">
			<div class="space-y-1.5">
				<Label for="group-name">グループ名</Label>
				<Input
					id="group-name"
					bind:value={groupName}
					type="text"
					maxlength={30}
					required
					placeholder="例: 週末麻雀メンバー"
				/>
			</div>

			<fieldset class="space-y-2">
				<legend class="text-sm font-medium mb-2">参加者</legend>
				{#each players as _, i}
					<Input
						bind:value={players[i]}
						type="text"
						maxlength={10}
						required
						placeholder={`参加者${i + 1}`}
					/>
				{/each}
			</fieldset>

			<div class="space-y-1.5">
				<Label for="rate">レート</Label>
				<InputGroup>
					<InputGroupAddon>1000点 =</InputGroupAddon>
					<InputGroupInput id="rate" bind:value={rate} type="number" min={1} required />
					<InputGroupAddon align="inline-end">G</InputGroupAddon>
				</InputGroup>
			</div>

			<div class="space-y-1.5">
				<Label for="chip-rate">チップ</Label>
				<InputGroup>
					<InputGroupAddon>1枚 =</InputGroupAddon>
					<InputGroupInput id="chip-rate" bind:value={chipRate} type="number" min={1} required />
					<InputGroupAddon align="inline-end">点</InputGroupAddon>
				</InputGroup>
			</div>

			<div class="space-y-1.5">
				<Label for="genten">原点</Label>
				<InputGroup>
					<div class="pointer-events-none absolute inset-0 flex items-center pl-2.5 text-base md:translate-y-px md:text-sm">
						{#if gentenDisplay}
							<span class="invisible">{gentenDisplay}</span><span class="text-muted-foreground">000</span>
						{:else if !gentenPartial}
							<span class="text-muted-foreground/60">例: 25</span><span class="text-muted-foreground/40">000</span>
						{/if}
					</div>
					<InputGroupInput
						id="genten"
						bind:value={gentenRaw}
						type="number"
						min={1}
						required
						oninput={(e) => handleThousandInput(e, (v) => (gentenDisplay = v), (v) => (gentenPartial = v))}
					/>
					<InputGroupAddon align="inline-end">点</InputGroupAddon>
				</InputGroup>
			</div>

			<div class="space-y-1.5">
				<Label for="kaeshi">返し</Label>
				<InputGroup>
					<div class="pointer-events-none absolute inset-0 flex items-center pl-2.5 text-base md:translate-y-px md:text-sm">
						{#if kaeshiDisplay}
							<span class="invisible">{kaeshiDisplay}</span><span class="text-muted-foreground">000</span>
						{:else if !kaeshiPartial}
							<span class="text-muted-foreground/60">例: 30</span><span class="text-muted-foreground/40">000</span>
						{/if}
					</div>
					<InputGroupInput
						id="kaeshi"
						bind:value={kaeshiRaw}
						type="number"
						min={1}
						required
						oninput={(e) => handleThousandInput(e, (v) => (kaeshiDisplay = v), (v) => (kaeshiPartial = v))}
					/>
					<InputGroupAddon align="inline-end">点</InputGroupAddon>
				</InputGroup>
			</div>

			<fieldset class="space-y-2">
				<legend class="text-sm font-medium mb-2">ウマ</legend>
				<RadioGroup bind:value={umaPreset} class="flex gap-6">
					{#each (["10-20", "10-30", "custom"] as const) as preset}
						<div class="flex items-center gap-2">
							<RadioGroupItem value={preset} id="uma-{preset}" />
							<Label for="uma-{preset}">{preset === "custom" ? "カスタム" : preset}</Label>
						</div>
					{/each}
				</RadioGroup>
				{#if umaPreset === "custom"}
					<div class="grid grid-cols-4 gap-2 mt-2">
						{#each (["1着", "2着", "3着", "4着"] as const) as rankLabel, i}
							<div class="space-y-1">
								<Label for="uma-{i}" class="text-xs">{rankLabel}</Label>
								<Input id="uma-{i}" bind:value={umaCustom[i]} type="number" />
							</div>
						{/each}
					</div>
				{/if}
			</fieldset>

			<div class="space-y-1.5">
				<Label for="tobi">トビ賞</Label>
				<Input id="tobi" bind:value={tobi} type="number" min={0} required />
			</div>

			{#if errorMsg}
				<Alert variant="destructive">
					<AlertDescription>{errorMsg}</AlertDescription>
				</Alert>
			{/if}

			<Button type="submit" disabled={loading} class="w-full py-6">
				{loading ? "作成中..." : "グループを作成"}
			</Button>
		</form>
	{/if}
</main>
