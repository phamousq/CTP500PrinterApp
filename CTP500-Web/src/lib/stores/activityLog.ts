import { writable } from 'svelte/store';

export interface LogEntry {
	timestamp: Date;
	level: 'info' | 'success' | 'warning' | 'error';
	message: string;
}

function createActivityLogStore() {
	const { subscribe, update } = writable<LogEntry[]>([]);

	return {
		subscribe,
		add: (level: LogEntry['level'], message: string) => {
			update(entries => [...entries, { timestamp: new Date(), level, message }]);
		},
		clear: () => update(() => [])
	};
}

export const activityLogStore = createActivityLogStore();