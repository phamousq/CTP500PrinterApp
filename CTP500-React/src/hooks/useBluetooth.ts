// useBluetooth.ts - React hook for Web Bluetooth API service for CTP500 thermal printer

import { useState, useEffect, useCallback } from \'react\';

// CTP500 BLE UUIDs
const SERVICE_UUID = \'49535343-fe7d-4ae5-8fa9-9fafd205e455\';
const WRITE_UUID = \'49535343-8841-43f4-a8d4-ecbe34729bb3\';
const NOTIFY_UUID = \'49535343-1e4d-4bd9-ba61-23c647249616\';

// Supported device names
const SUPPORTED_NAMES = [\'S Blue Printer\', \'S Pink Printer\', \'S White Printer\', \'S Black Printer\'];

interface ConnectionState {
  device: BluetoothDevice | null;
  status: \'disconnected\' | \'scanning\' | \'connecting\' | \'connected\';
  error: string | null;
  batteryLevel: number | null;
  batteryVoltage: string | null;
}

interface UseBluetoothResult {
  connection: ConnectionState;
  isWebBluetoothSupported: boolean;
  scanForPrinters: () => Promise<void>;
  disconnectPrinter: () => Promise<void>;
  writeToPrinter: (data: Uint8Array) => Promise<void>;
}

function parseBatteryFromNotify(value: DataView): { level: number; voltage: string } | null {
  // Printer sends: HV=V1.0A,SV=V1.01,VOLT=4000mv,DPI=384
  const decoder = new TextDecoder(\'utf-8\');
  const str = decoder.decode(value);

  const voltMatch = str.match(/VOLT=(\\d+)mv/);
  if (!voltMatch) return null;

  const voltage = parseInt(voltMatch[1]);
  // LiPo range: 3300mv = 0%, 4200mv = 100%
  const level = Math.min(100, Math.max(0, ((voltage - 3300) / 900) * 100));

  return { level: Math.round(level), voltage: `${voltage}mv` };
}

export function useBluetooth(onLog: (type: \'info\' | \'warning\' | \'error\' | \'success\', message: string) => void): UseBluetoothResult {
  const [connection, setConnection] = useState<ConnectionState>({
    device: null,
    status: \'disconnected\',
    error: null,
    batteryLevel: null,
    batteryVoltage: null,
  });

  const isWebBluetoothSupported = typeof navigator !== \'undefined\' && \'bluetooth\' in navigator && navigator.bluetooth !== null;

  let bluetoothDevice: BluetoothDevice | null = null;
  let gattServer: BluetoothRemoteGATTServer | null = null;
  let writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  let notifyCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

  const requireBluetooth = useCallback(() => {
    if (!isWebBluetoothSupported) {
      throw new Error(\'Web Bluetooth is not supported in this browser. Please use Chrome or Edge.\');
    }
  }, [isWebBluetoothSupported]);

  const characteristicValueChangeHandler = useCallback((event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const parsed = parseBatteryFromNotify(target.value!);
    if (parsed) {
      setConnection(prev => ({ ...prev, batteryLevel: parsed.level, batteryVoltage: parsed.voltage }));
      onLog(\'info\', `Battery: ${parsed.level}% (${parsed.voltage})`);
    }
  }, [onLog]);

  const scanForPrinters = useCallback(async () => {
    requireBluetooth();
    onLog(\'info\', \'Scanning for printers...\');
    setConnection(prev => ({ ...prev, status: \'scanning\', error: null }));

    try {
      bluetoothDevice = await navigator.bluetooth!.requestDevice({
        filters: SUPPORTED_NAMES.map(name => ({ name })),
        optionalServices: [SERVICE_UUID],
      });

      onLog(\'info\', `Device selected: ${bluetoothDevice.name}`);
      await connectPrinter();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : \'Unknown error\';
      if (msg.includes(\'cancelled\') || msg === \'User cancelled\') {
        onLog(\'warning\', \'Scan cancelled by user\');
        setConnection(prev => ({ ...prev, status: \'disconnected\' }));
      } else {
        onLog(\'error\', `Scan failed: ${msg}`);
        setConnection(prev => ({ ...prev, error: msg, status: \'disconnected\' }));
      }
    }
  }, [requireBluetooth, onLog]);

  const connectPrinter = useCallback(async () => {
    if (!bluetoothDevice) {
      onLog(\'error\', \'No device selected to connect\');
      return;
    }

    setConnection(prev => ({ ...prev, status: \'connecting\' }));
    onLog(\'info\', \'Connecting to GATT server...\');

    try {
      gattServer = await bluetoothDevice.gatt!.connect();
      onLog(\'success\', \'GATT connected\');

      const service = await gattServer.getPrimaryService(SERVICE_UUID);
      writeCharacteristic = await service.getCharacteristic(WRITE_UUID);
      notifyCharacteristic = await service.getCharacteristic(NOTIFY_UUID);

      notifyCharacteristic.addEventListener(\'characteristicvaluechanged\', characteristicValueChangeHandler);
      await notifyCharacteristic.startNotifications();

      setConnection(prev => ({ ...prev, device: bluetoothDevice, status: \'connected\' }));
      onLog(\'success\', \'Printer connected\');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : \'Unknown error\';
      onLog(\'error\', `Connection failed: ${msg}`);
      setConnection(prev => ({ ...prev, error: msg, status: \'disconnected\' }));
    }
  }, [bluetoothDevice, characteristicValueChangeHandler, onLog]);

  const disconnectPrinter = useCallback(async () => {
    try {
      if (notifyCharacteristic) {
        notifyCharacteristic.removeEventListener(\'characteristicvaluechanged\', characteristicValueChangeHandler);
        await notifyCharacteristic.stopNotifications();
      }
      if (gattServer?.connected) {
        gattServer.disconnect();
      }
      onLog(\'info\', \'Disconnected\');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : \'Unknown error\';
      onLog(\'warning\', `Disconnect warning: ${msg}`);
    } finally {
      bluetoothDevice = null;
      gattServer = null;
      writeCharacteristic = null;
      notifyCharacteristic = null;
      setConnection({
        device: null,
        status: \'disconnected\',
        error: null,
        batteryLevel: null,
        batteryVoltage: null,
      });
    }
  }, [characteristicValueChangeHandler, onLog]);

  const writeToPrinter = useCallback(async (data: Uint8Array) => {
    if (!writeCharacteristic) {
      throw new Error(\'Not connected to printer\');
    }

    const mtu = bluetoothDevice!.gatt!.getConnectedDevices()[0]?.gatt?.connected \
      ? 512 : 182; // fallback MTU
    
    const chunkSize = mtu - 3; // overhead for write-with-response
    const chunks: Uint8Array[] = [];

    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }

    onLog(\'info\', `Writing ${data.length} bytes in ${chunks.length} chunks...`);

    for (const chunk of chunks) {
      await writeCharacteristic.writeValue(chunk);
    }

    onLog(\'success\', `Sent ${data.length} bytes`);
  }, [bluetoothDevice, onLog]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (notifyCharacteristic) {
        notifyCharacteristic.removeEventListener(\'characteristicvaluechanged\', characteristicValueChangeHandler);
      }
      if (gattServer?.connected) {
        gattServer.disconnect();
      }
    };
  }, [gattServer, notifyCharacteristic, characteristicValueChangeHandler]);

  return {
    connection,
    isWebBluetoothSupported,
    scanForPrinters,
    disconnectPrinter,
    writeToPrinter,
  };
}