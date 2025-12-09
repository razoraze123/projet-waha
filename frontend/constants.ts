import { Session, LogEntry } from './types';

export const INITIAL_SESSIONS: Session[] = [
  {
    id: '1',
    name: 'Tontine 1',
    status: 'connected',
    lastActive: 'Il y a 2 minutes',
    phoneNumber: '+227 99 12 34 56'
  },
  {
    id: '2',
    name: 'Support Client SAV',
    status: 'disconnected',
    lastActive: 'Il y a 5 heures',
    phoneNumber: '+227 88 00 11 22'
  },
  {
    id: '3',
    name: 'Bot Marketing',
    status: 'connected',
    lastActive: 'À l\'instant',
    phoneNumber: '+227 90 22 33 44'
  }
];

export const MOCK_LOGS: LogEntry[] = [
  { id: '1', timestamp: '10:42:05', level: 'success', message: 'Message envoyé avec succès à +227 99...' },
  { id: '2', timestamp: '10:40:12', level: 'info', message: 'Session "Tontine 1" synchronisée.' },
  { id: '3', timestamp: '09:15:00', level: 'error', message: 'Échec de connexion au serveur.' },
  { id: '4', timestamp: '09:14:55', level: 'info', message: 'Tentative de reconnexion...' },
];