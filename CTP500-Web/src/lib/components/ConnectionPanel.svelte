<script lang="ts">
	import { connectionStore } from '$lib/stores/connection';
	import { activityLogStore } from '$lib/stores/activityLog';
	import { scan, disconnect } from '$lib/bluetooth/BLEService';

	const statusColors = {
		disconnected: '#6b7280',
		scanning: '#f39c12',
		connecting: '#3498db',
		connected: '#27ae60'
	};

	const statusLabels = {
		disconnected: 'Disconnected',
		scanning: 'Scanning...',
		connecting: 'Connecting...',
		connected: 'Connected'
	};

	async function handleScan() {
		try {
			await scan();
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Scan failed';
			activityLogStore.add('error', msg);
		}
	}

	async function handleDisconnect() {
		await disconnect();
	}
</script>

<div class="connection-panel">
	<div class="status-row">
		<div class="status-dot" style="background: {statusColors[$connectionStore.status]}"></div>
		<span class="status-label">{statusLabels[$connectionStore.status]}</span>
		{#if $connectionStore.device}
			<span class="device-name">{$connectionStore.device.name}</span>
		{/if}
	</div>

	{#if $connectionStore.batteryLevel !== null}
		<div class="battery-row">
			<span class="battery-label">Battery:</span>
			<div class="battery-bar">
				<div 
					class="battery-fill" 
					style="width: {$connectionStore.batteryLevel}%; 
						   background: {$connectionStore.batteryLevel > 60 ? '#27ae60' : $connectionStore.batteryLevel > 30 ? '#f39c12' : '#e74c3c'}"
				></div>
			</div>
			<span class="battery-value">{$connectionStore.batteryLevel}%</span>
			{#if $connectionStore.batteryVoltage}
				<span class="battery-voltage">({$connectionStore.batteryVoltage})</span>
			{/if}
		</div>
	{/if}

	<div class="actions">
		{#if $connectionStore.status === 'disconnected'}
			<button class="btn btn-primary" onclick={handleScan}>
				Scan & Connect
			</button>
		{:else if $connectionStore.status === 'connected'}
			<button class="btn btn-danger" onclick={handleDisconnect}>
				Disconnect
			</button>
		{/if}
	</div>

	{#if $connectionStore.error}
		<div class="error">{$connectionStore.error}</div>
	{/if}
</div>

<style>
.connection-panel {
	background: #1e1e2e;
	border-radius: 12px;
	padding: 1.5rem;
	margin-bottom: 1.5rem;
}

.status-row {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	margin-bottom: 1rem;
}

.status-dot {
	width: 12px;
	height: 12px;
	border-radius: 50%;
	transition: background 0.3s;
}

.status-label {
	font-size: 1.1rem;
	font-weight: 600;
	color: #fff;
}

.device-name {
	color: #888;
	font-size: 0.9rem;
}

.battery-row {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	margin-bottom: 1rem;
}

.battery-label {
	color: #888;
	font-size: 0.9rem;
}

.battery-bar {
	flex: 1;
	max-width: 120px;
	height: 8px;
	background: #333;
	border-radius: 4px;
	overflow: hidden;
}

.battery-fill {
	height: 100%;
	transition: width 0.3s, background 0.3s;
}

.battery-value {
	color: #fff;
	font-size: 0.9rem;
	font-weight: 600;
}

.battery-voltage {
	color: #666;
	font-size: 0.8rem;
}

.actions {
	display: flex;
	gap: 0.75rem;
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

.btn:hover {
	opacity: 0.9;
	transform: translateY(-1px);
}

.btn:active {
	transform: translateY(0);
}

.btn-primary {
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: #fff;
}

.btn-danger {
	background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
	color: #fff;
}

.error {
	margin-top: 1rem;
	padding: 0.75rem;
	background: rgba(231, 76, 60, 0.2);
	border: 1px solid #e74c3c;
	border-radius: 8px;
	color: #e74c3c;
	font-size: 0.9rem;
}

.unsupported {
	padding: 0.75rem 1rem;
	background: rgba(243, 156, 18, 0.15);
	border: 1px solid #f39c12;
	border-radius: 8px;
	color: #f39c12;
	font-size: 0.9rem;
	text-align: center;
}
</style>