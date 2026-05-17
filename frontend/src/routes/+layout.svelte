<script lang="ts">
	import '../app.css';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import { ModeWatcher, resetMode, setMode } from 'mode-watcher';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { buttonVariants } from '$lib/components/ui/button/index.js';

	const { children } = $props();
</script>

<ModeWatcher />

<header class="sticky top-0 z-10 border-b bg-background px-4 py-3">
	<div class="flex items-center justify-between">
		<a href="/" class="text-lg font-bold tracking-tight">tenbou</a>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class={buttonVariants({ variant: 'outline', size: 'icon' })}>
				<SunIcon class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all! dark:scale-0 dark:-rotate-90" />
				<MoonIcon class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all! dark:scale-100 dark:rotate-0" />
				<span class="sr-only">Toggle theme</span>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Item onclick={() => setMode('light')}>ライト</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => setMode('dark')}>ダーク</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => resetMode()}>システム</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</header>

{@render children()}
