import React from 'react';
import { Trash2, Smartphone, Signal, WifiOff, Clock } from 'lucide-react';
import { Session } from '../types';

interface SessionCardProps {
  session: Session;
  onDelete: (id: string) => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ session, onDelete }) => {
  const isConnected = session.status === 'connected';

  return (
    <div className="group relative bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300">
      
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-3">
          <div className={`
            p-2.5 rounded-lg 
            ${isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}
          `}>
            <Smartphone size={24} />
          </div>
          <div>
            <h3 className="text-slate-100 font-semibold text-lg leading-tight">{session.name}</h3>
            <p className="text-slate-500 text-xs mt-1 font-mono">{session.phoneNumber || 'Numéro inconnu'}</p>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className={`
          flex items-center px-2.5 py-1 rounded-full text-xs font-medium border
          ${isConnected 
            ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-950/30 border-rose-500/20 text-rose-400'}
        `}>
          <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
          {isConnected ? 'Connecté' : 'Déconnecté'}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800/50">
          <div className="flex items-center text-slate-500 text-xs mb-1">
            <Signal size={12} className="mr-1.5" />
            Qualité Signal
          </div>
          <span className="text-slate-300 font-medium text-sm">Excellent</span>
        </div>
        <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800/50">
          <div className="flex items-center text-slate-500 text-xs mb-1">
            <Clock size={12} className="mr-1.5" />
            Dernière activité
          </div>
          <span className="text-slate-300 font-medium text-sm truncate block" title={session.lastActive}>
            {session.lastActive ? new Date(session.lastActive).toLocaleString('fr-FR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            }) : '--'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
          Voir les détails
        </button>
        <button 
          onClick={() => onDelete(session.id)}
          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          title="Supprimer la session"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};

export default SessionCard;