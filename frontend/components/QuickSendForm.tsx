import React, { useState, useEffect } from 'react';
import { Send, Phone, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react';
import { Session } from '../types';

interface QuickSendFormProps {
  sessions: Session[];
}

const QuickSendForm: React.FC<QuickSendFormProps> = ({ sessions }) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [number, setNumber] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Filter connected sessions
  const connectedSessions = sessions.filter(s => s.status === 'connected');

  // Auto-select first connected session if none selected
  useEffect(() => {
    if (!selectedSessionId && connectedSessions.length > 0) {
      setSelectedSessionId(connectedSessions[0].id);
    }
  }, [connectedSessions, selectedSessionId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId || !number || !message) return;

    setStatus('sending');
    setErrorMessage('');

    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          number,
          message,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('sent');
        setTimeout(() => {
          setStatus('idle');
          setMessage('');
          setNumber('');
        }, 2000);
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Erreur lors de l\'envoi');
        setTimeout(() => setStatus('idle'), 3000);
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Erreur de connexion au serveur');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-full">
      <div className="flex items-center mb-6">
        <div className="p-2 bg-indigo-500/10 rounded-lg mr-3">
          <Send size={20} className="text-indigo-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Test Rapide</h3>
          <p className="text-xs text-slate-500">Envoyer un message depuis la session active</p>
        </div>
      </div>

      <form onSubmit={handleSend} className="space-y-4">
        {/* Session Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 ml-1">Session émettrice</label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm appearance-none cursor-pointer"
          >
            {connectedSessions.length === 0 && <option value="">Aucune session connectée</option>}
            {connectedSessions.map(session => (
              <option key={session.id} value={session.id}>
                {session.name} ({session.phoneNumber || 'Sans numéro'})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 ml-1">Numéro du destinataire</label>
          <div className="relative">
            <Phone size={16} className="absolute left-3 top-3 text-slate-600" />
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="ex: 33611309743"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-slate-200 placeholder-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 ml-1">Message</label>
          <div className="relative">
            <MessageSquare size={16} className="absolute left-3 top-3 text-slate-600" />
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tapez votre message ici..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-slate-200 placeholder-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm resize-none"
            />
          </div>
        </div>

        {status === 'error' && (
          <div className="flex items-center text-rose-400 text-xs bg-rose-500/10 p-2 rounded border border-rose-500/20">
            <AlertCircle size={14} className="mr-1.5 shrink-0" />
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'sending' || !selectedSessionId || !number || !message}
          className={`
            w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center
            ${status === 'sent' 
              ? 'bg-emerald-600 text-white' 
              : status === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'}
          `}
        >
          {status === 'sending' ? (
            <span className="flex items-center">
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2"></span>
              Envoi...
            </span>
          ) : status === 'sent' ? (
            <span className="flex items-center">
              <CheckCircle2 size={18} className="mr-2" />
              Envoyé !
            </span>
          ) : (
            'Envoyer le message'
          )}
        </button>
      </form>
    </div>
  );
};

export default QuickSendForm;