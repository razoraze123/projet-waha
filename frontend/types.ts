export type SessionStatus = 'connected' | 'disconnected' | 'connecting';

export interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  lastActive: string;
  phoneNumber?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'error' | 'success';
  message: string;
}

export type Tab = 'dashboard' | 'sessions' | 'logs';