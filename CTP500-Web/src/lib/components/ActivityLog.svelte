<script lang="ts">
	import { activityLogStore, type LogEntry } from '$lib/stores/activityLog';

	function formatTime(date: Date): string {
		return date.toLocaleTimeString('en-US', { hour12: false });
	}

	function getLevelColor(level: LogEntry['level']): string {
		switch (level) {
			case 'success': return '#27ae60';
			case 'warning': return '#f39c12';
			case 'error': return '#e74c3c';
			default: return '#888';
		}
	}
</script>

<div class="activity-log">
	<div class="log-header">
		<h3>Activity Log</h3>
		<button class="btn-clear" onclick={() => activityLogStore.clear()}>
			Clear
		</button>
	</div>

	<div class="log-entries">
		{#each $activityLogStore as entry}
			<div class="log-entry">
				<span class="timestamp">[{formatTime(entry.timestamp)}]</span>
				<span class="level" style="color: {getLevelColor(entry.level)}">[{entry.level}]</span>
				<span class="message">{entry.message}</span>
			</div>
		{/each}

		{#if $activityLogStore.length === 0}
			<div class="empty">No activity yet</div>
		{/if}
	</div>
</div>

<style>
.activity-log {
	background: #0d0d14;
	border: 1px solid #333;
	border-radius: 12px;
	overflow: hidden;
}

.log-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 1rem 1.25rem;
	background: #1a1a24;
	border-bottom: 1px solid #333;
}

.log-header h3 {
	margin: 0;
	font-size: 1rem;
	color: #888;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.btn-clear {
	background: none;
	border: none;
	color: #666;
	cursor: pointer;
	font-size: 0.85rem;
}

.btn-clear:hover {
	color: #888;
}

.log-entries {
	height: 200px;
	overflow-y: auto;
	padding: 1rem;
	font-family: 'Menlo', 'Monaco', monospace;
	font-size: 0.85rem;
	line-height: 1.6;
}

.log-entry {
	display: flex;
	gap: 0.5rem;
}

.timestamp {
	color: #555;
	flex-shrink: 0;
}

.level {
	flex-shrink: 0;
	font-weight: 600;
	min-width: 60px;
}

.message {
	color: #ccc;
	word-break: break-word;
}

.empty {
	color: #444;
	font-style: italic;
}

/* Scrollbar styling */
.log-entries::-webkit-scrollbar {
	width: 8px;
}

.log-entries::-webkit-scrollbar-track {
	background: #0d0d14;
}

.log-entries::-webkit-scrollbar-thumb {
	background: #333;
	border-radius: 4px;
}

.log-entries::-webkit-scrollbar-thumb:hover {
	background: #444;
}
</style>