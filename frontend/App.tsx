import React, { useState, useEffect } from 'react';
import { Plus, Menu, Search, Filter } from 'lucide-react';
import Sidebar from './components/Sidebar';
import SessionCard from './components/SessionCard';
import NewSessionModal from './components/NewSessionModal';
import QuickSendForm from './components/QuickSendForm';
import { MOCK_LOGS } from './constants';
import { Tab, Session } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch sessions
  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 2000); // Poll every 2s
    return () => clearInterval(interval);
  }, []);

  const handleDeleteSession = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette session ?')) {
      try {
        await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
        // Optimistic update or wait for poll
        setSessions(prev => prev.filter(s => s.id !== id));
      } catch (error) {
        console.error('Error deleting session:', error);
        alert('Erreur lors de la suppression');
      }
    }
  };

  const handleAddSession = (name: string) => {
     console.log("Session ajoutée, rafraîchissement de la liste...");
     // Triggered after the modal finishes the creation flow
     // On utilise setTimeout pour ne pas bloquer le render cycle actuel
     setTimeout(() => {
        fetchSessions();
     }, 100);
  };

  const handleCloseModal = () => {
    console.log("Fermeture de la modale demandée.");
    setIsModalOpen(false);
  };

  const filteredSessions = sessions.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.phoneNumber && s.phoneNumber.includes(searchQuery))
  );

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isMobileOpen={isMobileMenuOpen}
        closeMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen lg:ml-64 transition-all duration-300">
        
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 z-10 sticky top-0">
          <div className="flex items-center">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden mr-4 p-2 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-xl font-semibold text-slate-100 hidden sm:block">
              {activeTab === 'dashboard' ? 'Tableau de bord' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h2>
          </div>

          <div className="flex items-center space-x-4">
            {/* Search Bar */}
            <div className="hidden md:flex relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Rechercher..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-64 transition-all placeholder-slate-600 text-slate-300"
              />
            </div>
            
            {/* User Profile / Status */}
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 border-2 border-slate-800 shadow-lg cursor-pointer hover:scale-105 transition-transform" />
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
          
          {/* Dashboard View */}
          {activeTab === 'dashboard' && (
            <div className="max-w-7xl mx-auto space-y-8">
              
              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-lg shadow-indigo-900/20">
                  <h3 className="text-indigo-100 text-sm font-medium mb-1">Sessions Actives</h3>
                  <div className="text-4xl font-bold">{sessions.filter(s => s.status === 'connected').length}</div>
                  <p className="text-xs text-indigo-200 mt-2 bg-indigo-500/30 inline-block px-2 py-1 rounded">Mise à jour auto</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-slate-400 text-sm font-medium mb-1">Messages Envoyés</h3>
                  <div className="text-4xl font-bold text-slate-100">--</div>
                  <p className="text-xs text-emerald-400 mt-2 flex items-center">Statistiques réelles bientôt</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-slate-400 text-sm font-medium mb-1">État du système</h3>
                  <div className="text-2xl font-bold text-slate-100 mt-2">En ligne</div>
                  <p className="text-xs text-slate-500 mt-2">Backend connecté</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Sessions */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-100">Vos Sessions</h3>
                    <div className="flex space-x-3">
                       <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                         <Filter size={20} />
                       </button>
                       <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02]"
                      >
                        <Plus size={18} className="mr-2" />
                        Nouvelle Session
                      </button>
                    </div>
                  </div>

                  {filteredSessions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {filteredSessions.map(session => (
                        <SessionCard key={session.id} session={session} onDelete={handleDeleteSession} />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-12 text-center">
                       <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                         <Search className="text-slate-500" size={32} />
                       </div>
                       <h3 className="text-slate-300 font-medium">Aucune session trouvée</h3>
                       <p className="text-slate-500 text-sm mt-1">Cliquez sur "Nouvelle Session" pour commencer.</p>
                    </div>
                  )}
                </div>

                {/* Right Column: Quick Test */}
                <div className="lg:col-span-1">
                   <QuickSendForm sessions={sessions} />
                </div>
              </div>
            </div>
          )}

          {/* Sessions View (Simplified for demo) */}
          {activeTab === 'sessions' && (
             <div className="max-w-5xl mx-auto">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-2xl font-bold text-white">Gestion des Sessions</h2>
                 <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium flex items-center"
                  >
                    <Plus size={20} className="mr-2" />
                    Ajouter
                  </button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sessions.map(session => (
                    <SessionCard key={session.id} session={session} onDelete={handleDeleteSession} />
                  ))}
               </div>
             </div>
          )}

          {/* Logs View */}
          {activeTab === 'logs' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-6">Journaux système</h2>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="bg-slate-950 text-slate-200 uppercase font-medium text-xs">
                    <tr>
                      <th className="px-6 py-4">Heure</th>
                      <th className="px-6 py-4">Niveau</th>
                      <th className="px-6 py-4">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {MOCK_LOGS.map(log => (
                      <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-slate-500">{log.timestamp}</td>
                        <td className="px-6 py-4">
                          <span className={`
                            inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                            ${log.level === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                              log.level === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                              'bg-blue-500/10 text-blue-400 border-blue-500/20'}
                          `}>
                            {log.level}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300">{log.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Modal */}
      <NewSessionModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onAdd={handleAddSession} 
      />

    </div>
  );
};

export default App;
