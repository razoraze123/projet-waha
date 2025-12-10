import React, { useState, useEffect } from 'react';
import {
  Send,
  Activity,
  CheckCircle,
  Users,
  MessageSquare,
  Play,
  Square,
  Smartphone,
  Terminal,
  Image as ImageIcon,
  MapPin,
  Mic,
  FileText,
  Eye,
  User,
  Smile,
  Inbox
} from 'lucide-react';
import { Session } from '../types';

const FeaturesPanel: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [responseLog, setResponseLog] = useState<string>('// Les réponses de l\'API apparaîtront ici...');

  // Common Inputs
  const [targetNumber, setTargetNumber] = useState('33611309743');

  // Message Inputs
  const [messageText, setMessageText] = useState('');

  // Media Inputs
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [fileName, setFileName] = useState('');

  // Location Inputs
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [address, setAddress] = useState('');

  // Other Inputs
  const [messageId, setMessageId] = useState('');
  const [reactionEmoji, setReactionEmoji] = useState('👍');

  // Fetch sessions on mount
  useEffect(() => {
    fetch('/api/sessions')
      .then(res => res.json())
      .then((data: Session[]) => {
        setSessions(data);
        if (data.length > 0) {
          setSelectedSessionId(data[0].id);
        }
      })
      .catch(err => console.error('Error fetching sessions:', err));
  }, []);

  const logResponse = (title: string, data: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${title}:
${JSON.stringify(data, null, 2)}

`;
    setResponseLog(prev => formatted + prev);
  };

  const executeApi = async (endpoint: string, body: any = {}, method = 'POST') => {
    if (!selectedSessionId) {
      alert('Veuillez sélectionner une session active.');
      return;
    }

    setLoading(true);
    try {
      // Build Payload
      const payload: any = { ...body };

      // For GET requests, parameters are in query string, sessionId is handled separately
      // For POST requests, sessionId is in body
      if (method !== 'GET') {
        payload.sessionId = selectedSessionId;
        // Clean up empty fields
        Object.keys(payload).forEach(key => (payload[key] === '' || payload[key] === undefined) && delete payload[key]);
      }

      let url = endpoint;
      let options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };

      if (method === 'GET') {
        const params = new URLSearchParams({ sessionId: selectedSessionId, ...payload });
        url += `?${params.toString()}`;
      } else {
        options.body = JSON.stringify(payload);
      }

      const res = await fetch(url, options);
      const data = await res.json();
      logResponse(`${method} ${endpoint}`, data);
    } catch (error) {
      logResponse(`ERROR ${endpoint}`, { error: error.toString() });
    } finally {
      setLoading(false);
    }
  };

  // --- Action Handlers ---

  // Basics
  const handleStartTyping = () => executeApi('/api/start-typing', { number: targetNumber });
  const handleStopTyping = () => executeApi('/api/stop-typing', { number: targetNumber });
  const handleSendMessage = () => executeApi('/api/send-message', { number: targetNumber, message: messageText });

  // Media
  const handleSendImage = () => executeApi('/api/send-image', { number: targetNumber, imageUrl: mediaUrl, caption });
  const handleSendFile = () => executeApi('/api/send-file', { number: targetNumber, fileUrl: mediaUrl, fileName });
  const handleSendVoice = () => executeApi('/api/send-voice', { number: targetNumber, audioUrl: mediaUrl });

  // Location
  const handleSendLocation = () => executeApi('/api/send-location', { number: targetNumber, latitude, longitude, address });

  // Misc
  const handleSendSeen = () => executeApi('/api/send-seen', { number: targetNumber, messageId });
  const handleReact = () => executeApi('/api/react', { number: targetNumber, text: reactionEmoji, key: messageId });
  const handleCheckNumber = () => executeApi('/api/check-number', { number: targetNumber });
  const handleGetProfilePic = () => executeApi('/api/contact/profile-pic', { number: targetNumber }, 'GET');
  const handleGetGroups = () => executeApi('/api/groups', {}, 'GET');
  const handleGetMessages = () => executeApi('/api/messages', {}, 'GET');


  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between sticky top-0 bg-slate-950/80 backdrop-blur-md py-4 z-10 border-b border-slate-800">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="text-indigo-400" />
          Laboratoire de Fonctionnalités
        </h2>

        {/* Session Selector */}
        <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-lg border border-slate-800">
          <span className="text-slate-400 text-sm font-medium pl-2">Session:</span>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="bg-slate-950 text-slate-200 border border-slate-700 rounded px-3 py-1 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">-- Sélectionner --</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Controls */}
        <div className="lg:col-span-2 space-y-6">

          {/* Target Configuration */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-indigo-300 font-medium mb-4 flex items-center gap-2 text-sm uppercase">
              <User size={16} /> Configuration Cible
            </h3>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Numéro cible (ex: 336...)</label>
              <input
                type="text"
                value={targetNumber}
                onChange={(e) => setTargetNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:border-indigo-500 outline-none font-mono"
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleCheckNumber} disabled={loading} className="text-xs bg-slate-800 px-3 py-1.5 rounded text-emerald-400 border border-slate-700 hover:bg-slate-700 flex items-center gap-1">
                <CheckCircle size={12} /> Check Exists
              </button>
              <button onClick={handleGetProfilePic} disabled={loading} className="text-xs bg-slate-800 px-3 py-1.5 rounded text-blue-400 border border-slate-700 hover:bg-slate-700 flex items-center gap-1">
                <User size={12} /> Get Profile Pic
              </button>
            </div>
          </div>

          {/* Messaging & Typing */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-indigo-300 font-medium mb-4 flex items-center gap-2 text-sm uppercase">
              <MessageSquare size={16} /> Messagerie & Présence
            </h3>

            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                <button onClick={handleStartTyping} disabled={loading} className="flex-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 py-2 rounded text-xs border border-slate-700 flex items-center justify-center gap-2">
                  <Play size={14} /> Start Typing
                </button>
                <button onClick={handleStopTyping} disabled={loading} className="flex-1 bg-slate-800 hover:bg-slate-700 text-rose-400 py-2 rounded text-xs border border-slate-700 flex items-center justify-center gap-2">
                  <Square size={14} /> Stop Typing
                </button>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Texte du message</label>
                <textarea
                  rows={2}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Salut, comment ça va ?"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:border-indigo-500 outline-none text-sm"
                />
              </div>
              <button onClick={handleSendMessage} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded text-sm font-medium flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                <Send size={16} /> Envoyer Message Texte
              </button>
            </div>
          </div>

          {/* Multimedia */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-indigo-300 font-medium mb-4 flex items-center gap-2 text-sm uppercase">
              <ImageIcon size={16} /> Multimédia (Image, Audio, Fichier)
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">URL Média (Image / Audio / Fichier)</label>
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/image.png"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:border-indigo-500 outline-none text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Légende (Caption) - Pour Image</label>
                  <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm" placeholder="Une belle photo..." />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Nom du fichier - Pour Document</label>
                  <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm" placeholder="document.pdf" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2">
                <button onClick={handleSendImage} disabled={loading} className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded text-xs border border-slate-700 flex flex-col items-center gap-1">
                  <ImageIcon size={16} className="text-pink-400" /> Send Image
                </button>
                <button onClick={handleSendVoice} disabled={loading} className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded text-xs border border-slate-700 flex flex-col items-center gap-1">
                  <Mic size={16} className="text-orange-400" /> Send Voice
                </button>
                <button onClick={handleSendFile} disabled={loading} className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded text-xs border border-slate-700 flex flex-col items-center gap-1">
                  <FileText size={16} className="text-blue-400" /> Send File
                </button>
              </div>
            </div>
          </div>

          {/* Geo & Misc */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Location */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <h3 className="text-indigo-300 font-medium mb-4 flex items-center gap-2 text-sm uppercase">
                <MapPin size={16} /> Localisation
              </h3>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Lat (48.8566)" className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-sm" />
                  <input type="text" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Long (2.3522)" className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-sm" />
                </div>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse (Optionnel)" className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-sm" />
                <button onClick={handleSendLocation} disabled={loading} className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded text-xs border border-slate-700 flex items-center justify-center gap-2">
                  <MapPin size={14} className="text-red-400" /> Envoyer Position
                </button>
              </div>
            </div>

            {/* Read Receipts & Groups */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <h3 className="text-indigo-300 font-medium mb-4 flex items-center gap-2 text-sm uppercase">
                <Smartphone size={16} /> Divers
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">ID Message & Réaction</label>
                  <input type="text" value={messageId} onChange={(e) => setMessageId(e.target.value)} placeholder="BAE5F..." className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-sm font-mono mb-2" />

                  <div className="flex gap-2">
                    <input type="text" value={reactionEmoji} onChange={(e) => setReactionEmoji(e.target.value)} className="w-12 text-center bg-slate-950 border border-slate-800 rounded px-1 py-1.5 text-slate-200 text-sm" placeholder="👍" />
                    <button onClick={handleReact} disabled={loading} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-1.5 rounded text-xs border border-slate-700 flex items-center justify-center gap-2">
                      <Smile size={14} className="text-yellow-400" /> Réagir
                    </button>
                  </div>

                  <button onClick={handleSendSeen} disabled={loading} className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-1.5 rounded text-xs border border-slate-700 flex items-center justify-center gap-2">
                    <Eye size={14} className="text-cyan-400" /> Mark as Seen
                  </button>
                </div>
                <hr className="border-slate-800" />
                <div className="flex gap-2">
                  <button onClick={handleGetGroups} disabled={loading} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded text-xs border border-slate-700 flex items-center justify-center gap-2">
                    <Users size={14} className="text-purple-400" /> Groupes
                  </button>
                  <button onClick={handleGetMessages} disabled={loading} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded text-xs border border-slate-700 flex items-center justify-center gap-2">
                    <Inbox size={14} className="text-green-400" /> Messages
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Right Column: Console/Logs */}
        <div className="lg:col-span-1 h-full min-h-[500px]">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-full flex flex-col shadow-inner sticky top-24 max-h-[calc(100vh-8rem)]">
            <h3 className="text-slate-400 font-medium mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
              <Terminal size={16} /> Console API
            </h3>
            <div className="flex-1 bg-black/50 rounded-lg p-3 font-mono text-xs text-green-400 overflow-y-auto whitespace-pre-wrap border border-slate-900/50 scrollbar-thin scrollbar-thumb-slate-700">
              {responseLog}
            </div>
            <button
              onClick={() => setResponseLog('// Console effacée\n')}
              className="mt-3 text-xs text-slate-500 hover:text-slate-300 text-right w-full"
            >
              Effacer la console
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FeaturesPanel;