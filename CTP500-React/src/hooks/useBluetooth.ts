import { useState, useEffect, useCallback } from 'react';
import { WRITE_CHAR_UUID, NOTIFY_CHAR_UUID, SERVICE_UUID } from '../services/bluetooth/constants';
import { useActivityLog } from '../context/ActivityLogContext';

interface ConnectionState {
  device: BluetoothDevice | null;
  status: 'disconnected' | 'scanning' | 'connecting' | 'connected';
  error: string | null;
  batteryLevel: number | null;
  batteryVoltage: string | null;
  mtu: number;
}

interface UseBluetoothReturn {
  connection: ConnectionState;
  isSupported: boolean;
  startScan: () => void;
  disconnect: () => Promise<void>;
  writeData: (data: Uint8Array) => Promise<void>;
  printerName: string | null;
}

const BATT_MIN_MV = 3300;
const BATT_MAX_MV = 4200;

function parseBatteryFromNotify(data: DataView): { voltage: string; percentage: number } | null {
  const text = new TextDecoder('ascii').decode(data.buffer).replace(/\0+$/, '');
  const match = text.match(/VOLT=(\d+)mv/i);
  if (match) {
    const mv = parseInt(match[1], 10);
    const pct = Math.round(((mv - BATT_MIN_MV) / (BATT_MAX_MV - BATT_MIN_MV)) * 100);
    return {
      voltage: `${mv}mv`,
      percentage: Math.max(0, Math.min(100, pct)),
    };
  }
  return null;
}

export function useBluetooth(): UseBluetoothReturn {
  const { addLog } = useActivityLog()!;
  const [connection, setConnection] = useState<ConnectionState>({
    device: null,
    status: 'disconnected',
    error: null,
    batteryLevel: null,
    batteryVoltage: null,
    mtu: 23,
  });
  const [isSupported] = useState(() => 'bluetooth' in navigator);
  const [server, setServer] = useState<BluetoothRemoteGATTServer | null>(null);
  const [writeChar, setWriteChar] = useState<BluetoothRemoteGATTCharacteristic | null>(null);
  const [notifyChar, setNotifyChar] = useState<BluetoothRemoteGATTCharacteristic | null>(null);
  const [printerName, setPrinterName] = useState<string | null>(null);

  const clearConnection = useCallback(() => {
    setServer(null);
    setWriteChar(null);
    setNotifyChar(null);
    setPrinterName(null);
    setConnection(prev => ({
      ...prev,
      device: null,
      status: 'disconnected',
      mtu: 23,
    }));
  }, []);

  const disconnect = useCallback(async () => {
    if (server) {
      try {
        if (notifyChar) {
          await notifyChar.stopNotifications();
        }
        await server.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }
    clearConnection();
    addLog('info', 'Disconnected from printer');
  }, [server, notifyChar, clearConnection, addLog]);

  const handleNotify = useCallback((event: Event) => {
    const char = event.target as BluetoothRemoteGATTCharacteristic;
    const data = char.value!;
    const text = new TextDecoder('ascii').decode(data.buffer).replace(/\0+$/, '');
    addLog('info', `Printer status: ${text}`);

    const batt = parseBatteryFromNotify(data);
    if (batt) {
      setConnection(prev => ({
        ...prev,
        batteryVoltage: batt.voltage,
        batteryLevel: batt.percentage,
      }));
    }
  }, [addLog]);

  const connectToDevice = useCallback(async (device: BluetoothDevice) => {
    setConnection(prev => ({ ...prev, status: 'connecting', error: null }));
    addLog('info', `Connecting to ${device.name ?? device.id}...`);

    try {
      const gatt = device.gatt!;
      await gatt.connect();
      const serv = await gatt.getPrimaryService(SERVICE_UUID);
      const [write, notify] = await Promise.all([
        serv.getCharacteristic(WRITE_CHAR_UUID),
        serv.getCharacteristic(NOTIFY_CHAR_UUID),
      ]);

      setServer(gatt);
      setWriteChar(write);
      setNotifyChar(notify);
      setPrinterName(device.name ?? null);

      // Start notifications for battery/STATUS updates
      notify.addEventListener('characteristicvaluechanged', handleNotify);
      await notify.startNotifications();

      // Request printer status
      await write.writeValueWithResponse(new Uint8Array([0x1e, 0x47, 0x03]));

      setConnection(prev => ({
        ...prev,
        device,
        status: 'connected',
        mtu: 23,
      }));
      addLog('info', `Connected (MTU: 23 bytes)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setConnection(prev => ({ ...prev, status: 'disconnected', error: msg }));
      addLog('error', `Connection error: ${msg}`);
      clearConnection();
    }
  }, [handleNotify, addLog, clearConnection]);

  const startScan = useCallback(() => {
    if (!isSupported) {
      addLog('error', 'Web Bluetooth not supported in this browser');
      return;
    }
    setConnection(prev => ({ ...prev, status: 'scanning', error: null }));
    addLog('info', 'Scanning for compatible printers (10s)...');

    navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'S ' }],
      optionalServices: [SERVICE_UUID],
    })
    .then(device => {
      addLog('info', `Found: ${device.name}`);
      connectToDevice(device);
    })
    .catch(e => {
      if (e instanceof Error && e.name !== 'NotFoundError') {
        const msg = e.message;
        setConnection(prev => ({ ...prev, status: 'disconnected', error: msg }));
        addLog('error', `Scan error: ${msg}`);
      } else {
        setConnection(prev => ({ ...prev, status: 'disconnected' }));
      }
    });
  }, [isSupported, addLog, connectToDevice]);

  const writeData = useCallback(async (data: Uint8Array) => {
    if (!writeChar) throw new Error('Not connected');
    // Chunk to MTU-3 overhead for write-with-response
    const mtu = connection.mtu || 23;
    const chunkSize = Math.max(20, mtu - 3);
    const totalChunks = Math.ceil(data.length / chunkSize);

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await writeChar.writeValueWithResponse(chunk);
      if (totalChunks > 10 && Math.floor(i / chunkSize) % 10 === 0) {
        addLog('info', `Sending... ${Math.min(i + chunkSize, data.length)}/${data.length} bytes`);
      }
    }
    addLog('info', `Sent ${data.length} bytes`);
  }, [writeChar, connection.mtu, addLog]);

  useEffect(() => {
    return () => {
      // Cleanup notifications on unmount
      if (notifyChar) {
        notifyChar.removeEventListener('characteristicvaluechanged', handleNotify);
      }
    };
  }, [notifyChar, handleNotify]);

  return {
    connection,
    isSupported,
    startScan,
    disconnect,
    writeData,
    printerName,
  };
}