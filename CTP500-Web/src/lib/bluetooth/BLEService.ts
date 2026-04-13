// Web Bluetooth API service for CTP500 thermal printer

import { connectionStore } from '../stores/connection';
import { activityLogStore } from '../stores/activityLog';

// CTP500 BLE UUIDs
const SERVICE_UUID = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
const WRITE_UUID = '49535343-8841-43f4-a8d4-ecbe34729bb3';
const NOTIFY_UUID = '49535343-1e4d-4bd9-ba61-23c647249616';

// Supported device names
const SUPPORTED_NAMES = ['S Blue Printer', 'S Pink Printer', 'S White Printer', 'S Black Printer'];

let device: BluetoothDevice | null = null;
let server: BluetoothRemoteGATTServer | null = null;
let writeChar: BluetoothRemoteGATTCharacteristic | null = null;
let notifyChar: BluetoothRemoteGATTCharacteristic | null = null;

function parseBatteryFromNotify(value: DataView): { level: number; voltage: string } | null {
	// Printer sends: HV=V1.0A,SV=V1.01,VOLT=4000mv,DPI=384
	const decoder = new TextDecoder('utf-8');
	const str = decoder.decode(value);
	
	const voltMatch = str.match(/VOLT=(\d+)mv/);
	if (!voltMatch) return null;
	
	const voltage = parseInt(voltMatch[1]);
	// LiPo range: 3300mv = 0%, 4200mv = 100%
	const level = Math.min(100, Math.max(0, ((voltage - 3300) / 900) * 100));
	
	return { level: Math.round(level), voltage: `${voltage}mv` };
}

export async function scan(): Promise<void> {
	requireBluetooth();
	activityLogStore.add('info', 'Scanning for printers...');
	connectionStore.setStatus('scanning');
	connectionStore.setError(null);

	try {
		device = await navigator.bluetooth!.requestDevice({
			filters: SUPPORTED_NAMES.map(name => ({ name })),
			optionalServices: [SERVICE_UUID]
		});

		activityLogStore.add('info', `Device selected: ${device.name}`);
		await connect();
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		if (msg.includes('cancelled') || msg === 'User cancelled') {
			activityLogStore.add('warning', 'Scan cancelled by user');
			connectionStore.setStatus('disconnected');
		} else {
			activityLogStore.add('error', `Scan failed: ${msg}`);
			connectionStore.setError(msg);
			connectionStore.setStatus('disconnected');
		}
	}
}

export async function connect(): Promise<void> {
	if (!device) {
		activityLogStore.add('error', 'No device selected');
		return;
	}

	connectionStore.setStatus('connecting');
	activityLogStore.add('info', 'Connecting to GATT server...');

	try {
		server = await device.gatt!.connect();
		activityLogStore.add('success', 'GATT connected');

		const service = await server.getPrimaryService(SERVICE_UUID);
		writeChar = await service.getCharacteristic(WRITE_UUID);
		notifyChar = await service.getCharacteristic(NOTIFY_UUID);

		// Subscribe to notifications for battery
		notifyChar.addEventListener('characteristicvaluechanged', (event: Event) => {
			const target = event.target as BluetoothRemoteGATTCharacteristicEvent;
			const parsed = parseBatteryFromNotify(target.value!);
			if (parsed) {
				connectionStore.setBattery(parsed.level, parsed.voltage);
				activityLogStore.add('info', `Battery: ${parsed.level}% (${parsed.voltage})`);
			}
		});
		await notifyChar.startNotifications();

		connectionStore.setDevice(device);
		connectionStore.setStatus('connected');
		activityLogStore.add('success', 'Printer connected');
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		activityLogStore.add('error', `Connection failed: ${msg}`);
		connectionStore.setError(msg);
		connectionStore.setStatus('disconnected');
	}
}

export async function disconnect(): Promise<void> {
	try {
		if (notifyChar) {
			await notifyChar.stopNotifications();
		}
		if (server?.connected) {
			server.disconnect();
		}
		activityLogStore.add('info', 'Disconnected');
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		activityLogStore.add('warning', `Disconnect warning: ${msg}`);
	} finally {
		device = null;
		server = null;
		writeChar = null;
		notifyChar = null;
		connectionStore.reset();
	}
}

export async function write(data: Uint8Array): Promise<void> {
	if (!writeChar) {
		throw new Error('Not connected');
	}

	const mtu = device!.gatt!.getConnectedDevices()[0]?.gatt?.connected 
		? 512 : 182; // fallback MTU
	
	const chunkSize = mtu - 3; // overhead for write-with-response
	const chunks: Uint8Array[] = [];

	for (let i = 0; i < data.length; i += chunkSize) {
		chunks.push(data.slice(i, i + chunkSize));
	}

	activityLogStore.add('info', `Writing ${data.length} bytes in ${chunks.length} chunks...`);

	for (const chunk of chunks) {
		await writeChar.writeValue(chunk);
	}

	activityLogStore.add('success', `Sent ${data.length} bytes`);
}

export function isSupported(): boolean {
	return typeof navigator !== 'undefined' && 'bluetooth' in navigator && navigator.bluetooth !== null;
}

export function requireBluetooth(): void {
	if (!isSupported()) {
		throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome or Edge.');
	}
}