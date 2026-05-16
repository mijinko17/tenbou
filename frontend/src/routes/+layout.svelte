<script lang="ts">
	import '../app.css';
	const { children } = $props();
</script>

<header class="sticky top-0 z-10 border-b bg-background px-4 py-3">
	<a href="/" class="text-lg font-bold tracking-tight">tenbou</a>
</header>

{@render children()}
