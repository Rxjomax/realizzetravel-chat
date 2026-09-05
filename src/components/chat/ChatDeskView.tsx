import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { socketClient } from '../../services/socket';
import { Conversation, Message, User } from '../../types';
import {
  Search,
  Filter,
  UserCheck,
  Send,
  Phone,
  Calendar,
  DollarSign,
  MapPin,
  CheckCheck,
  Check,
  AlertCircle,
  Clock,
  ArrowRightLeft,
  XCircle,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';

export const ChatDeskView: React.FC = () => {
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'WAITING' | 'OPEN' | 'MY' | 'CLOSED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<User[]>([]);
  const [targetAgentId, setTargetAgentId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Close confirmation modal
  const [closeModalOpen, setCloseModalOpen] = useState(false);

  // Travel detail edit mode
  const [editingTravelInfo, setEditingTravelInfo] = useState(false);
  const [travelDestination, setTravelDestination] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [travelPassengers, setTravelPassengers] = useState<number>(2);
  const [travelBudget, setTravelBudget] = useState('');

  // New Note
  const [newNoteContent, setNewNoteContent] = useState('');

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.getConversations(activeFilter === 'ALL' ? undefined : activeFilter, searchQuery);
      setConversations(data.conversations);

      // If no conversation is selected, select the first one if available
      if (!selectedConvId && data.conversations.length > 0) {
        setSelectedConvId(data.conversations[0].id);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  }, [activeFilter, searchQuery, selectedConvId]);

  const fetchConversationDetails = useCallback(async (id: string) => {
    try {
      const data = await api.getConversationDetails(id);
      setSelectedConv(data.conversation);
      setMessages(data.messages);
      setEvents(data.events);
      setNotes(data.notes);

      // Pre-fill editable fields
      setTravelDestination(data.conversation.customer?.destination_interest || '');
      setTravelDate(data.conversation.customer?.travel_date || '');
      setTravelPassengers(data.conversation.customer?.passenger_count || 2);
      setTravelBudget(data.conversation.customer?.budget || '');
    } catch (err) {
      console.error('Error fetching details:', err);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedConvId) {
      fetchConversationDetails(selectedConvId);
    }
  }, [selectedConvId, fetchConversationDetails]);

  // Realtime listeners
  useEffect(() => {
    const unbindCreated = socketClient.on('conversation:created', () => {
      fetchConversations();
    });

    const unbindAssigned = socketClient.on('conversation:assigned', (payload) => {
      fetchConversations();
      if (selectedConvId === payload.conversationId) {
        fetchConversationDetails(payload.conversationId);
      }
    });

    const unbindNewMsg = socketClient.on('message:new', (payload) => {
      if (selectedConvId === payload.conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        });
      }
      fetchConversations();
    });

    const unbindTransferred = socketClient.on('conversation:transferred', (payload) => {
      fetchConversations();
      if (selectedConvId === payload.conversationId) {
        fetchConversationDetails(payload.conversationId);
      }
    });

    const unbindClosed = socketClient.on('conversation:closed', (payload) => {
      fetchConversations();
      if (selectedConvId === payload.conversationId) {
        fetchConversationDetails(payload.conversationId);
      }
    });

    const unbindReopened = socketClient.on('conversation:reopened', (payload) => {
      fetchConversations();
      if (selectedConvId === payload.conversationId) {
        fetchConversationDetails(payload.conversationId);
      }
    });

    const unbindPollSync = socketClient.on('poll:sync', () => {
      fetchConversations();
      if (selectedConvId) {
        fetchConversationDetails(selectedConvId);
      }
    });

    return () => {
      unbindCreated();
      unbindAssigned();
      unbindNewMsg();
      unbindTransferred();
      unbindClosed();
      unbindReopened();
      unbindPollSync();
    };
  }, [fetchConversations, fetchConversationDetails, selectedConvId]);

  // Handle "Atender" atomic action
  const handleAssign = async () => {
    if (!selectedConvId) return;
    setIsAssigning(true);
    setErrorMessage(null);
    try {
      await api.assignConversation(selectedConvId);
      await fetchConversationDetails(selectedConvId);
      await fetchConversations();
    } catch (err: any) {
      setErrorMessage(err.message || 'Esta conversa já foi assumida por outro atendente.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConvId) return;

    setIsSending(true);
    try {
      const res = await api.sendMessage(selectedConvId, inputText);
      setMessages((prev) => [...prev, res.message]);
      setInputText('');
      await fetchConversations();
    } catch (err: any) {
      setErrorMessage(err.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle Open Transfer Modal
  const handleOpenTransfer = async () => {
    try {
      const data = await api.getUsers();
      // Filter out self
      setAvailableAgents(data.users.filter((u) => u.id !== user?.id));
      setTransferModalOpen(true);
    } catch (err) {
      console.error('Error fetching attendants for transfer:', err);
    }
  };

  // Handle Confirm Transfer
  const handleConfirmTransfer = async () => {
    if (!selectedConvId || !targetAgentId) return;
    try {
      await api.transferConversation(selectedConvId, targetAgentId, transferReason);
      setTransferModalOpen(false);
      setTransferReason('');
      await fetchConversationDetails(selectedConvId);
      await fetchConversations();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao transferir conversa.');
    }
  };

  // Handle Close Conversation
  const handleConfirmClose = async () => {
    if (!selectedConvId) return;
    try {
      await api.closeConversation(selectedConvId);
      setCloseModalOpen(false);
      await fetchConversationDetails(selectedConvId);
      await fetchConversations();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao encerrar atendimento.');
    }
  };

  // Handle Reopen Conversation
  const handleReopen = async () => {
    if (!selectedConvId) return;
    try {
      await api.reopenConversation(selectedConvId);
      await fetchConversationDetails(selectedConvId);
      await fetchConversations();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao reabrir atendimento.');
    }
  };

  // Save updated travel parameters
  const handleSaveTravelInfo = async () => {
    if (!selectedConv?.customer?.id) return;
    try {
      await api.updateCustomer(selectedConv.customer.id, {
        destination_interest: travelDestination,
        travel_date: travelDate,
        passenger_count: Number(travelPassengers),
        budget: travelBudget,
      });
      setEditingTravelInfo(false);
      await fetchConversationDetails(selectedConvId!);
    } catch (err) {
      console.error('Error saving travel info:', err);
    }
  };

  // Add internal note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !selectedConv?.customer?.id) return;
    try {
      const res = await api.addCustomerNote(selectedConv.customer.id, newNoteContent);
      setNotes((prev) => [res.note, ...prev]);
      setNewNoteContent('');
    } catch (err) {
      console.error('Error adding note:', err);
    }
  };

  const isAssignedToMe = selectedConv?.assigned_user_id === user?.id;
  const isSupervisorOrAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const canReply = isAssignedToMe || isSupervisorOrAdmin;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#F8FAFC] text-slate-800">
      {/* ========================================================================= */}
      {/* COLUNA 1 — LISTA DE CONVERSAS (Fila, Filtros, Busca)                       */}
      {/* ========================================================================= */}
      <div className="w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0">
        {/* Search & Filter Header */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar cliente, telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold text-xs shrink-0 transition-colors ${
                activeFilter === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setActiveFilter('WAITING')}
              className={`px-2.5 py-1 rounded-md font-semibold text-xs shrink-0 transition-colors flex items-center gap-1.5 ${
                activeFilter === 'WAITING' ? 'bg-orange-500 text-white shadow-xs' : 'bg-orange-50 text-orange-600 border border-orange-200/60 hover:bg-orange-100'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              Aguardando
            </button>
            <button
              onClick={() => setActiveFilter('OPEN')}
              className={`px-2.5 py-1 rounded-md font-semibold text-xs shrink-0 transition-colors ${
                activeFilter === 'OPEN' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Em Atendimento
            </button>
            <button
              onClick={() => setActiveFilter('MY')}
              className={`px-2.5 py-1 rounded-md font-semibold text-xs shrink-0 transition-colors ${
                activeFilter === 'MY' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Minhas
            </button>
            <button
              onClick={() => setActiveFilter('CLOSED')}
              className={`px-2.5 py-1 rounded-md font-semibold text-xs shrink-0 transition-colors ${
                activeFilter === 'CLOSED' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Encerradas
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Filter className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Nenhuma conversa encontrada neste filtro.
            </div>
          ) : (
            conversations.map((c) => {
              const isSelected = c.id === selectedConvId;
              const isWaiting = c.status === 'WAITING';
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedConvId(c.id)}
                  className={`p-3.5 cursor-pointer transition-all relative flex items-start gap-3 ${
                    isSelected
                      ? 'bg-blue-50/90 border-l-4 border-blue-600 shadow-xs'
                      : isWaiting
                      ? 'bg-amber-50/40 hover:bg-amber-50/70'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Customer Avatar */}
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0 mt-0.5 shadow-xs">
                    {c.customer?.name?.charAt(0) || 'C'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className="text-xs font-bold text-slate-800 truncate">
                        {c.customer?.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 truncate mb-1.5">
                      {c.last_message?.content || 'Nova mensagem recebida'}
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      {/* Status / Attendant */}
                      {isWaiting ? (
                        <span className="inline-flex items-center gap-1.5 font-bold text-[10px] text-amber-700 bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Aguardando
                        </span>
                      ) : c.assigned_user ? (
                        <span className="text-slate-500 font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Atendente: {c.assigned_user.name.split(' ')[0]}
                        </span>
                      ) : (
                        <span className="text-slate-400">Sem atendente</span>
                      )}

                      {/* Destination Pill */}
                      {c.customer?.destination_interest && (
                        <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full font-semibold truncate max-w-[120px]">
                          {c.customer.destination_interest.split(',')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COLUNA 2 — CONVERSA (Histórico, Mensagens, Atender/Transferir/Encerrar)     */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col bg-[#F8FAFC] min-w-0 border-r border-slate-200">
        {selectedConv ? (
          <>
            {/* Top Bar of Active Conversation */}
            <div className="h-16 px-5 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shadow-xs shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center font-bold text-sm text-emerald-700 shrink-0">
                  {selectedConv.customer?.name?.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-800 truncate flex items-center gap-2">
                    {selectedConv.customer?.name}
                    {selectedConv.status === 'WAITING' && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Fila de Espera
                      </span>
                    )}
                    {selectedConv.status === 'CLOSED' && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full">
                        Atendimento Concluído
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span>{selectedConv.customer?.phone}</span>
                    {selectedConv.assigned_user && (
                      <span className="text-slate-600 font-medium">
                        • Atendente: <strong className="text-slate-700">{selectedConv.assigned_user.name}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Atender, Transferir, Encerrar */}
              <div className="flex items-center gap-2 shrink-0">
                {selectedConv.status === 'WAITING' && (
                  <button
                    onClick={handleAssign}
                    disabled={isAssigning}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{isAssigning ? 'Iniciando...' : 'Atender Cliente'}</span>
                  </button>
                )}

                {selectedConv.status !== 'CLOSED' && selectedConv.status !== 'WAITING' && (
                  <>
                    <button
                      onClick={handleOpenTransfer}
                      className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-xs"
                      title="Transferir conversa para outro colega"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                      <span className="hidden sm:inline">Transferir</span>
                    </button>

                    <button
                      onClick={() => setCloseModalOpen(true)}
                      className="px-3.5 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                      title="Encerrar atendimento"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span className="hidden sm:inline">Finalizar</span>
                    </button>
                  </>
                )}

                {selectedConv.status === 'CLOSED' && (
                  <button
                    onClick={handleReopen}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reabrir Atendimento</span>
                  </button>
                )}
              </div>
            </div>

            {/* Error banner if any */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700 font-bold">
                  ✕
                </button>
              </div>
            )}

            {/* Chat Messages List with WhatsApp Styling */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3.5 whatsapp-chat-bg">
              <div className="flex flex-col items-center my-1">
                <span className="bg-white/80 backdrop-blur-xs text-slate-500 text-[10px] px-3 py-1 rounded-full font-bold shadow-xs border border-slate-200/50">
                  Mensagens Oficiais do WhatsApp
                </span>
              </div>

              {selectedConv.status === 'WAITING' && (
                <div className="self-center bg-white/90 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-xl font-medium text-center shadow-xs mx-auto max-w-md">
                  ✨ Cliente aguardando atendimento. Clique no botão verde <strong>&quot;Atender Cliente&quot;</strong> acima para iniciar.
                </div>
              )}

              {messages.map((m) => {
                const isCustomer = m.sender_type === 'CUSTOMER';
                const isSystem = m.sender_type === 'SYSTEM';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-xs transition-all ${
                        isCustomer
                          ? 'bg-white text-slate-800 rounded-tl-xs border border-slate-200/60'
                          : isSystem
                          ? 'bg-amber-50 text-amber-950 rounded-tr-xs border border-amber-200'
                          : 'bg-[#d9fdd3] text-[#111b21] rounded-tr-xs border border-[#c4f0bd]'
                      }`}
                    >
                      <div className="text-[11px] font-bold mb-1 opacity-80 flex items-center gap-1.5">
                        {isCustomer ? (
                          selectedConv.customer?.name
                        ) : isSystem ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>Resposta Automática (Sistema)</span>
                          </>
                        ) : (
                          'Você (Agência)'
                        )}
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                      <div
                        className={`flex items-center gap-1.5 text-[10px] mt-1 justify-end ${
                          isCustomer ? 'text-slate-400' : isSystem ? 'text-amber-700/70' : 'text-slate-500'
                        }`}
                      >
                        <span>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {!isCustomer && (
                          <span>
                            {m.status === 'read' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Message Input Box + Travel Quick Replies */}
            {selectedConv.status !== 'CLOSED' ? (
              <div className="p-3.5 bg-white border-t border-slate-200 shrink-0 space-y-2.5">
                {!canReply && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Esta conversa está sendo atendida por outro colega.</span>
                  </div>
                )}

                {/* Travel Quick Replies */}
                {canReply && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider shrink-0 mr-1">
                      Respostas Rápidas:
                    </span>
                    <button
                      type="button"
                      onClick={() => setInputText('Olá! Tudo bem? Sou atendente da agência de viagens. Como posso te ajudar com seu roteiro hoje?')}
                      className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium shrink-0 transition-colors"
                    >
                      👋 Boas-vindas
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputText('Para qual destino você está planejando viajar e para quantas pessoas seria o pacote?')}
                      className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium shrink-0 transition-colors"
                    >
                      🏖️ Destino & Passageiros
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputText('Temos facilidades imperdíveis: parcelamento em até 10x sem juros no cartão ou condição especial no Pix à vista!')}
                      className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium shrink-0 transition-colors"
                    >
                      💳 Condições de Pagamento
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputText('Já estou montando a sua cotação completa com voos e hospedagem. Só um instante por favor!')}
                      className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium shrink-0 transition-colors"
                    >
                      ⏱️ Montando Cotação
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-center gap-2.5">
                  <input
                    type="text"
                    disabled={!canReply || isSending}
                    placeholder={
                      canReply
                        ? 'Escreva sua mensagem no WhatsApp...'
                        : 'Assuma o atendimento para responder...'
                    }
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!canReply || isSending || !inputText.trim()}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Enviar</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-4 bg-white border-t border-slate-200 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Atendimento finalizado. Para falar novamente com o passageiro, clique em &quot;Reabrir Atendimento&quot;.</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
            <div className="text-base font-bold text-slate-700">Nenhum atendimento selecionado</div>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Selecione uma conversa na coluna à esquerda para visualizar o histórico de mensagens e responder ao cliente.
            </p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* COLUNA 3 — INFORMAÇÕES DO CLIENTE E PARÂMETROS DA VIAGEM                  */}
      {/* ========================================================================= */}
      {selectedConv && (
        <div className="w-full md:w-72 lg:w-80 bg-white border-l border-slate-200 p-5 shrink-0 overflow-y-auto space-y-6">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
              Perfil do Cliente
            </h2>

            <div className="flex flex-col items-center mb-6">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-2xl text-slate-500 font-bold mb-3 border border-slate-200">
                {selectedConv.customer?.name?.charAt(0) || 'C'}
              </div>
              <p className="font-bold text-slate-800 text-sm text-center">{selectedConv.customer?.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{selectedConv.customer?.phone}</p>
              <span className="mt-2 text-[10px] text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full font-bold">
                WhatsApp Verificado
              </span>
            </div>
          </div>

          {/* Travel Parameters (Editable by Attendants) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Parâmetros de Viagem</p>
              {!editingTravelInfo ? (
                <button
                  onClick={() => setEditingTravelInfo(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Editar
                </button>
              ) : (
                <button
                  onClick={handleSaveTravelInfo}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Salvar
                </button>
              )}
            </div>

            {editingTravelInfo ? (
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Destino de Interesse</label>
                  <input
                    type="text"
                    value={travelDestination}
                    onChange={(e) => setTravelDestination(e.target.value)}
                    placeholder="ex: Porto Seguro, BA"
                    className="w-full bg-white border border-slate-200 rounded p-2 text-slate-700 text-xs focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Data da Viagem</label>
                  <input
                    type="date"
                    value={travelDate}
                    onChange={(e) => setTravelDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded p-2 text-slate-700 text-xs focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Passageiros</label>
                  <input
                    type="number"
                    min={1}
                    value={travelPassengers}
                    onChange={(e) => setTravelPassengers(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded p-2 text-slate-700 text-xs focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Orçamento Estimado</label>
                  <input
                    type="text"
                    value={travelBudget}
                    onChange={(e) => setTravelBudget(e.target.value)}
                    placeholder="ex: R$ 6.500"
                    className="w-full bg-white border border-slate-200 rounded p-2 text-slate-700 text-xs focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Destino de Interesse</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedConv.customer?.destination_interest ? (
                      <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded font-bold">
                        {selectedConv.customer.destination_interest}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">Ainda não informado</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Data Prevista</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                    {selectedConv.customer?.travel_date || 'A definir'}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Passageiros</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                    {selectedConv.customer?.passenger_count || 1} pessoa(s)
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Orçamento Estimado</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                    {selectedConv.customer?.budget || 'Em aberto'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Internal Notes Section */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">
              Observações & Notas Internas
            </p>

            <form onSubmit={handleAddNote} className="mb-3">
              <textarea
                rows={2}
                placeholder="Adicionar nota para a equipe..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none"
              />
              <button
                type="submit"
                disabled={!newNoteContent.trim()}
                className="w-full py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900 transition-colors mt-1"
              >
                SALVAR NOTA
              </button>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-medium">
                    <span className="font-bold text-slate-700">{note.user_name}</span>
                    <span>{new Date(note.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{note.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE TRANSFERÊNCIA */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-600" />
              Transferir Atendimento
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Selecione o atendente que continuará a conversa com {selectedConv?.customer?.name}.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Novo Atendente</label>
                <select
                  value={targetAgentId}
                  onChange={(e) => setTargetAgentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Selecione um atendente...</option>
                  {availableAgents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.status === 'ONLINE' ? '🟢 Online' : '🔴 Offline'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Motivo (opcional)</label>
                <textarea
                  rows={2}
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="ex: Cliente com dúvidas específicas de cruzeiros internacionais"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-500 hover:text-slate-800 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!targetAgentId}
                  onClick={handleConfirmTransfer}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-lg shadow-xs transition-colors"
                >
                  Confirmar Transferência
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ENCERRAMENTO */}
      {closeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600" />
              Encerrar Atendimento
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Tem certeza que deseja encerrar o atendimento com <strong className="text-slate-800">{selectedConv?.customer?.name}</strong>?
              O histórico continuará salvo no banco de dados e poderá ser consultado a qualquer momento.
            </p>

            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setCloseModalOpen(false)}
                className="px-3.5 py-1.5 text-slate-500 hover:text-slate-800 font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-xs transition-colors"
              >
                Sim, Encerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
