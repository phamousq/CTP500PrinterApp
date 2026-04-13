<script lang="ts">
	// Safari detection
	function isSafari(): boolean {
		const ua = navigator.userAgent.toLowerCase();
		return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium');
	}

	let isSafariBrowser = isSafari();
</script>

{#if isSafariBrowser}
<div class="warning">
	<div class="warning-icon">⚠️</div>
	<h2>Safari Not Supported</h2>
	<p>This app requires Chrome or Edge for Web Bluetooth support.</p>
	<p>Please open this app in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.</p>
</div>
{/if}

<style>
.warning {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 100vh;
	padding: 2rem;
	text-align: center;
	background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
	color: #fff;
}

.warning-icon {
	font-size: 4rem;
	margin-bottom: 1rem;
}

h2 {
	font-size: 1.75rem;
	margin: 0 0 1rem 0;
	color: #f39c12;
}

p {
	font-size: 1.1rem;
	opacity: 0.9;
	margin: 0.5rem 0;
}

strong {
	color: #3498db;
}
</style>