<script lang="ts">
	import { goto } from "$app/navigation";
	import { Button } from "$lib/components/ui/button";
	import * as Card from "$lib/components/ui/card";
	import { Separator } from "$lib/components/ui/separator";
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow,
	} from "$lib/components/ui/table";
	import { ChevronLeft, ChevronDown, ChevronUp } from "@lucide/svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	const playerMap = $derived(new Map(data.players.map((p) => [p.id, p.name])));

	function formatG(g: number): string {
		return (g >= 0 ? "+" : "") + g.toLocaleString() + "G";
	}

	function formatScore(s: number): string {
		return (s >= 0 ? "+" : "") + s.toFixed(1);
	}

	let showBreakdown = $state(false);
</script>

<div class="mx-auto max-w-lg px-4 py-6">
	<div class="mb-6 flex items-center gap-2">
		<Button
			variant="ghost"
			size="icon"
			onclick={() => goto(`/groups/${data.groupId}`)}
		>
			<ChevronLeft class="h-5 w-5" />
		</Button>
		<h1 class="text-xl font-bold">精算</h1>
	</div>

	{#if data.error}
		<p class="text-destructive">{data.error}</p>
	{:else}
		<!-- 支払い一覧 -->
		<section class="mb-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>支払い</Card.Title>
				</Card.Header>
				<Card.Content class="px-0 pb-0">
					{#if data.payments.length === 0}
						<p class="px-6 pb-6 text-center text-sm text-muted-foreground">
							精算なし（全員ゼロ）
						</p>
					{:else}
						{#each data.payments as payment, i}
							{#if i > 0}
								<Separator />
							{/if}
							<div class="flex items-center justify-between px-6 py-3">
								<span class="text-sm">
									<span class="font-medium">{playerMap.get(payment.from)}</span>
									<span class="mx-2 text-muted-foreground">→</span>
									<span class="font-medium">{playerMap.get(payment.to)}</span>
								</span>
								<span class="text-base font-bold">
									{payment.amount.toLocaleString()}G
								</span>
							</div>
						{/each}
						<div class="h-2"></div>
					{/if}
				</Card.Content>
			</Card.Root>
		</section>

		<!-- 内訳（折りたたみ） -->
		<section>
			<button
				class="flex w-full items-center justify-between py-2 text-sm font-semibold text-muted-foreground"
				onclick={() => (showBreakdown = !showBreakdown)}
			>
				<span>内訳</span>
				{#if showBreakdown}
					<ChevronUp class="h-4 w-4" />
				{:else}
					<ChevronDown class="h-4 w-4" />
				{/if}
			</button>

			{#if showBreakdown}
				<div class="overflow-x-auto rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead class="min-w-20">プレイヤー</TableHead>
								<TableHead class="text-right">対局</TableHead>
								<TableHead class="text-right">チップ</TableHead>
								<TableHead class="text-right">小計</TableHead>
								<TableHead class="text-right">立替</TableHead>
								<TableHead class="text-right font-bold">収支</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each data.breakdown as row}
								{@const name = playerMap.get(row.playerId) ?? ""}
								<TableRow>
									<TableCell class="font-medium">{name}</TableCell>
									<TableCell class="text-right text-xs">
										<div>{formatScore(row.gameScoreTotal)}</div>
										<div class="text-muted-foreground">{formatG(row.gameG)}</div>
									</TableCell>
									<TableCell class="text-right text-xs">
										{#if row.chipScore !== 0 || row.chipG !== 0}
											<div>{formatScore(row.chipScore)}</div>
											<div class="text-muted-foreground">{formatG(row.chipG)}</div>
										{:else}
											<span class="text-muted-foreground">—</span>
										{/if}
									</TableCell>
									<TableCell class="text-right text-sm">{formatG(row.subtotalG)}</TableCell>
									<TableCell class="text-right text-sm">
										{#if row.advanceAdjustment !== 0}
											{formatG(row.advanceAdjustment)}
										{:else}
											<span class="text-muted-foreground">—</span>
										{/if}
									</TableCell>
									<TableCell
										class="text-right text-sm font-bold {row.finalBalance > 0
											? 'text-cyan-600'
											: row.finalBalance < 0
												? 'text-rose-600'
												: ''}"
									>
										{formatG(row.finalBalance)}
									</TableCell>
								</TableRow>
							{/each}
						</TableBody>
					</Table>
				</div>
			{/if}
		</section>
	{/if}
</div>
