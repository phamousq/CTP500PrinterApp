<script lang="ts">
	import { connectionStore } from '$lib/stores/connection';
	import { printText } from '$lib/printer/PrinterService';
	import { activityLogStore } from '$lib/stores/activityLog';

	let text = '';
	let isPrinting = false;
	let fileInput: HTMLInputElement;

	async function handlePrint() {
		if (!text.trim()) {
			activityLogStore.add('warning', 'Nothing to print');
			return;
		}
		if ($connectionStore.status !== 'connected') {
			activityLogStore.add('error', 'Not connected to printer');
			return;
		}

		isPrinting = true;
		try {
			await printText(text);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			activityLogStore.add('error', `Print failed: ${msg}`);
		} finally {
			isPrinting = false;
		}
	}

	async function handleLoadFile() {
		fileInput.click();
	}

	async function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const content = await file.text();
		text = content;
		activityLogStore.add('info', `Loaded: ${file.name}`);
	}
</script>

<div class="text-panel">
	<div class="panel-header">
		<h3>Text Print</h3>
	</div>

	<textarea 
		bind:value={text}
		placeholder="Enter text to print..."
		rows={8}
	></textarea>

	<div class="actions">
		<button class="btn btn-secondary" onclick={handleLoadFile}>
			Load .txt
		</button>
		<button 
			class="btn btn-primary" 
			onclick={handlePrint}
			disabled={isPrinting || $connectionStore.status !== 'connected'}
		>
			{isPrinting ? 'Printing...' : 'Print Text'}
		</button>
	</div>

	<input 
		bind:this={fileInput}
		type="file" 
		accept=".txt"
		onchange={handleFileChange}
		hidden
	/>
</div>

<style>
.text-panel {
	background: #1e1e2e;
	border-radius: 12px;
	padding: 1.5rem;
	margin-bottom: 1.5rem;
}

.panel-header h3 {
	margin: 0 0 1rem 0;
	font-size: 1.25rem;
	color: #fff;
}

textarea {
	width: 100%;
	padding: 1rem;
	background: #0d0d14;
	border: 1px solid #333;
	border-radius: 8px;
	color: #fff;
	font-family: 'Menlo', 'Monaco', monospace;
	font-size: 0.95rem;
	resize: vertical;
	box-sizing: border-box;
}

textarea::placeholder {
	color: #555;
}

textarea:focus {
	outline: none;
	border-color: #667eea;
}

.actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.75rem;
	margin-top: 1rem;
}

.btn {
	padding: 0.75rem 1.5rem;
	border: none;
	border-radius: 8px;
	font-size: 1rem;
	font-weight: 600;
	cursor: pointer;
	transition: opacity 0.2s, transform 0.1s;
}

.btn:hover:not(:disabled) {
	opacity: 0.9;
	transform: translateY(-1px);
}

.btn:active:not(:disabled) {
	transform: translateY(0);
}

.btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.btn-primary {
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: #fff;
}

.btn-secondary {
	background: #333;
	color: #ccc;
}
</style>