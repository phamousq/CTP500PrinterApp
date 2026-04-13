import { useState, useCallback, useRef, useEffect } from 'react';
import { ActivityLogProvider, useActivityLog } from './context/ActivityLogContext';
import { useBluetooth } from './hooks/useBluetooth';
import { initPrinter, startRaster, endRaster } from './services/printer/commands';
import { renderTextToImage } from './services/image/ImageProcessor';

// --- Log Panel ---
function LogPanel({ logs }: { logs: { id: number; timestamp: string; level: string; message: string }[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className="bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm rounded p-3 h-32 overflow-y-auto">
      {logs.length === 0 ? (
        <div className="text-[#666]">No activity yet.</div>
      ) : (
        <div>
          {logs.map(log => (
            <div key={log.id} className="opacity-80">
              <span className="text-[#888]">[{log.timestamp}]</span>{' '}
              <span className={
                log.level === 'error' ? 'text-red-400' :
                log.level === 'success' ? 'text-green-400' :
                log.level === 'warning' ? 'text-yellow-400' :
                'text-[#d4d4d4]'
              }>{log.message}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

// --- Bluetooth Controls ---
function BluetoothPanel({
  connection,
  isSupported,
  onScan,
  onDisconnect,
  batteryLevel,
  batteryVoltage,
  printerName,
}: {
  connection: string;
  isSupported: boolean;
  onScan: () => void;
  onDisconnect: () => void;
  batteryLevel: number | null;
  batteryVoltage: string | null;
  printerName: string | null;
}) {
  const statusColors: Record<string, string> = {
    disconnected: 'text-red-600',
    scanning: 'text-blue-600',
    connecting: 'text-yellow-600',
    connected: 'text-green-600',
  };
  const statusText: Record<string, string> = {
    disconnected: '● Disconnected',
    scanning: '⟳ Scanning...',
    connecting: '⟳ Connecting...',
    connected: '● Connected',
  };

  return (
    <div className="border rounded-lg p-4">
      <h2 className="font-semibold mb-3">Bluetooth Tools</h2>
      <div className="flex gap-2 mb-2">
        {connection === 'connected' ? (
          <button
            onClick={onDisconnect}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded font-medium transition"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={onScan}
            disabled={connection === 'scanning' || !isSupported}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-3 rounded font-medium transition"
          >
            {connection === 'scanning' ? 'Scanning...' : connection === 'connecting' ? 'Connecting...' : 'Scan & Connect'}
          </button>
        )}
      </div>
      <div className={`font-medium ${statusColors[connection] || 'text-gray-600'}`}>
        {statusText[connection] || '● Unknown'}
      </div>
      {printerName && connection === 'connected' && (
        <div className="text-sm text-gray-600 mt-1">{printerName}</div>
      )}
      {batteryVoltage && (
        <div className={`text-sm mt-1 ${(batteryLevel ?? 0) > 50 ? 'text-green-600' : (batteryLevel ?? 0) > 20 ? 'text-yellow-600' : 'text-red-600'}`}>
          Battery: {batteryLevel}% {batteryVoltage}
        </div>
      )}
      {!isSupported && (
        <div className="text-sm text-red-500 mt-2">Web Bluetooth not supported</div>
      )}
    </div>
  );
}

// --- Text Tools ---
function TextPanel({ onPrintText }: { onPrintText: (text: string) => void }) {
  const [text, setText] = useState('');

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.text';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const content = await file.text();
        setText(content);
      }
    };
    input.click();
  };

  return (
    <div className="border rounded-lg p-4">
      <h2 className="font-semibold mb-3">Text Tools</h2>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Enter text to print..."
        className="w-full h-28 border rounded p-2 text-sm resize-none"
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleFileSelect}
          className="flex-1 bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded text-sm transition"
        >
          Select file
        </button>
        <button
          onClick={() => text.trim() && onPrintText(text)}
          disabled={!text.trim()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-2 rounded text-sm font-medium transition"
        >
          Print text!
        </button>
      </div>
    </div>
  );
}

// --- Main App Content ---
function AppContent() {
  const { logs, clearLogs } = useActivityLog()!;
  const {
    connection,
    isSupported,
    startScan,
    disconnect,
    writeData,
    printerName,
  } = useBluetooth();

  const printText = useCallback(async (text: string) => {
    if (connection.status !== 'connected') {
      console.error('Print aborted: not connected');
      return;
    }
    try {
      const img = await renderTextToImage(text);
      await writeData(initPrinter());
      await new Promise(r => setTimeout(r, 500));
      await writeData(startRaster());
      await new Promise(r => setTimeout(r, 500));
      await writeData(img.data);
      await new Promise(r => setTimeout(r, Math.max(1, img.data.length / 5000) * 1000));
      await writeData(endRaster());
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error('Print error:', e);
    }
  }, [connection.status, writeData]);

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold text-center">CTP500 Printer Control</h1>

      <BluetoothPanel
        connection={connection.status}
        isSupported={isSupported}
        onScan={startScan}
        onDisconnect={disconnect}
        batteryLevel={connection.batteryLevel}
        batteryVoltage={connection.batteryVoltage}
        printerName={printerName}
      />

      <TextPanel onPrintText={printText} />

      <div className="border rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">Activity Log</h2>
          <button
            onClick={clearLogs}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
        <LogPanel logs={logs} />
      </div>
    </div>
  );
}

function App() {
  return (
    <ActivityLogProvider>
      <AppContent />
    </ActivityLogProvider>
  );
}

export default App;