import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { WhatsAppGroup, WhatsAppGroupMessage } from '../../types';
import {
  Users,
  Search,
  Send,
  Phone,
  Shield,
  MessageCircle,
  Clock,
  Sparkles,
  Info,
  CheckCheck,
  Tag,
  Share2,
} from 'lucide-react';

export const WhatsAppGroupsView: React.FC = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<WhatsAppGroup | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const res = await api.getWhatsAppGroups();
      setGroups(res.groups);
      if (res.groups.length > 0 && !selectedGroup) {
        setSelectedGroup(res.groups[0]);
      } else if (selectedGroup) {
        const updated = res.groups.find(g => g.id === selectedGroup.id);
        if (updated) setSelectedGroup(updated);
      }
    } catch (err) {
      console.error('Error loading WhatsApp groups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.destination_focus && g.destination_focus.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newMessage.trim() || isSending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      await api.sendWhatsAppGroupMessage(selectedGroup.id, content);
      await loadGroups();
    } catch (err) {
      console.error('Error sending group message:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-100">
      {/* Top Banner indicating access to main agency number */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 text-white px-6 py-3 shrink-0 flex flex-wrap items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
            <MessageCircle className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Grupos do WhatsApp da Agência</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-emerald-100">
                Oficial RealizzeTravel
              </span>
            </div>
            <div className="text-xs text-emerald-100/90 flex items-center gap-2 mt-0.5">
              <Phone className="w-3 h-3 text-emerald-300 inline" />
              <span>Número Principal: <strong>(81) 99535-7254</strong></span>
              <span className="text-emerald-300/60">•</span>
              <span>Todos os consultores podem interagir e responder aos clientes nos grupos</span>
            </div>
          </div>
        </div>

        <div className="text-xs bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-emerald-300" />
          <span>Atuando como: <strong>{user?.name}</strong></span>
        </div>
      </div>

      {/* Main Groups Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Groups List */}
        <div className="w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-200 bg-slate-50/50">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar grupo ou destino..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
                Carregando grupos do WhatsApp...
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhum grupo encontrado.
              </div>
            ) : (
              filteredGroups.map(group => {
                const isSelected = selectedGroup?.id === group.id;
                return (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 relative ${
                      isSelected
                        ? 'bg-emerald-50/80 border-l-4 border-l-emerald-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="relative shrink-0">
                      {group.avatar_url ? (
                        <img
                          src={group.avatar_url}
                          alt={group.name}
                          className="w-11 h-11 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                          {group.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-semibold text-xs text-slate-900 truncate">
                          {group.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {group.last_message_at
                            ? new Date(group.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {group.member_count} participantes
                        </span>
                        {group.destination_focus && (
                          <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-700 border border-cyan-200 truncate">
                            {group.destination_focus}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 truncate mt-1">
                        {group.last_message || 'Nenhuma mensagem recente'}
                      </p>
                    </div>

                    {group.unread_count && group.unread_count > 0 ? (
                      <span className="absolute right-3 top-7 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                        {group.unread_count}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Group Chat */}
        {selectedGroup ? (
          <div className="flex-1 flex flex-col bg-slate-50/50">
            {/* Group Chat Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                {selectedGroup.avatar_url ? (
                  <img
                    src={selectedGroup.avatar_url}
                    alt={selectedGroup.name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                    {selectedGroup.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {selectedGroup.name}
                    {selectedGroup.destination_focus && (
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Destino: {selectedGroup.destination_focus}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <span>{selectedGroup.member_count} membros</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-medium">Conectado via (81) 99535-7254</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  Canal Compartilhado da Agência
                </span>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Group security notice */}
              <div className="flex justify-center">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2 rounded-xl flex items-center gap-2 max-w-xl text-center shadow-sm">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Todas as mensagens enviadas neste grupo saem diretamente pelo WhatsApp oficial da <strong>RealizzeTravel</strong>. Seus colegas consultores podem ver e complementar o atendimento.
                  </span>
                </div>
              </div>

              {/* Group message bubbles */}
              {selectedGroup.messages && selectedGroup.messages.length > 0 ? (
                selectedGroup.messages.map((msg, idx) => {
                  const isMe = msg.is_from_agency;
                  return (
                    <div
                      key={msg.id ? `gmsg_${msg.id}` : `gmsg_${idx}`}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="text-[10px] text-slate-400 mb-1 px-1 flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">{msg.sender_name}</span>
                        {isMe && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px]">
                            Agência
                          </span>
                        )}
                        <span>•</span>
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div
                        className={`max-w-lg rounded-2xl px-4 py-2.5 text-xs shadow-sm leading-relaxed ${
                          isMe
                            ? 'bg-emerald-600 text-white rounded-br-xs'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Nenhuma mensagem neste grupo ainda. Envie a primeira mensagem abaixo!
                </div>
              )}
            </div>

            {/* Message input bar */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-200">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder={`Responder no grupo como ${user?.name}...`}
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar</span>
                </button>
              </div>
              <div className="text-[11px] text-slate-400 mt-1.5 flex items-center justify-between">
                <span>Pressione Enter para enviar no grupo</span>
                <span>Enviando através de (81) 99535-7254</span>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs p-8">
            <MessageCircle className="w-12 h-12 text-slate-300 mb-3" />
            <p className="font-semibold text-slate-600 text-sm">Selecione um grupo de WhatsApp</p>
            <p className="text-slate-400 mt-1">
              Grupos sincronizados com o número principal (81) 99535-7254
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
