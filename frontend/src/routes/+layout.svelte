<script lang="ts">
	import '../app.css';
	import { Sun, Moon } from '@lucide/svelte';
	import { Switch } from '$lib/components/ui/switch';

	const { children } = $props();

	let dark = $state(false);

	$effect(() => {
		dark = document.documentElement.classList.contains('dark');
	});

	function toggleDark() {
		dark = !dark;
		document.documentElement.classList.toggle('dark', dark);
	}
</script>

<header class="sticky top-0 z-10 border-b bg-background px-4 py-3">
	<div class="flex items-center justify-between">
		<a href="/" class="text-lg font-bold tracking-tight">tenbou</a>
		<div class="flex items-center gap-1.5">
			<Sun size={16} class="text-muted-foreground" />
			<Switch checked={dark} onCheckedChange={toggleDark} aria-label="ダークモード切替" />
			<Moon size={16} class="text-muted-foreground" />
		</div>
	</div>
</header>

{@render children()}
