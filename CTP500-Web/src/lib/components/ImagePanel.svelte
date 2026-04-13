<script lang="ts">
	import { connectionStore } from '$lib/stores/connection';
	import { printImage } from '$lib/printer/PrinterService';
	import { activityLogStore } from '$lib/stores/activityLog';
	import { generateThumbnail } from '$lib/printer/ImageProcessor';

	let selectedFile: File | null = null;
	let previewUrl: string | null = null;
	let isPrinting = false;
	let fileInput: HTMLInputElement;

	async function handleSelectImage() {
		fileInput.click();
	}

	async function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		// Validate file type
		const validTypes = ['image/png', 'image/jpeg', 'image/bmp'];
		if (!validTypes.includes(file.type)) {
			activityLogStore.add('error', 'Invalid file type. Use PNG, JPG, or BMP.');
			return;
		}

		selectedFile = file;
		
		// Generate thumbnail
		try {
			previewUrl = await generateThumbnail(file, 200);
			activityLogStore.add('info', `Selected: ${file.name}`);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			activityLogStore.add('error', `Preview failed: ${msg}`);
		}
	}

	async function handlePrint() {
		if (!selectedFile) {
			activityLogStore.add('warning', 'No image selected');
			return;
		}
		if ($connectionStore.status !== 'connected') {
			activityLogStore.add('error', 'Not connected to printer');
			return;
		}

		isPrinting = true;
		try {
			await printImage(selectedFile);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			activityLogStore.add('error', `Print failed: ${msg}`);
		} finally {
			isPrinting = false;
		}
	}

	function handleClear() {
		selectedFile = null;
		previewUrl = null;
	}
</script>

<div class="image-panel">
	<div class="panel-header">
		<h3>Image Print</h3>
	</div>

	<div class="preview-area">
		{#if previewUrl}
			<img src={previewUrl} alt="Preview" class="preview-image" />
			<div class="file-name">{selectedFile?.name}</div>
		{:else}
			<div class="empty-state">
				<span class="empty-icon">🖼️</span>
				<span>No image selected</span>
			</div>
		{/if}
	</div>

	<div class="actions">
		<button class="btn btn-secondary" onclick={handleSelectImage}>
			Select Image
		</button>
		{#if previewUrl}
			<button class="btn btn-secondary" onclick={handleClear}>
				Clear
			</button>
		{/if}
		<button 
			class="btn btn-primary" 
			onclick={handlePrint}
			disabled={!selectedFile || isPrinting || $connectionStore.status !== 'connected'}
		>
			{isPrinting ? 'Printing...' : 'Print Image'}
		</button>
	</div>

	<input 
		bind:this={fileInput}
		type="file" 
		accept="image/png,image/jpeg,image/bmp"
		onchange={handleFileChange}
		hidden
	/>
</div>

<style>
.image-panel {
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

.preview-area {
	background: #0d0d14;
	border: 1px solid #333;
	border-radius: 8px;
	min-height: 150px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 1rem;
}

.preview-image {
	max-width: 100%;
	max-height: 200px;
	object-fit: contain;
	border-radius: 4px;
}

.file-name {
	margin-top: 0.75rem;
	font-size: 0.85rem;
	color: #888;
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5rem;
	color: #555;
}

.empty-icon {
	font-size: 2rem;
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