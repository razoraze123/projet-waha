import React, { useState, useEffect } from 'react';
import { Inbox, RefreshCw, User, MessageSquare, Clock } from 'lucide-react';

interface Message {
    id: string;
    sessionId: string;
    from: string;
    pushName?: string;
    timestamp: number;
    content: any;
    fromMe: boolean;
}

const MessagesPanel: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/messages');
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();

        if (autoRefresh) {
            const interval = setInterval(fetchMessages, 3000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const extractTextContent = (content: any): string => {
        if (!content) return '[Contenu vide]';
        if (content.conversation) return content.conversation;
        if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
        if (content.imageMessage) return '📷 Image';
        if (content.videoMessage) return '🎬 Vidéo';
        if (content.audioMessage) return '🎵 Audio';
        if (content.documentMessage) return `📄 ${content.documentMessage.fileName || 'Document'}`;
        if (content.stickerMessage) return '🎨 Sticker';
        if (content.locationMessage) return '📍 Localisation';
        if (content.contactMessage) return '👤 Contact';
        return '[Type non supporté]';
    };

    const formatPhoneNumber = (jid: string): string => {
        if (!jid) return 'Inconnu';
        return jid.replace('@s.whatsapp.net', '').replace('@g.us', ' (Groupe)');
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 rounded-lg">
                        <Inbox className="text-indigo-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Messages Reçus</h2>
                        <p className="text-slate-500 text-sm">
                            {messages.length} messages • Dernière mise à jour: {new Date().toLocaleTimeString('fr-FR')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                        />
                        Auto-refresh
                    </label>
                    <button
                        onClick={fetchMessages}
                        disabled={loading}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Messages List */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {messages.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageSquare className="text-slate-500" size={32} />
                        </div>
                        <h3 className="text-slate-300 font-medium">Aucun message reçu</h3>
                        <p className="text-slate-500 text-sm mt-1">Les messages entrants apparaîtront ici</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`p-4 hover:bg-slate-800/50 transition-colors ${msg.fromMe ? 'bg-indigo-950/20' : ''}`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Avatar */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${msg.fromMe ? 'bg-indigo-600' : 'bg-slate-700'
                                        }`}>
                                        <User size={20} className="text-white" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-200 font-medium truncate">
                                                    {msg.fromMe ? 'Moi' : (msg.pushName || formatPhoneNumber(msg.from))}
                                                </span>
                                                <span className="text-xs text-slate-600 font-mono">
                                                    {formatPhoneNumber(msg.from)}
                                                </span>
                                                {msg.fromMe && (
                                                    <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">
                                                        Envoyé
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center text-slate-500 text-xs shrink-0">
                                                <Clock size={12} className="mr-1" />
                                                {formatTimestamp(msg.timestamp)}
                                            </div>
                                        </div>
                                        <p className="text-slate-400 text-sm break-words">
                                            {extractTextContent(msg.content)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessagesPanel;
