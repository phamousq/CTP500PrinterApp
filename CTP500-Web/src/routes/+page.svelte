<script lang="ts">
	import SafariWarning from '$lib/components/SafariWarning.svelte';
	import ConnectionPanel from '$lib/components/ConnectionPanel.svelte';
	import TextPanel from '$lib/components/TextPanel.svelte';
	import ImagePanel from '$lib/components/ImagePanel.svelte';
	import ActivityLog from '$lib/components/ActivityLog.svelte';
</script>

<svelte:head>
	<title>CTP500 Printer</title>
</svelte:head>

<SafariWarning />

<div class="app">
	<header>
		<h1>🖨️ CTP500 Printer</h1>
		<p class="subtitle">Thermal Printer Control Panel</p>
	</header>

	<main>
		<ConnectionPanel />
		
		<div class="panels">
			<TextPanel />
			<ImagePanel />
		</div>

		<ActivityLog />
	</main>

	<footer>
		<p>Chrome or Edge required for Bluetooth support</p>
	</footer>
</div>

<style>
:global(body) {
	margin: 0;
	padding: 0;
	background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
	min-height: 100vh;
	color: #fff;
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app {
	max-width: 800px;
	margin: 0 auto;
	padding: 2rem 1.5rem;
}

header {
	text-align: center;
	margin-bottom: 2rem;
}

header h1 {
	margin: 0;
	font-size: 2rem;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
}

.subtitle {
	margin: 0.5rem 0 0 0;
	color: #666;
	font-size: 1rem;
}

main {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.panels {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 1.5rem;
}

@media (max-width: 700px) {
	.panels {
		grid-template-columns: 1fr;
	}
}

footer {
	text-align: center;
	margin-top: 2rem;
	color: #444;
	font-size: 0.85rem;
}
</style>