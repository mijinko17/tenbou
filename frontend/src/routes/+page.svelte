<script lang="ts">
	import { onMount } from "svelte";

	type VisitedGroup = { id: string; name: string };

	let visitedGroups = $state<VisitedGroup[]>([]);

	onMount(() => {
		const raw = localStorage.getItem("tenbou_visited_groups");
		if (raw) {
			try {
				visitedGroups = JSON.parse(raw) as VisitedGroup[];
			} catch {
				// 壊れていたら無視
			}
		}
	});
</script>

<main class="mx-auto max-w-lg px-4 py-12">
	<div class="mb-10 text-center">
		<h1 class="mb-2 text-3xl font-bold tracking-tight">tenbou</h1>
		<p class="text-muted-foreground">麻雀成績管理アプリ</p>
	</div>

	<a
		href="/groups/create"
		class="mb-12 flex w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90"
	>
		はじめる
	</a>

	<ul class="space-y-4">
		<li class="flex gap-3">
			<span class="mt-0.5 text-primary">✓</span>
			<div>
				<p class="font-medium">素点を入力するだけでスコア計算</p>
				<p class="text-sm text-muted-foreground">ウマ・オカを考慮した最終スコアを自動で算出します。</p>
			</div>
		</li>
		<li class="flex gap-3">
			<span class="mt-0.5 text-primary">✓</span>
			<div>
				<p class="font-medium">立替を管理可能</p>
				<p class="text-sm text-muted-foreground">場代などの立替をまとめて記録できます。</p>
			</div>
		</li>
		<li class="flex gap-3">
			<span class="mt-0.5 text-primary">✓</span>
			<div>
				<p class="font-medium">各メンバーの支払額を計算可能</p>
				<p class="text-sm text-muted-foreground">誰が誰にいくら払うかを最適化して表示します。</p>
			</div>
		</li>
	</ul>

	{#if visitedGroups.length > 0}
		<section class="mt-10">
			<h2 class="mb-3 text-sm font-medium text-muted-foreground">参加したグループ</h2>
			<ul class="space-y-2">
				{#each visitedGroups as group}
					<li>
						<a
							href="/groups/{group.id}"
							class="flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
						>
							<span>{group.name}</span>
							<span class="text-muted-foreground">→</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>
