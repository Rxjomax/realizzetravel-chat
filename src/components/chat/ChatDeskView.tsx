import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  ArrowDown,
  RefreshCw,
  MessageSquarePlus,
} from 'lucide-react';
import { extractTravelParameters, hasExtractedAnyInfo, parseBudgetValue } from '../../utils/travelExtractor';

export function extractConsultantName(fullName?: string): string {
  if (!fullName) return 'Consultor';
  const parenMatch = fullName.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    return parenMatch[1].trim();
  }
  const clean = fullName.replace(/\s*\([^)]*\)/g, '').trim();
  return clean || fullName;
}

export const ChatDeskView: React.FC = () => {
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'WAITING' | 'OPEN' | 'MY' | 'CLOSED'>('ALL');
  const [agentsMap, setAgentsMap] = useState<Record<string, User>>({});
  const [includeAgentPrefix, setIncludeAgentPrefix] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Simulation Modal State (Customer Inbound Test)
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [simMsgText, setSimMsgText] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

  // Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<User[]>([]);
  const [targetAgentId, setTargetAgentId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Close & Sales Conversion Modal State
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [saleOutcome, setSaleOutcome] = useState<'WON' | 'LOST'>('WON');
  const [saleValueInput, setSaleValueInput] = useState<string>('');
  const [lostReason, setLostReason] = useState<string>('Orçamento acima do esperado');
  const [customLostReason, setCustomLostReason] = useState<string>('');

  // Auto-extraction indicators
  const [autoExtractedSuccess, setAutoExtractedSuccess] = useState(false);
  const [isAutoExtracting, setIsAutoExtracting] = useState(false);

  // Travel detail edit mode
  const [editingTravelInfo, setEditingTravelInfo] = useState(false);
  const [travelDestination, setTravelDestination] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [travelPassengers, setTravelPassengers] = useState<number>(2);
  const [travelBudget, setTravelBudget] = useState('');

  // New Note
  const [newNoteContent, setNewNoteContent] = useState('');

  // Auto-scroll and Pin Reply Box Refs & States
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isSyncingWhatsApp, setIsSyncingWhatsApp] = useState(false);

  const handleSyncWhatsApp = async () => {
    try {
      setIsSyncingWhatsApp(true);
      await api.syncZapiChats();
      await fetchConversations();
      if (selectedConvId) {
        await fetchConversationDetails(selectedConvId);
      }
    } catch (e) {
      console.error('Error syncing WhatsApp:', e);
    } finally {
      setIsSyncingWhatsApp(false);
    }
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  const handleMessageScroll = useCallback(() => {
    if (!messageContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messageContainerRef.current;
    const isFar = scrollHeight - scrollTop - clientHeight > 160;
    setShowScrollBottom(isFar);
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.getConversations(activeFilter === 'ALL' ? undefined : activeFilter, searchQuery);
      // Deduplicate conversations by ID
      const uniqueConvs = (data.conversations || []).filter((c, idx, arr) =>
        arr.findIndex((item) => item.id === c.id) === idx
      );
      setConversations(uniqueConvs);

      // If no conversation is selected, select the first one if available
      if (!selectedConvId && uniqueConvs.length > 0) {
        setSelectedConvId(uniqueConvs[0].id);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  }, [activeFilter, searchQuery, selectedConvId]);

  const fetchConversationDetails = useCallback(async (id: string) => {
    try {
      const data = await api.getConversationDetails(id);
      setSelectedConv(data.conversation);
      // Deduplicate messages by ID to prevent duplicate key errors
      const seenMsgIds = new Set<string>();
      const uniqueMsgs = (data.messages || []).filter((m: Message) => {
        const msgKey = m.id || `temp_${Math.random()}`;
        if (seenMsgIds.has(msgKey)) return false;
        seenMsgIds.add(msgKey);
        return true;
      });
      setMessages(uniqueMsgs);
      setEvents(data.events);
      setNotes(data.notes);

      // Pre-fill editable fields
      const cust = data.conversation.customer;
      setTravelDestination(cust?.destination_interest || '');
      setTravelDate(cust?.travel_date || '');
      setTravelPassengers(cust?.passenger_count || 2);
      setTravelBudget(cust?.budget || '');

      // Automatic travel parameters extraction from messages
      if (data.messages && data.messages.length > 0 && cust) {
        const allCustomerText = data.messages
          .filter((m: Message) => m.sender_type === 'CUSTOMER')
          .map((m: Message) => m.content)
          .join('\n');

        if (allCustomerText) {
          const extracted = extractTravelParameters(allCustomerText);
          if (hasExtractedAnyInfo(extracted)) {
            const hasNewDest = !cust.destination_interest && extracted.destination;
            const hasNewDate = !cust.travel_date && extracted.travelDate;
            const hasNewBudget = !cust.budget && extracted.budget;
            const hasNewPax = (!cust.passenger_count || cust.passenger_count === 1) && extracted.passengerCount;

            if (hasNewDest || hasNewDate || hasNewBudget || hasNewPax) {
              api.updateCustomerTravelParams(cust.id, {
                destination_interest: extracted.destination || cust.destination_interest,
                travel_date: extracted.travelDate || cust.travel_date,
                passenger_count: extracted.passengerCount || cust.passenger_count,
                budget: extracted.budget || cust.budget,
                auto_extracted: true,
              }).then((res) => {
                if (res.success && res.customer) {
                  setSelectedConv((prev) => prev ? { ...prev, customer: res.customer } : null);
                  if (res.customer.destination_interest) setTravelDestination(res.customer.destination_interest);
                  if (res.customer.travel_date) setTravelDate(res.customer.travel_date);
                  if (res.customer.passenger_count) setTravelPassengers(res.customer.passenger_count);
                  if (res.customer.budget) setTravelBudget(res.customer.budget);
                  setAutoExtractedSuccess(true);
                  setTimeout(() => setAutoExtractedSuccess(false), 5000);
                }
              }).catch(() => {});
            }
          }
        }
      }
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

  // Periodic auto-refresh for realtime sync resilience
  useEffect(() => {
    const timer = setInterval(() => {
      fetchConversations();
      if (selectedConvId) {
        fetchConversationDetails(selectedConvId);
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [fetchConversations, selectedConvId, fetchConversationDetails]);

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

    const unbindCleared = socketClient.on('conversation:cleared', () => {
      fetchConversations();
      setSelectedConv(null);
      setSelectedConvId(null);
      setMessages([]);
    });

    // Guaranteed polling interval for instant message reception
    const intervalTimer = setInterval(() => {
      fetchConversations();
      if (selectedConvId) {
        fetchConversationDetails(selectedConvId);
      }
    }, 3000);

    return () => {
      clearInterval(intervalTimer);
      unbindCreated();
      unbindAssigned();
      unbindNewMsg();
      unbindTransferred();
      unbindClosed();
      unbindReopened();
      unbindPollSync();
      unbindCleared();
    };
  }, [fetchConversations, fetchConversationDetails, selectedConvId]);

  // Auto-scroll to bottom on conversation change
  useEffect(() => {
    if (selectedConvId) {
      scrollToBottom('auto');
    }
  }, [selectedConvId, scrollToBottom]);

  // Auto-scroll smoothly when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages.length, scrollToBottom]);

  const loadAgentsMap = useCallback(async () => {
    try {
      const res = await api.getUsers();
      const map: Record<string, User> = {};
      res.users.forEach((u) => {
        map[u.id] = u;
      });
      setAgentsMap(map);
    } catch (e) {
      console.error('Error loading agents map:', e);
    }
  }, []);

  useEffect(() => {
    loadAgentsMap();
  }, [loadAgentsMap]);

  // Handle "Atender" atomic action
  const handleAssign = async () => {
    if (!selectedConvId) return;
    setIsAssigning(true);
    setErrorMessage(null);

    const nowIso = new Date().toISOString();

    // Optimistic UI update: immediately transition conversation to OPEN
    const currentAttendant = user || {
      id: 'usr_agent',
      name: 'Você',
      role: 'AGENT',
      status: 'ONLINE',
      email: '',
      organization_id: 'org_realizzetravel',
      created_at: nowIso,
      updated_at: nowIso,
    };

    setSelectedConv((prev) =>
      prev
        ? {
            ...prev,
            status: 'OPEN',
            assigned_user_id: currentAttendant.id,
            assigned_user: currentAttendant as any,
            updated_at: nowIso,
            last_message_at: nowIso,
            auto_requeued_inactivity: false,
          }
        : null
    );

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConvId
          ? {
              ...c,
              status: 'OPEN',
              assigned_user_id: currentAttendant.id,
              assigned_user: currentAttendant as any,
              updated_at: nowIso,
              last_message_at: nowIso,
              auto_requeued_inactivity: false,
            }
          : c
      )
    );

    try {
      await api.assignConversation(selectedConvId);
      await fetchConversationDetails(selectedConvId);
      if (activeFilter === 'WAITING') {
        setActiveFilter('OPEN');
      } else {
        await fetchConversations();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Esta conversa já foi assumida por outro atendente.');
      await fetchConversationDetails(selectedConvId);
      await fetchConversations();
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConvId || isSending) return;

    const rawText = inputText.trim();
    setIsSending(true);
    setInputText(''); // Clear input immediately to prevent double submissions

    try {
      let messageToSend = rawText;
      if (includeAgentPrefix) {
        const shortName = extractConsultantName(user?.name);
        const prefix = `*[${shortName}]*:`;
        if (!messageToSend.startsWith(`*[${shortName}]*`) && !messageToSend.startsWith(`${shortName}:`)) {
          messageToSend = `${prefix} ${messageToSend}`;
        }
      }

      const res = await api.sendMessage(selectedConvId, messageToSend);
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.message.id)) return prev;
        return [...prev, res.message];
      });
      await fetchConversations();
    } catch (err: any) {
      setErrorMessage(err.message || 'Não foi possível enviar a mensagem.');
      setInputText(rawText); // Restore original text if sending failed
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

  // Open Close Modal with defaults
  const handleOpenCloseModal = () => {
    setSaleOutcome('WON');
    const budgetVal = parseBudgetValue(selectedConv?.customer?.budget);
    setSaleValueInput(budgetVal ? `R$ ${budgetVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 5.000,00');
    setLostReason('Orçamento acima do esperado');
    setCustomLostReason('');
    setCloseModalOpen(true);
  };

  // Handle Close Conversation with Sales Outcome Tracking
  const handleConfirmClose = async () => {
    if (!selectedConvId) return;
    try {
      const numValue =
        saleOutcome === 'WON'
          ? (parseFloat(saleValueInput.replace(/[^0-9.]/g, '')) || parseBudgetValue(selectedConv?.customer?.budget) || 0)
          : undefined;
      const finalLost =
        saleOutcome === 'LOST'
          ? (lostReason === 'Outro' ? customLostReason || 'Outro motivo' : lostReason)
          : undefined;

      await api.closeConversation(selectedConvId, saleOutcome, numValue, finalLost);
      setCloseModalOpen(false);
      await fetchConversationDetails(selectedConvId);
      await fetchConversations();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao encerrar atendimento.');
    }
  };

  // Simulate Inbound Customer Message (Instant test for WhatsApp replies)
  const handleSimulateCustomerMessage = async (customText?: string) => {
    const textToSend = customText || simMsgText;
    if (!textToSend.trim() || !selectedConv) return;
    try {
      setIsSimulating(true);
      await api.simulateInboundMessage({
        conversationId: selectedConv.id,
        phone: selectedConv.customer?.phone,
        name: selectedConv.customer?.name,
        content: textToSend.trim(),
      });
      setSimMsgText('');
      setIsSimulateModalOpen(false);
      await fetchConversationDetails(selectedConv.id);
      await fetchConversations();
      setTimeout(() => scrollToBottom(), 100);
    } catch (err: any) {
      console.error('Error simulating customer message:', err);
      setErrorMessage('Erro ao simular mensagem do cliente.');
    } finally {
      setIsSimulating(false);
    }
  };

  // Trigger auto extraction manually on demand
  const handleTriggerAutoExtraction = async () => {
    if (!selectedConv?.customer?.id || messages.length === 0) return;
    setIsAutoExtracting(true);
    try {
      const allText = messages.map((m) => m.content).join('\n');
      const extracted = extractTravelParameters(allText);
      if (hasExtractedAnyInfo(extracted)) {
        const res = await api.updateCustomerTravelParams(selectedConv.customer.id, {
          destination_interest: extracted.destination || selectedConv.customer.destination_interest,
          travel_date: extracted.travelDate || selectedConv.customer.travel_date,
          passenger_count: extracted.passengerCount || selectedConv.customer.passenger_count,
          budget: extracted.budget || selectedConv.customer.budget,
          auto_extracted: true,
        });
        if (res.success && res.customer) {
          setSelectedConv((prev) => (prev ? { ...prev, customer: res.customer } : null));
          if (res.customer.destination_interest) setTravelDestination(res.customer.destination_interest);
          if (res.customer.travel_date) setTravelDate(res.customer.travel_date);
          if (res.customer.passenger_count) setTravelPassengers(res.customer.passenger_count);
          if (res.customer.budget) setTravelBudget(res.customer.budget);
          setAutoExtractedSuccess(true);
          setTimeout(() => setAutoExtractedSuccess(false), 5000);
        }
      }
    } catch (err) {
      console.error('Error triggering auto extraction:', err);
    } finally {
      setIsAutoExtracting(false);
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

  // Deduplicate messages safely for rendering to eliminate duplicate bubbles & duplicate key warnings
  const displayMessages = useMemo(() => {
    const seenIds = new Set<string>();
    const seenSignatures = new Set<string>();

    return messages.filter((m) => {
      if (!m) return false;

      // 1. Deduplicate by unique message ID
      if (m.id) {
        if (seenIds.has(m.id)) return false;
        seenIds.add(m.id);
      }

      // 2. Deduplicate near-instant identical messages from same sender in same conversation
      const timestamp = m.created_at ? new Date(m.created_at).getTime() : 0;
      const timeBucket = timestamp > 0 ? Math.floor(timestamp / 5000) : 0;
      const signature = `${m.conversation_id || ''}_${m.sender_type || ''}_${m.sender_id || ''}_${m.content || ''}_${timeBucket}`;
      if (seenSignatures.has(signature)) {
        return false;
      }
      seenSignatures.add(signature);

      return true;
    });
  }, [messages]);

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col md:flex-row overflow-hidden bg-[#F8FAFC] text-slate-800">
      {/* ========================================================================= */}
      {/* COLUNA 1 — LISTA DE CONVERSAS (Fila, Filtros, Busca)                       */}
      {/* ========================================================================= */}
      <div className="w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 h-full min-h-0 overflow-hidden">
        {/* Search & Filter Header */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar cliente, telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              onClick={handleSyncWhatsApp}
              disabled={isSyncingWhatsApp}
              title="Sincronizar conversas do WhatsApp (Z-API)"
              className="p-2 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 rounded-lg transition-colors flex items-center justify-center shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingWhatsApp ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 font-bold text-[10px] text-amber-700 bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Aguardando
                          </span>
                          {(c.auto_requeued_inactivity || (Date.now() - new Date(c.last_message_at).getTime()) > 86400000) && (
                            <span className="text-[9px] font-bold text-amber-950 bg-amber-200 border border-amber-300 px-1.5 py-0.2 rounded-full" title="Reenfileirado: atendente ausente por mais de 24h">
                              ⏰ &gt;24h Fila
                            </span>
                          )}
                        </div>
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
      <div className="flex-1 flex flex-col bg-[#F8FAFC] min-w-0 border-r border-slate-200 h-full min-h-0 overflow-hidden relative">
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
                      onClick={() => {
                        setSimMsgText('');
                        setIsSimulateModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                      title="Simular mensagem recebida pelo WhatsApp do cliente"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden md:inline">Simular Resposta</span>
                    </button>

                    <button
                      onClick={handleOpenTransfer}
                      className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-xs"
                      title="Transferir conversa para outro colega"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                      <span className="hidden sm:inline">Transferir</span>
                    </button>

                    <button
                      onClick={handleOpenCloseModal}
                      className="px-3.5 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                      title="Encerrar atendimento com relatório de conversão"
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
            <div
              ref={messageContainerRef}
              onScroll={handleMessageScroll}
              className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3.5 whatsapp-chat-bg"
            >
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

              {displayMessages.map((m, idx) => {
                const isCustomer = m.sender_type === 'CUSTOMER';
                const isSystem = m.sender_type === 'SYSTEM';

                // Resolve agent profile dynamically from live agentsMap or message fields
                const agentUser = m.sender_id ? agentsMap[m.sender_id] : null;
                const rawSenderName = agentUser?.name || m.sender_name || (m.sender_id === user?.id ? user?.name : 'Consultor RealizzeTravel');
                const consultantDisplayName = extractConsultantName(rawSenderName);
                const consultantAvatar = agentUser?.avatar || m.sender_avatar || (m.sender_id === user?.id ? user?.avatar : undefined);
                const isSelf = m.sender_id === user?.id;

                return (
                  <div
                    key={m.id ? `msg_${m.id}` : `msg_idx_${idx}`}
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
                      <div className="text-[11px] font-bold mb-1 opacity-90 flex items-center gap-1.5">
                        {isCustomer ? (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <div className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                              {(selectedConv.customer?.name || 'C').charAt(0)}
                            </div>
                            <span>{selectedConv.customer?.name || 'Passageiro'}</span>
                          </div>
                        ) : isSystem ? (
                          <div className="flex items-center gap-1.5 text-amber-800">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Resposta Automática (Sistema)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-emerald-950">
                            {consultantAvatar ? (
                              <img
                                src={consultantAvatar}
                                alt={consultantDisplayName}
                                className="w-4 h-4 rounded-full object-cover ring-1 ring-emerald-700/30 shrink-0"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-emerald-700 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                                {consultantDisplayName.charAt(0)}
                              </div>
                            )}
                            <span className="font-bold text-emerald-950">{consultantDisplayName}</span>
                            <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.2 rounded-full">
                              Consultor
                            </span>
                            {isSelf && (
                              <span className="text-[9px] text-emerald-700/70 font-medium">
                                (você)
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {!isCustomer && !isSystem && !m.content.startsWith(`*[${consultantDisplayName}]*`) && !m.content.startsWith(`${consultantDisplayName}:`) && (
                          <span className="font-bold text-emerald-900 text-xs block mb-0.5 select-none">
                            {consultantDisplayName}:
                          </span>
                        )}
                        {m.content}
                      </p>

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
              <div ref={messagesEndRef} />
            </div>

            {/* Jump to bottom button when scrolled up */}
            {showScrollBottom && (
              <button
                type="button"
                onClick={() => scrollToBottom('smooth')}
                className="absolute bottom-24 right-6 z-30 bg-white/95 hover:bg-white text-slate-700 hover:text-emerald-700 px-3 py-1.5 rounded-full shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                <span>Mensagens recentes</span>
              </button>
            )}

            {/* Bottom Message Input Box + Travel Quick Replies */}
            {selectedConv.status !== 'CLOSED' ? (
              <div className="p-3 sm:p-3.5 bg-white border-t border-slate-200 shrink-0 sticky bottom-0 z-20 shadow-xs space-y-2.5">
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

                <form onSubmit={handleSendMessage} className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="text"
                      disabled={!canReply || isSending}
                      placeholder={
                        canReply
                          ? `Escreva sua mensagem como ${extractConsultantName(user?.name)}...`
                          : 'Assuma o atendimento para responder...'
                      }
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!canReply || isSending || !inputText.trim()}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                    >
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline">Enviar</span>
                    </button>
                  </div>
                  {canReply && (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 select-none">
                      <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-800 transition-colors">
                        <input
                          type="checkbox"
                          checked={includeAgentPrefix}
                          onChange={(e) => setIncludeAgentPrefix(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                        />
                        <span>
                          Identificar como <strong className="text-emerald-700 font-semibold">{extractConsultantName(user?.name)}</strong> antes da mensagem
                        </span>
                      </label>
                      <span className="text-[10px] text-slate-400 hidden sm:inline">
                        Exibido ao cliente no WhatsApp
                      </span>
                    </div>
                  )}
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
        <div className="w-full md:w-72 lg:w-80 bg-white border-l border-slate-200 p-5 shrink-0 overflow-y-auto space-y-6 h-full min-h-0">
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

          {/* Travel Parameters (Automatic & Editable) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Parâmetros de Viagem</p>
                {selectedConv.customer?.destination_interest && (
                  <span className="bg-emerald-50 text-emerald-700 text-[9px] px-1.5 py-0.2 rounded font-bold border border-emerald-200">
                    Auto
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerAutoExtraction}
                  disabled={isAutoExtracting}
                  className="text-[11px] text-cyan-600 hover:text-cyan-700 font-semibold flex items-center gap-1 cursor-pointer"
                  title="Detectar parâmetros automaticamente a partir das mensagens"
                >
                  <Sparkles className={`w-3 h-3 ${isAutoExtracting ? 'animate-spin' : ''}`} />
                  <span>Auto-detectar</span>
                </button>
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
            </div>

            {autoExtractedSuccess && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 flex items-center gap-1.5 animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Parâmetros de viagem atualizados automaticamente!</span>
              </div>
            )}

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

      {/* MODAL DE ENCERRAMENTO E CONVERSÃO DE VENDAS */}
      {closeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Finalizar Atendimento & Conversão
              </h3>
              <button
                onClick={() => setCloseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Finalizando conversa com <strong className="text-slate-900">{selectedConv?.customer?.name}</strong>.
              Informe o resultado comercial para alimentar o relatório de conversão de vendas da agência.
            </p>

            {/* Outcome Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                A venda foi bem-sucedida?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSaleOutcome('WON')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    saleOutcome === 'WON'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ThumbsUp className={`w-5 h-5 ${saleOutcome === 'WON' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">Sim, Venda Concluída!</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSaleOutcome('LOST')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    saleOutcome === 'LOST'
                      ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-xs ring-2 ring-rose-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ThumbsDown className={`w-5 h-5 ${saleOutcome === 'LOST' ? 'text-rose-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">Não / Não Fechou</span>
                </button>
              </div>
            </div>

            {/* If WON: Sale Value */}
            {saleOutcome === 'WON' && (
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                <label className="block text-xs font-semibold text-emerald-900">
                  Valor Total da Venda Fechada (R$):
                </label>
                <input
                  type="text"
                  value={saleValueInput}
                  onChange={(e) => setSaleValueInput(e.target.value)}
                  placeholder="ex: R$ 6.500,00"
                  className="w-full bg-white border border-emerald-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-emerald-700">
                  Este valor será somado ao volume total de vendas e faturamento no relatório da agência.
                </p>
              </div>
            )}

            {/* If LOST: Reason */}
            {saleOutcome === 'LOST' && (
              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2">
                <label className="block text-xs font-semibold text-rose-900">
                  Motivo da perda / não conversão:
                </label>
                <select
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="w-full bg-white border border-rose-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Orçamento acima do esperado">Orçamento acima do esperado pelo cliente</option>
                  <option value="Datas incompatíveis / sem voos">Datas incompatíveis ou falta de vagas nos voos</option>
                  <option value="Cliente comprou em outra agência">Cliente comprou em outra agência / concorrente</option>
                  <option value="Cliente desistiu da viagem">Cliente desistiu da viagem</option>
                  <option value="Cliente parou de responder">Cliente parou de responder no WhatsApp</option>
                  <option value="Apenas cotação prévia / informativa">Apenas cotação prévia / informativa</option>
                  <option value="Outro">Outro motivo</option>
                </select>

                {lostReason === 'Outro' && (
                  <input
                    type="text"
                    value={customLostReason}
                    onChange={(e) => setCustomLostReason(e.target.value)}
                    placeholder="Especifique o motivo da perda..."
                    className="w-full bg-white border border-rose-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 mt-2"
                  />
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setCloseModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Salvar & Encerrar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SIMULAR MENSAGEM DO CLIENTE (TESTE RÁPIDO DE INBOUND)             */}
      {/* ========================================================================= */}
      {isSimulateModalOpen && selectedConv && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <MessageSquarePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">Simular Resposta do Cliente</h3>
                  <p className="text-xs text-slate-500">
                    Enviando como <strong>{selectedConv.customer?.name}</strong> ({selectedConv.customer?.phone})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSimulateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Escolha uma mensagem rápida de teste:
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  'Quero cotar um pacote para Porto de Galinhas para 2 pessoas em Outubro.',
                  'Qual o valor aproximado para Cancún com hotel all-inclusive?',
                  'Temos um grupo de 4 adultos para viajar no Réveillon com orçamento de R$ 15.000.',
                  'Gostei da proposta, como faço para fechar e assinar o contrato?',
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSimulateCustomerMessage(preset)}
                    disabled={isSimulating}
                    className="text-left text-xs p-2.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-slate-700 transition-all cursor-pointer font-medium"
                  >
                    💬 "{preset}"
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Ou digite uma mensagem personalizada:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={simMsgText}
                  onChange={(e) => setSimMsgText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSimulateCustomerMessage();
                  }}
                  placeholder="ex: Olá, tenho interesse em viajar no próximo mês..."
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleSimulateCustomerMessage()}
                  disabled={!simMsgText.trim() || isSimulating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSimulating ? 'Enviando...' : 'Enviar'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Essa simulação aciona o mesmo fluxo do webhook do WhatsApp oficial: roteamento inteligente, extração de parâmetros de viagem com IA e notificações em tempo real.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
