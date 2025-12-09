import React, { useState } from 'react';
import { Send, Phone, MessageSquare, CheckCircle2 } from 'lucide-react';

const QuickSendForm: React.FC = () => {
  const [number, setNumber] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!number || !message) return;

    setStatus('sending');
    setTimeout(() => {
      setStatus('sent');
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
        setNumber('');
      }, 2000);
    }, 1500);
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
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-400 ml-1">Numéro du destinataire</label>
          <div className="relative">
            <Phone size={16} className="absolute left-3 top-3 text-slate-600" />
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="+227 99..."
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

        <button
          type="submit"
          disabled={status !== 'idle' || !number || !message}
          className={`
            w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center
            ${status === 'sent' 
              ? 'bg-emerald-600 text-white' 
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