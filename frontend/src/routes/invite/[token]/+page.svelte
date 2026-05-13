<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { API_URL } from "$lib/api";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";

	type Group = {
		id: string;
		name: string;
		rate: number;
		chip_rate: number;
		uma_1: number;
		uma_2: number;
		uma_3: number;
		uma_4: number;
		genten: number;
		kaeshi: number;
	};

	type Player = { id: string; name: string };

	const { data } = $props<{
		data: { group: Group | null; players: Player[]; error?: string };
	}>();

	let mode = $state<"select" | "new">("select");
	let selectedPlayerId = $state<string>("");
	let newName = $state("");
	let errorMsg = $state<string | null>(null);
	let loading = $state(false);

	const token = $derived($page.params.token);

	async function join() {
		errorMsg = null;
		loading = true;
		try {
			const body =
				mode === "select" ? { playerId: selectedPlayerId } : { name: newName.trim() };
			const res = await fetch(`${API_URL}/invite/${token}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(body),
			});

			const json = (await res.json()) as { error?: string };
			if (!res.ok) {
				errorMsg = json.error ?? "エラーが発生しました";
				return;
			}
			goto("/");
		} catch {
			errorMsg = "通信エラーが発生しました";
		} finally {
			loading = false;
		}
	}
</script>

<main class="mx-auto max-w-lg px-4 py-8">
	{#if data.error}
		<Alert variant="destructive">
			<AlertDescription>{data.error}</AlertDescription>
		</Alert>
	{:else if data.group}
		<h1 class="mb-1 text-2xl font-bold">{data.group.name}</h1>
		<p class="mb-6 text-sm text-muted-foreground">
			レート: スコア1={data.group.rate}G ／ 原点: {data.group.genten} ／ 返し: {data.group.kaeshi}
		</p>

		<h2 class="mb-4 text-base font-semibold">あなたはどなたですか？</h2>

		<RadioGroup bind:value={mode} class="mb-5 flex gap-6">
			<div class="flex items-center gap-2">
				<RadioGroupItem value="select" id="mode-select" />
				<Label for="mode-select">参加者から選ぶ</Label>
			</div>
			<div class="flex items-center gap-2">
				<RadioGroupItem value="new" id="mode-new" />
				<Label for="mode-new">新しい名前で参加</Label>
			</div>
		</RadioGroup>

		{#if mode === "select"}
			<RadioGroup bind:value={selectedPlayerId} class="mb-5 space-y-2">
				{#each data.players as player}
					<label
						class="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
					>
						<RadioGroupItem value={player.id} id="player-{player.id}" />
						<span class="text-base">{player.name}</span>
					</label>
				{/each}
			</RadioGroup>
		{:else}
			<div class="mb-5 space-y-1.5">
				<Label for="new-name">名前を入力</Label>
				<Input
					id="new-name"
					bind:value={newName}
					type="text"
					maxlength={10}
					placeholder="名前"
				/>
			</div>
		{/if}

		{#if errorMsg}
			<Alert variant="destructive" class="mb-4">
				<AlertDescription>{errorMsg}</AlertDescription>
			</Alert>
		{/if}

		<Button
			onclick={join}
			disabled={loading ||
				(mode === "select" && !selectedPlayerId) ||
				(mode === "new" && !newName.trim())}
			class="w-full py-6"
		>
			{loading ? "参加中..." : "参加する"}
		</Button>
	{/if}
</main>
