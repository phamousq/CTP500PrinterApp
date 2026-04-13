import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
}

interface ActivityLogContextValue {
  logs: LogEntry[];
  addLog: (level: LogLevel, message: string) => void;
  clearLogs: () => void;
}

const ActivityLogContext = createContext<ActivityLogContextValue | null>(null);

let nextId = 0;

export function ActivityLogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((level: LogLevel, message: string) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [
      ...prev,
      { id: nextId++, timestamp, level, message },
    ]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <ActivityLogContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </ActivityLogContext.Provider>
  );
}

export function useActivityLog(): ActivityLogContextValue | null {
  return useContext(ActivityLogContext);
}