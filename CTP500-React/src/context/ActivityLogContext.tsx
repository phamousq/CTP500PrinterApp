// src/context/ActivityLogContext.tsx

import React, { createContext, useState, useContext, useCallback, ReactNode } from \'react\';

export interface LogEntry {
  timestamp: string;
  type: \'info\' | \'warning\' | \'error\' | \'success\';
  message: string;
}

interface ActivityLogContextType {
  logEntries: LogEntry[];
  addLogEntry: (type: \'info\' | \'warning\' | \'error\' | \'success\', message: string) => void;
}

const ActivityLogContext = createContext<ActivityLogContextType | undefined>(undefined);

export const ActivityLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  const addLogEntry = useCallback((type: \'info\' | \'warning\' | \'error\' | \'success\', message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogEntries(prevEntries => [...prevEntries, { timestamp, type, message }]);
  }, []);

  return (
    <ActivityLogContext.Provider value={{ logEntries, addLogEntry }}>
      {children}
    </ActivityLogContext.Provider>
  );
};

export const useActivityLog = (): ActivityLogContextType => {
  const context = useContext(ActivityLogContext);
  if (context === undefined) {
    throw new Error(\'useActivityLog must be used within an ActivityLogProvider\');
  }
  return context;
};