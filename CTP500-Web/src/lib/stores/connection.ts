import { writable } from 'svelte/store';

export type ConnectionStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected';

function createConnectionStore() {
	const { subscribe, set, update } = writable<{
		status: ConnectionStatus;
		device: BluetoothDevice | null;
		batteryLevel: number | null;
		batteryVoltage: string | null;
		error: string | null;
	}>({
		status: 'disconnected',
		device: null,
		batteryLevel: null,
		batteryVoltage: null,
		error: null
	});

	return {
		subscribe,
		setStatus: (status: ConnectionStatus) => update(s => ({ ...s, status })),
		setDevice: (device: BluetoothDevice | null) => update(s => ({ ...s, device })),
		setBattery: (level: number | null, voltage: string | null) => update(s => ({ ...s, batteryLevel: level, batteryVoltage: voltage })),
		setError: (error: string | null) => update(s => ({ ...s, error })),
		reset: () => set({ status: 'disconnected', device: null, batteryLevel: null, batteryVoltage: null, error: null })
	};
}

export const connectionStore = createConnectionStore();