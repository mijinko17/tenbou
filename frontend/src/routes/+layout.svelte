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
		<div class="flex items-center gap-2">
			<a
				href="https://github.com/mijinko17/tenbou"
				target="_blank"
				rel="noopener noreferrer"
				class={buttonVariants({ variant: 'outline', size: 'icon' })}
				aria-label="GitHub リポジトリ"
			>
				<svg class="h-[1.2rem] w-[1.2rem]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
					</svg>
			</a>
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
	</div>
</header>

{@render children()}
