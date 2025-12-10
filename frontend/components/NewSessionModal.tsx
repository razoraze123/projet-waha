import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
}

const NewSessionModal: React.FC<NewSessionModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [sessionName, setSessionName] = useState('');
  const [step, setStep] = useState<'name' | 'qr'>('name');
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('initializing');

  // Utilisation d'une ref pour suivre si le composant est monté
  const isMounted = useRef(true);

  // Reset state when modal opens
  useEffect(() => {
    isMounted.current = true;
    if (isOpen) {
      setSessionName('');
      setStep('name');
      setLoading(false);
      setCurrentSessionId(null);
      setQrCode(null);
    }
    return () => {
      isMounted.current = false;
    };
  }, [isOpen]);

  // Polling automatique géré par un useEffect dédié
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isActive = true;

    const poll = async () => {
      // On ne polle que si la modale est ouverte, qu'on est à l'étape QR, et qu'on a un ID
      if (!isOpen || step !== 'qr' || !currentSessionId) return;

      try {
        console.log(`Polling status for session ${currentSessionId}...`);
        const res = await fetch(`/api/sessions/${currentSessionId}`);
        if (!res.ok) throw new Error('Network response was not ok');

        const session = await res.json();
        
        // Si le composant a été démonté ou le polling désactivé pendant le fetch, on arrête
        if (!isActive || !isMounted.current) return;

        console.log(`Statut session ${currentSessionId}:`, session.status);
        setStatus(session.status);

        if (session.qr) {
          setQrCode(session.qr);
        }

        if (session.status === 'connected') {
          console.log('✅ Session connectée ! Fermeture de la modale...');
          
          try {
            onAdd(sessionName);
          } catch (e) { console.error("Erreur onAdd polling:", e); }

          // Petit délai pour l'expérience utilisateur
          setTimeout(() => {
             if (isActive && isMounted.current) {
               try {
                 onClose();
               } catch (e) { console.error("Erreur onClose polling:", e); }
             }
          }, 1000);

          return; // Arrêt du polling (pas de nouveau setTimeout)
        }
      } catch (error) {
        console.error('Erreur de polling:', error);
      }

      // Si toujours actif, on relance dans 1s
      if (isActive && isMounted.current) {
         timeoutId = setTimeout(poll, 1000);
      }
    };

    if (isOpen && step === 'qr' && currentSessionId) {
      poll();
    }

    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOpen, step, currentSessionId, sessionName, onClose, onAdd]);

  const handleCreateSession = async () => {
    if (!sessionName.trim()) return;
    setLoading(true);

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sessionName })
      });

      const data = await res.json();

      if (isMounted.current) {
        if (data.status === 'success') {
          setCurrentSessionId(data.session.id);
          setStep('qr');
          // Le polling se lancera automatiquement grâce au useEffect
        } else {
            alert('Erreur: ' + (data.message || 'Impossible de créer la session'));
        }
      }
    } catch (error) {
      console.error('Failed to create session', error);
      alert('Erreur de création de session');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const handleFinish = () => {
    console.log("Tentative de fermeture manuelle...");
    try {
      onAdd(sessionName);
    } catch (e) { console.error("Erreur dans onAdd:", e); }
    
    try {
      onClose();
    } catch (e) { console.error("Erreur dans onClose:", e); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center">
            {step === 'name' ? 'Nouvelle Session' : 'Connexion WhatsApp'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {step === 'name' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Nom de la session</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="ex: Bot Marketing 01"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  autoFocus
                />
              </div>
              <p className="text-xs text-slate-500">
                Donnez un nom unique pour identifier facilement ce compte WhatsApp dans votre tableau de bord.
              </p>
              <button
                onClick={handleCreateSession}
                disabled={!sessionName.trim() || loading}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin mr-2" size={20} /> : 'Générer le QR Code'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center space-y-6">
               <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
                  <div className="relative bg-white p-4 rounded-lg min-w-[200px] min-h-[200px] flex items-center justify-center">
                    {qrCode ? (
                       <img
                       src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`}
                       alt="QR Code"
                       className="w-48 h-48 object-contain"
                     />
                    ) : (
                      <div className="flex flex-col items-center">
                        <Loader2 className="animate-spin text-slate-400 mb-2" size={32} />
                        <span className="text-slate-500 text-xs">Génération du QR...</span>
                      </div>
                    )}

                  </div>
                  {/* Scan Overlay Effect */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-[scan_2s_ease-in-out_infinite] pointer-events-none rounded-lg" />
               </div>
               
               {/* Statut en temps réel pour debug */}
               <div className="text-xs font-mono bg-slate-950 px-2 py-1 rounded text-slate-400">
                  Statut actuel: <span className={status === 'connected' ? "text-emerald-400" : "text-yellow-400"}>
                    {status || "En attente..."}
                  </span>
               </div>

               <div className="space-y-2">
                 <h3 className="text-slate-200 font-medium">Ouvrez WhatsApp sur votre téléphone</h3>
                 <p className="text-sm text-slate-500">
                   Allez dans Réglages {'>'} Appareils connectés {'>'} Connecter un appareil
                 </p>
               </div>

               <div className="w-full flex space-x-3">
                 <button 
                   onClick={() => setStep('name')}
                   className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm"
                 >
                   Retour
                 </button>
                 <button 
                   onClick={handleFinish}
                   className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors text-sm font-medium flex items-center justify-center"
                 >
                   Fermer
                 </button>
               </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes scan {
          0% { top: 4%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 96%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default NewSessionModal;
