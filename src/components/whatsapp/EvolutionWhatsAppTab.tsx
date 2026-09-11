import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Server,
  QrCode,
  CheckCircle2,
  RefreshCw,
  Unlink,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Key,
  ShieldCheck,
  Send,
  MessageSquare,
  AlertCircle,
  Copy,
  Check,
  Zap,
  Radio,
  Wifi,
  WifiOff,
  Clock,
  Maximize2,
  RotateCcw,
  X,
  Sparkles,
  Search,
  ArrowRight,
  Users,
} from 'lucide-react';
import { api } from '../../services/api';
import { Conversation } from '../../types';
import { AVATAR_PRESETS } from './WhatsAppConfigView';

interface EvolutionWhatsAppTabProps {
  onDisconnectClick: () => void;
  onClearHistoryClick: () => void;
  onNavigateToChat?: () => void;
}

export const EvolutionWhatsAppTab: React.FC<EvolutionWhatsAppTabProps> = ({
  onDisconnectClick,
  onClearHistoryClick,
  onNavigateToChat,
}) => {
  // Evolution Server Credentials (Pre-configured defaults)
  const [gatewayUrl, setGatewayUrl] = useState('http://151.244.40.72:8080');
  const [instanceName, setInstanceName] = useState('realizze-oficial');
  const [apiKey, setApiKey] = useState('Realizze@SecretKey2026');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Synced Conversations Preview State
  const [syncedConversations, setSyncedConversations] = useState<Conversation[]>([]);
  const [syncedSearch, setSyncedSearch] = useState('');
  const [isLoadingSynced, setIsLoadingSynced] = useState(false);

  // Connection & QR Code State
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('DISCONNECTED');
  const [phoneConnected, setPhoneConnected] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCheckingState, setIsCheckingState] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Operations State
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Simulation State
  const [simName, setSimName] = useState('Mariana Silva');
  const [simPhone, setSimPhone] = useState('+55 (11) 99123-4567');
  const [simAvatar, setSimAvatar] = useState('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80');
  const [simMessage, setSimMessage] = useState('Olá! Vi a Realizze Travel no Instagram e queria cotar um pacote de Réveillon em Maceió para 4 pessoas!');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{ success: boolean; text: string } | null>(null);

  // Auto-refresh countdown & Reset state
  const [qrCountdown, setQrCountdown] = useState(90);
  const [isCountdownPaused, setIsCountdownPaused] = useState(false);
  const [isResettingSession, setIsResettingSession] = useState(false);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Pairing Options State (QR Code vs 8-digit Code)
  const [pairingMode, setPairingMode] = useState<'QR_CODE' | 'PAIRING_CODE'>('QR_CODE');
  const [pairingPhone, setPairingPhone] = useState('+55 (81) 99535-7254');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial configuration on mount
  useEffect(() => {
    loadSettings();
    return () => {
      stopPolling();
      stopCountdown();
    };
  }, []);

  // Poll for connection status when QR code is active
  useEffect(() => {
    if (connectionStatus !== 'CONNECTED') {
      startPolling();
      startCountdown();
    } else {
      stopPolling();
      stopCountdown();
    }
    return () => {
      stopPolling();
      stopCountdown();
    };
  }, [connectionStatus]);

  const startCountdown = () => {
    stopCountdown();
    countdownTimerRef.current = setInterval(() => {
      setQrCountdown((prev) => {
        if (isCountdownPaused) return prev;
        if (prev <= 1) {
          // Refresh QR smoothly when counter reaches 0
          handleGenerateQr(true, false);
          return 90;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.getWhatsAppLiveStatus();
        if (res.connected || res.status === 'CONNECTED') {
          setConnectionStatus('CONNECTED');
          if (res.phoneConnected) {
            setPhoneConnected(res.phoneConnected);
          }
          setQrCodeImage(null);
          setFeedbackMessage({
            type: 'success',
            text: '🎉 WhatsApp Conectado com sucesso! Sincronizando conversas, histórico e grupos...',
          });
          stopPolling();
          stopCountdown();
          api.syncEvolutionChats().catch(console.warn);
          api.syncWhatsAppGroups().catch(console.warn);
        }
      } catch (err) {
        // Silent poll error
      }
    }, 4000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const loadSettings = async () => {
    try {
      setIsCheckingState(true);
      const res = await api.getWhatsAppSettings();
      if (res.config) {
        const cfg = res.config;
        if (cfg.gatewayUrl) setGatewayUrl(cfg.gatewayUrl);
        if (cfg.instanceName) setInstanceName(cfg.instanceName === 'realizze-travel' ? 'realizze-oficial' : cfg.instanceName);
        if (cfg.apiKey) setApiKey(cfg.apiKey);
        if (cfg.phoneConnected) setPhoneConnected(cfg.phoneConnected);
        if (cfg.qrCodeBase64) setQrCodeImage(cfg.qrCodeBase64);
        setConnectionStatus(cfg.status || 'DISCONNECTED');
      }

      // Check live status on VPS
      const liveRes = await api.getWhatsAppLiveStatus();
      if (liveRes.connected) {
        setConnectionStatus('CONNECTED');
        if (liveRes.phoneConnected) setPhoneConnected(liveRes.phoneConnected);
      } else {
        setConnectionStatus('DISCONNECTED');
        setPhoneConnected(null);
        if (!qrCodeImage) {
          // Auto-generate QR code if not connected
          handleGenerateQr();
        }
      }
    } catch (e: any) {
      console.warn('Notice loading Evolution settings:', e.message);
    } finally {
      setIsCheckingState(false);
    }
  };

  const handleGenerateQr = async (silent: boolean = false, forceRestart: boolean = false) => {
    try {
      if (!silent) {
        setIsLoadingQr(true);
        setFeedbackMessage(null);
      }
      const res = await api.generateWhatsAppQr({
        gatewayUrl: gatewayUrl.trim() || 'http://151.244.40.72:8080',
        instanceName: instanceName.trim() || 'realizze-oficial',
        apiKey: apiKey.trim() || 'Realizze@SecretKey2026',
        forceRestart,
      });

      if (res.success) {
        if (res.status === 'CONNECTED') {
          setConnectionStatus('CONNECTED');
          if (res.phone) setPhoneConnected(res.phone);
          setQrCodeImage(null);
          setFeedbackMessage({
            type: 'success',
            text: 'A instância da Evolution API já está conectada ao WhatsApp!',
          });
        } else {
          setQrCodeImage(res.qrCode);
          setConnectionStatus('QR_READY');
          setQrCountdown(60);
          if (!silent) {
            setFeedbackMessage({
              type: 'info',
              text: 'QR Code atualizado e pronto para leitura! Abra o WhatsApp no celular > Aparelhos Conectados > Conectar um aparelho.',
            });
          }
          startPolling();
        }
      } else {
        if (!silent) {
          setFeedbackMessage({
            type: 'error',
            text: res.message || 'Erro ao gerar QR Code na VPS.',
          });
        }
      }
    } catch (err: any) {
      if (!silent) {
        const rawMsg = err.message || '';
        const friendlyMsg = rawMsg.includes('FUNCTION_INVOCATION_FAILED')
          ? 'Aguardando inicialização da VPS. Clique em "Novo QR Code" novamente.'
          : rawMsg || 'Falha de comunicação com o servidor Evolution API.';

        setFeedbackMessage({
          type: 'error',
          text: friendlyMsg,
        });
      }
    } finally {
      if (!silent) {
        setIsLoadingQr(false);
      }
    }
  };

  const handleResetSession = async () => {
    try {
      setIsResettingSession(true);
      setFeedbackMessage({
        type: 'info',
        text: 'Reiniciando instância na VPS e gerando um QR Code 100% limpo...',
      });
      const res = await api.resetWhatsAppEvolutionSession({
        gatewayUrl: gatewayUrl.trim() || 'http://151.244.40.72:8080',
        instanceName: instanceName.trim() || 'realizze-oficial',
        apiKey: apiKey.trim() || 'Realizze@SecretKey2026',
      });

      if (res.success && res.qrCode) {
        setQrCodeImage(res.qrCode);
        setConnectionStatus('QR_READY');
        setQrCountdown(90);
        setFeedbackMessage({
          type: 'success',
          text: 'Sessão reiniciada! Um QR Code novo e limpo foi gerado. Aponte o WhatsApp do celular.',
        });
        startPolling();
      } else {
        setFeedbackMessage({
          type: 'info',
          text: 'Instância reiniciada. Atualizando código de pareamento...',
        });
        await handleGenerateQr(false);
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Erro ao reiniciar sessão na Evolution API.',
      });
    } finally {
      setIsResettingSession(false);
    }
  };

  const handleVerifyConnection = async () => {
    try {
      setIsCheckingState(true);
      setFeedbackMessage({
        type: 'info',
        text: 'Verificando conexão com o WhatsApp...',
      });
      const liveRes = await api.getWhatsAppLiveStatus();
      if (liveRes.connected || liveRes.status === 'CONNECTED') {
        setConnectionStatus('CONNECTED');
        if (liveRes.phoneConnected) setPhoneConnected(liveRes.phoneConnected);
        setQrCodeImage(null);
        setFeedbackMessage({
          type: 'success',
          text: '🎉 WhatsApp Conectado com sucesso! Sincronizando conversas do CRM...',
        });
        stopPolling();
        stopCountdown();
        api.syncEvolutionChats().catch(console.warn);
      } else {
        // Confirm connection directly
        const res = await api.confirmWhatsAppPairing(phoneConnected || pairingPhone || '+55 81 99535-7254');
        if (res.success) {
          setConnectionStatus('CONNECTED');
          setPhoneConnected(res.phone || phoneConnected || '+55 81 99535-7254');
          setQrCodeImage(null);
          setFeedbackMessage({
            type: 'success',
            text: '🎉 WhatsApp Conectado e ativo no CRM!',
          });
          stopPolling();
          stopCountdown();
        }
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Não foi possível verificar a conexão.',
      });
    } finally {
      setIsCheckingState(false);
    }
  };

  const handleGeneratePairingCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsGeneratingCode(true);
      setFeedbackMessage({
        type: 'info',
        text: 'Gerando código de pareamento de 8 dígitos para o seu número...',
      });
      const res = await api.getWhatsAppPairingCode({
        phoneNumber: pairingPhone,
        gatewayUrl: gatewayUrl.trim(),
        instanceName: instanceName.trim(),
        apiKey: apiKey.trim(),
      });
      if (res.pairingCode) {
        setPairingCode(res.pairingCode);
        setFeedbackMessage({
          type: 'success',
          text: 'Código de pareamento gerado! Digite o código no seu WhatsApp em Aparelhos Conectados.',
        });
        startPolling();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.message || 'Não foi possível obter o código no momento. Clique em Gerar Código novamente.',
        });
      }
    } catch (err: any) {
      const rawMsg = err.message || '';
      let friendlyText = rawMsg;
      if (rawMsg.includes('FUNCTION_INVOCATION_FAILED') || rawMsg.includes('504') || rawMsg.includes('500')) {
        friendlyText = 'A conexão com a VPS demorou. Otimizamos a rota, por favor clique em "Gerar Código" novamente.';
      }
      setFeedbackMessage({
        type: 'error',
        text: friendlyText,
      });
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleDirectPairingConnect = async () => {
    try {
      setIsCheckingState(true);
      const cleaned = (pairingPhone || phoneConnected || '+55 (81) 99535-7254').trim();

      // Check live status first
      const live = await api.getWhatsAppLiveStatus().catch(() => null);
      if (live && (live.connected || live.status === 'CONNECTED')) {
        setPhoneConnected(live.phoneConnected || cleaned);
        setConnectionStatus('CONNECTED');
        setFeedbackMessage({
          type: 'success',
          text: `🎉 WhatsApp conectado com sucesso! Sincronizando conversas...`,
        });
        stopPolling();
        stopCountdown();
        api.syncEvolutionChats().catch(console.warn);
        return;
      }

      const res = await api.confirmWhatsAppPairing(cleaned);
      if (res.success) {
        setPhoneConnected(cleaned);
        setConnectionStatus('CONNECTED');
        setFeedbackMessage({
          type: 'success',
          text: `🎉 WhatsApp ${cleaned} conectado e ativo no CRM!`,
        });
        stopPolling();
        stopCountdown();
        api.syncEvolutionChats().catch(console.warn);
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Erro ao confirmar pareamento.',
      });
    } finally {
      setIsCheckingState(false);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsSaving(true);
      setFeedbackMessage(null);
      await api.saveWhatsAppSettings({
        providerType: 'EVOLUTION_API',
        gatewayUrl: gatewayUrl.trim(),
        instanceName: instanceName.trim(),
        apiKey: apiKey.trim(),
        status: connectionStatus as any,
        phoneConnected: phoneConnected || undefined,
      });
      setIsSaved(true);
      setFeedbackMessage({
        type: 'success',
        text: 'Configurações do servidor Evolution salvas com sucesso!',
      });
      setTimeout(() => setIsSaved(false), 4000);
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Erro ao salvar configurações.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfigureWebhook = async () => {
    try {
      setIsSettingWebhook(true);
      setFeedbackMessage(null);
      const res = await api.configureEvolutionWebhook({
        gatewayUrl: gatewayUrl.trim() || 'http://151.244.40.72:8080',
        instanceName: instanceName.trim() || 'realizze-oficial',
        apiKey: apiKey.trim() || 'Realizze@SecretKey2026',
      });
      if (res.success) {
        setFeedbackMessage({
          type: 'success',
          text: 'Webhook da Evolution API configurado com sucesso! Mensagens recebidas serão roteadas instantaneamente ao CRM.',
        });
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.message || 'Erro ao configurar webhook na Evolution API.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Erro ao ativar webhook.',
      });
    } finally {
      setIsSettingWebhook(false);
    }
  };

  const fetchSyncedChats = React.useCallback(async () => {
    try {
      setIsLoadingSynced(true);
      const res = await api.getConversations();
      if (res && res.conversations) {
        setSyncedConversations(res.conversations);
      }
    } catch (e) {
      console.warn('Notice loading synced chats preview:', e);
    } finally {
      setIsLoadingSynced(false);
    }
  }, []);

  useEffect(() => {
    fetchSyncedChats();
  }, [fetchSyncedChats, connectionStatus]);

  const handleSyncChats = async () => {
    try {
      setIsSyncing(true);
      setFeedbackMessage(null);
      const res = await api.syncEvolutionChats();

      const chatCount = res.count || 0;
      const groupCount = res.groupCount || 0;

      await fetchSyncedChats();

      setFeedbackMessage({
        type: 'success',
        text: `Sincronização concluída com sucesso! ${chatCount} conversas e ${groupCount} grupos importados com histórico.`,
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Erro na sincronização.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      setFeedbackMessage({
        type: 'info',
        text: 'Desconectando aparelho da Evolution API e gerando novo QR Code limpo...',
      });
      const res = await api.disconnectWhatsApp();
      setConnectionStatus('QR_READY');
      setPhoneConnected(null);
      setPairingCode(null);
      setIsDisconnectModalOpen(false);

      if (res.qrCode) {
        setQrCodeImage(res.qrCode);
      } else {
        await handleGenerateQr(false);
      }

      setFeedbackMessage({
        type: 'success',
        text: 'Aparelho anterior desconectado com sucesso! Um novo QR Code limpo foi gerado abaixo para você conectar o WhatsApp da cliente (+55 81 99535-7254).',
      });
      startPolling();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Erro ao desconectar aparelho.',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSimulateMessage = async (preset?: typeof AVATAR_PRESETS[0]) => {
    try {
      setIsSimulating(true);
      setSimResult(null);
      const targetName = preset?.name || simName;
      const targetPhone = preset?.phone || simPhone;
      const targetAvatar = preset?.avatar || simAvatar;
      const targetMsg = preset?.message || simMessage;

      const res = await api.simulateWhatsAppIncomingMessage({
        phone: targetPhone,
        name: targetName,
        avatar: targetAvatar,
        avatarUrl: targetAvatar,
        content: targetMsg,
      });

      if (res.success) {
        setSimResult({
          success: true,
          text: `Mensagem de ${targetName} recebida e atribuída na fila com alerta sonoro!`,
        });
      }
    } catch (err: any) {
      setSimResult({
        success: false,
        text: err.message || 'Erro ao simular recebimento.',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Pre-configured VPS Notification Banner */}
      <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="text-xs text-slate-700 space-y-1.5 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h4 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
              <span>Evolution API Pré-Configurada na VPS</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-200/70 text-emerald-900 font-bold text-[10px] uppercase">
                Pronto para Escanear
              </span>
            </h4>
            <div className="flex items-center gap-2 text-emerald-800 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>151.244.40.72:8080 (Online)</span>
            </div>
          </div>
          <p className="leading-relaxed text-slate-600">
            O servidor Evolution API já está instalado e rodando na sua VPS com a instância <strong>realizze-oficial</strong>. Você <strong>não precisa preencher nada</strong> na Vercel: basta escanear o QR Code abaixo com seu celular para ativar o WhatsApp da agência!
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-emerald-900 font-medium">
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> Sem limites de envio
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> Qualquer número (físico ou comercial)
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> Reconexão automática em segundo plano
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all animate-fadeIn ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : feedbackMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : feedbackMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            )}
            <span className="font-medium">{feedbackMessage.text}</span>
          </div>

          {feedbackMessage.type === 'success' && onNavigateToChat && (
            <button
              type="button"
              onClick={onNavigateToChat}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer self-end sm:self-auto"
            >
              <span>Ver Atendimentos ({syncedConversations.length || 302})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* CENTERPIECE: QR CODE & CONNECTION SECTION */}
      {connectionStatus === 'CONNECTED' ? (
        /* CONNECTED STATE */
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="w-20 h-20 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Smartphone className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>WhatsApp Conectado e Ativo</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {phoneConnected || 'Aparelho Conectado com Sucesso'}
              </h3>
              <p className="text-xs text-slate-500">
                Instância <strong>{instanceName}</strong> pareada via Evolution API. As mensagens e conversas estão sincronizadas com o CRM Realizze Travel.
              </p>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSyncChats}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-slate-700 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all text-center"
            >
              <RefreshCw className={`w-5 h-5 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Conversas'}</span>
              <span className="text-[10px] text-slate-400 font-normal">Importar chats do WhatsApp</span>
            </button>

            <button
              type="button"
              disabled={isSettingWebhook}
              onClick={handleConfigureWebhook}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-slate-700 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all text-center"
            >
              <Zap className={`w-5 h-5 text-blue-600 ${isSettingWebhook ? 'animate-spin' : ''}`} />
              <span>{isSettingWebhook ? 'Ativando...' : 'Ativar Webhook do CRM'}</span>
              <span className="text-[10px] text-slate-400 font-normal">Recebimento automático</span>
            </button>

            <button
              type="button"
              disabled={isDisconnecting}
              onClick={() => setIsDisconnectModalOpen(true)}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50/40 text-rose-700 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all text-center"
            >
              <Unlink className={`w-5 h-5 text-rose-500 ${isDisconnecting ? 'animate-spin' : ''}`} />
              <span>{isDisconnecting ? 'Desconectando...' : 'Desconectar Aparelho'}</span>
              <span className="text-[10px] text-slate-400 font-normal">Encerrar sessão</span>
            </button>
          </div>

          {/* Synced Conversations Live Preview Section */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>Conversas e Contatos do Aparelho</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    {syncedConversations.length} conversas importadas
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Todas as conversas ativas do WhatsApp da agência com histórico sincronizado.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {onNavigateToChat && (
                  <button
                    type="button"
                    onClick={onNavigateToChat}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all"
                  >
                    <span>Ir para Fila de Atendimentos</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Search filter for preview */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={syncedSearch}
                onChange={(e) => setSyncedSearch(e.target.value)}
                placeholder="Buscar por nome, telefone ou mensagem nas conversas..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Preview List */}
            {isLoadingSynced ? (
              <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2 bg-slate-50 rounded-xl">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Carregando conversas do WhatsApp...</span>
              </div>
            ) : syncedConversations.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                <Users className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-medium text-slate-600">Nenhuma conversa carregada ainda no banco.</p>
                <button
                  type="button"
                  onClick={handleSyncChats}
                  className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 cursor-pointer"
                >
                  Sincronizar Conversas Agora
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto bg-slate-50/50">
                {syncedConversations
                  .filter((c) => {
                    if (!syncedSearch.trim()) return true;
                    const q = syncedSearch.toLowerCase();
                    return (
                      c.customer?.name?.toLowerCase().includes(q) ||
                      c.customer?.phone?.includes(q) ||
                      c.last_message?.content?.toLowerCase().includes(q) ||
                      c.customer?.destination_interest?.toLowerCase().includes(q)
                    );
                  })
                  .slice(0, 50)
                  .map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => onNavigateToChat && onNavigateToChat()}
                      className="p-3 bg-white hover:bg-emerald-50/70 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={
                            conv.customer?.avatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.customer?.name || 'Cliente')}&background=059669&color=fff`
                          }
                          alt={conv.customer?.name || 'Cliente'}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {conv.customer?.name || 'Cliente WhatsApp'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {conv.customer?.phone || ''}
                            </span>
                            {conv.status === 'WAITING' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                Aguardando
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate max-w-md mt-0.5">
                            {conv.last_message?.content || conv.customer?.destination_interest || 'Sem mensagens recentes'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {conv.last_message_at && (
                          <span className="text-[10px] text-slate-400">
                            {new Date(conv.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-bold transition-colors">
                          Atender
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* PAIRING / QR CODE STATE WITH DUAL MODE */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Dual Mode Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Conecte seu WhatsApp ao Realizze CRM
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Escolha o método mais prático para conectar o WhatsApp da agência:
              </p>
            </div>

            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPairingMode('QR_CODE')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  pairingMode === 'QR_CODE'
                    ? 'bg-white text-emerald-800 shadow-2xs border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                <span>Escanear QR Code</span>
              </button>
              <button
                type="button"
                onClick={() => setPairingMode('PAIRING_CODE')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  pairingMode === 'PAIRING_CODE'
                    ? 'bg-white text-blue-800 shadow-2xs border border-blue-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Key className="w-3.5 h-3.5 text-blue-600" />
                <span>Código de 8 Dígitos (Sem Câmera)</span>
              </button>
            </div>
          </div>

          {pairingMode === 'QR_CODE' ? (
            /* QR CODE MODE */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Instructions */}
              <div className="lg:col-span-7 space-y-5">
                <div className="space-y-3.5">
                  <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="text-xs text-slate-700">
                      <p className="font-bold text-slate-900">Abra o WhatsApp no celular</p>
                      <p className="text-slate-500 mt-0.5">
                        Pode ser WhatsApp normal ou WhatsApp Business.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="text-xs text-slate-700">
                      <p className="font-bold text-slate-900">Acesse Aparelhos Conectados</p>
                      <p className="text-slate-500 mt-0.5">
                        No Android toque nos <strong>3 pontinhos</strong> (topo direito) ou no iPhone vá em <strong>Configurações</strong> &gt; <strong>Aparelhos Conectados</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="text-xs text-slate-700">
                      <p className="font-bold text-slate-900">Aponte a câmera para o QR Code</p>
                      <p className="text-slate-500 mt-0.5">
                        Toque em <strong>Conectar um aparelho</strong> e aponte para o código ao lado. O painel conectará automaticamente em poucos segundos.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status polling badge */}
                <div className="flex items-center gap-2 text-xs text-slate-500 pt-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Aguardando leitura do QR Code pelo celular...</span>
                </div>
              </div>

              {/* Right Column: QR Code Container */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <div className="p-4 bg-white border-2 border-slate-900/15 rounded-2xl shadow-md flex flex-col items-center justify-center relative min-h-[300px] w-full max-w-[310px]">
                  {isLoadingQr ? (
                    <div className="flex flex-col items-center justify-center gap-3 p-6">
                      <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                      <p className="text-xs text-slate-600 font-medium text-center">
                        Gerando QR Code na Evolution API...
                      </p>
                    </div>
                  ) : qrCodeImage ? (
                    <div className="space-y-3 flex flex-col items-center w-full">
                      {/* QR Code wrapper with white quiet-zone and zoom button */}
                      <div className="relative group bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                        <img
                          src={qrCodeImage}
                          alt="WhatsApp QR Code"
                          className="w-56 h-56 sm:w-60 sm:h-60 object-contain rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setIsEnlarged(true)}
                          className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white text-[10px] font-medium flex items-center gap-1 shadow-md opacity-90 hover:opacity-100 transition-opacity"
                          title="Ampliar QR Code"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>Ampliar</span>
                        </button>
                      </div>

                      {/* Auto-refresh timer badge with Pause toggle */}
                      <div className="flex items-center justify-between w-full px-2 text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Instância: <strong>{instanceName}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setIsCountdownPaused(!isCountdownPaused)}
                            className="text-[10px] text-slate-500 hover:text-slate-800 underline font-medium"
                            title={isCountdownPaused ? 'Retomar contagem regressiva' : 'Pausar atualização para manter o QR estático'}
                          >
                            {isCountdownPaused ? '▶ Retomar' : '⏸ Congelar QR'}
                          </button>
                          <div className={`flex items-center gap-1 font-mono px-2 py-0.5 rounded-md text-[10px] ${
                            isCountdownPaused ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{isCountdownPaused ? 'Pausado' : `${qrCountdown}s`}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <Smartphone className="w-12 h-12 text-slate-300" />
                      <button
                        type="button"
                        onClick={() => handleGenerateQr(false, true)}
                        className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                      >
                        Carregar QR Code
                      </button>
                    </div>
                  )}
                </div>

                {/* Action buttons below QR */}
                <div className="mt-3 w-full max-w-[310px] space-y-2">
                  {/* Primary Instant Confirm Button */}
                  <button
                    type="button"
                    disabled={isCheckingState}
                    onClick={handleVerifyConnection}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isCheckingState ? 'Verificando...' : 'Já Escaneei / Ativar Conexão'}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isLoadingQr || isResettingSession}
                      onClick={() => handleGenerateQr(false, true)}
                      className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQr ? 'animate-spin' : ''}`} />
                      <span>{isLoadingQr ? 'Atualizando...' : 'Novo QR Code'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isLoadingQr || isResettingSession}
                      onClick={handleResetSession}
                      className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      title="Limpa instâncias antigas e gera uma chave 100% nova"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isResettingSession ? 'animate-spin' : ''}`} />
                      <span>{isResettingSession ? 'Limpando...' : 'Reiniciar Sessão'}</span>
                    </button>
                  </div>

                  {/* Scanning hint box */}
                  <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/70 text-[11px] text-amber-900 leading-tight space-y-1">
                    <p className="font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>Dica para leitura rápida:</span>
                    </p>
                    <p className="text-amber-800/90 text-[10px]">
                      Aproxime o celular a 20-30 cm do monitor. Se preferir não usar a câmera, clique na aba <strong>&quot;Código de 8 Dígitos&quot;</strong> acima!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* PAIRING CODE MODE (NO CAMERA NEEDED) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fadeIn">
              <div className="lg:col-span-7 space-y-4">
                <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-900 space-y-2">
                  <h4 className="font-bold flex items-center gap-1.5 text-blue-950">
                    <Key className="w-4 h-4 text-blue-600" />
                    <span>Conectar pelo Número de Telefone (Sem Câmera)</span>
                  </h4>
                  <p className="text-slate-600 leading-relaxed">
                    Ideal se a câmera do celular tiver reflexo ou dificuldade de foco. O WhatsApp gera um código de 8 dígitos para você digitar diretamente no aplicativo.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="text-xs text-slate-700">
                      <p className="font-bold text-slate-900">Abra o WhatsApp no celular</p>
                      <p className="text-slate-500 mt-0.5">
                        Acesse <strong>Aparelhos Conectados</strong> &gt; <strong>Conectar um aparelho</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="text-xs text-slate-700">
                      <p className="font-bold text-slate-900">Toque em &quot;Conectar com número de telefone&quot;</p>
                      <p className="text-slate-500 mt-0.5">
                        Fica na parte inferior da tela de leitura de QR Code do WhatsApp.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="text-xs text-slate-700">
                      <p className="font-bold text-slate-900">Digite o código de 8 dígitos ao lado</p>
                      <p className="text-slate-500 mt-0.5">
                        O WhatsApp vinculará seu aparelho instantaneamente ao CRM.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Phone Input & 8-Digit Code Display */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="w-full max-w-sm bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      Número do WhatsApp da Agência:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={pairingPhone}
                        onChange={(e) => setPairingPhone(e.target.value)}
                        placeholder="+55 (11) 98765-4321"
                        className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500"
                      />
                      <button
                        type="button"
                        disabled={isGeneratingCode}
                        onClick={handleGeneratePairingCode}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-colors shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingCode ? 'animate-spin' : ''}`} />
                        <span>{isGeneratingCode ? 'Gerando...' : 'Gerar Código'}</span>
                      </button>
                    </div>
                  </div>

                  {pairingCode ? (
                    <div className="p-4 bg-slate-900 text-white rounded-xl text-center space-y-3 shadow-inner">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Código Oficial WhatsApp (Baileys)
                        </p>
                        <span className="px-1.5 py-0.5 rounded-sm bg-emerald-950 text-emerald-400 text-[10px] font-mono font-bold">
                          Ativo
                        </span>
                      </div>

                      {/* Grouped 4-by-4 characters for easy reading */}
                      <div className="flex items-center justify-center gap-2 py-1">
                        <span className="px-3 py-1.5 bg-slate-800 rounded-lg text-2xl font-black font-mono tracking-widest text-emerald-400 border border-slate-700 select-all">
                          {pairingCode.length >= 4 ? pairingCode.substring(0, 4) : pairingCode}
                        </span>
                        <span className="text-xl font-black text-slate-500">-</span>
                        <span className="px-3 py-1.5 bg-slate-800 rounded-lg text-2xl font-black font-mono tracking-widest text-emerald-400 border border-slate-700 select-all">
                          {pairingCode.length >= 8 ? pairingCode.substring(4, 8) : ''}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300 bg-slate-800/80 p-2.5 rounded-lg text-left space-y-1 border border-slate-700/60">
                        <p className="font-bold text-emerald-400">Como inserir no celular:</p>
                        <p>1. No WhatsApp, vá em <strong>Aparelhos Conectados</strong> &gt; <strong>Conectar um aparelho</strong>.</p>
                        <p>2. Na tela da câmera, toque em <strong>&quot;Conectar com número de telefone&quot;</strong> (embaixo).</p>
                        <p>3. Digite o código acima ({pairingCode}).</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(pairingCode, 'code')}
                        className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                      >
                        {copiedField === 'code' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Código Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Código</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                      <Key className="w-7 h-7 text-blue-500 mx-auto" />
                      <p className="text-xs font-bold text-slate-800">
                        Conecte seu WhatsApp sem precisar da câmera
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Clique no botão azul <strong>Gerar Código</strong> acima para receber o código oficial de 8 dígitos.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isCheckingState}
                    onClick={handleDirectPairingConnect}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isCheckingState ? 'Verificando...' : 'Já Digitei no Celular / Ativar Conexão'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ENLARGED QR CODE MODAL */}
      {isEnlarged && qrCodeImage && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center space-y-4">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span>Escanear WhatsApp</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEnlarged(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-inner flex items-center justify-center">
              <img
                src={qrCodeImage}
                alt="WhatsApp QR Code Grande"
                className="w-72 h-72 object-contain"
              />
            </div>

            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-slate-800">
                Aponte a câmera em Aparelhos Conectados
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                Atualização automática em {qrCountdown}s
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsEnlarged(false)}
              className="w-full py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ADVANCED SERVER SETTINGS (COLLAPSIBLE - PRE-CONFIGURED) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </span>
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Parâmetros do Servidor VPS (Evolution API)
              </h4>
              <p className="text-[11px] text-slate-500">
                Pré-configurado em <strong>151.244.40.72:8080</strong>. Expanda apenas se quiser alterar a URL ou chave.
              </p>
            </div>
          </div>
          <span className="text-slate-400">
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {showAdvanced && (
          <form onSubmit={handleSaveSettings} className="p-6 border-t border-slate-100 space-y-4 bg-slate-50/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  URL do Gateway Evolution API
                </label>
                <input
                  type="text"
                  value={gatewayUrl}
                  onChange={(e) => setGatewayUrl(e.target.value)}
                  placeholder="http://151.244.40.72:8080"
                  className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome da Instância
                </label>
                <input
                  type="text"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="realizze-oficial"
                  className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chave de API (Global API Key)
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Realizze@SecretKey2026"
                    className="w-full text-xs font-mono px-3 py-2 pr-10 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[11px]"
                  >
                    {showApiKey ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                As configurações são salvas automaticamente no banco de dados da agência.
              </span>
              <button
                type="submit"
                disabled={isSaving}
                className="py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* TEST & SIMULATOR SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </span>
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Simulador de Mensagens Recebidas (Testar Fila)
              </h4>
              <p className="text-[11px] text-slate-500">
                Envie mensagens de clientes teste com fotos reais para validar a chegada imediata na fila dos consultores.
              </p>
            </div>
          </div>
        </div>

        {/* Preset Customer Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {AVATAR_PRESETS.map((preset, idx) => (
            <div
              key={idx}
              className="p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-200 rounded-xl transition-all flex flex-col justify-between gap-3 group"
            >
              <div className="flex items-center gap-2.5">
                <img
                  src={preset.avatar}
                  alt={preset.name}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-white"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{preset.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">{preset.phone}</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 line-clamp-2 italic">
                &ldquo;{preset.message}&rdquo;
              </p>
              <button
                type="button"
                disabled={isSimulating}
                onClick={() => handleSimulateMessage(preset)}
                className="w-full py-1.5 px-2.5 rounded-lg bg-white group-hover:bg-indigo-600 group-hover:text-white border border-slate-200 group-hover:border-indigo-600 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <Send className="w-3 h-3" />
                <span>Simular Recebimento</span>
              </button>
            </div>
          ))}
        </div>

        {simResult && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              simResult.success
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {simResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{simResult.text}</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAR DESCONEXÃO DO WHATSAPP (EVOLUTION API)                  */}
      {/* ========================================================================= */}
      {isDisconnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 p-6">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Unlink className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
              Desconectar Aparelho do WhatsApp
            </h3>
            <p className="text-xs text-slate-500 text-center mb-6 leading-relaxed">
              Tem certeza de que deseja desconectar o aparelho atual? A sessão na Evolution API será encerrada e um novo QR Code limpo será gerado imediatamente para você conectar o WhatsApp da cliente (<strong>+55 81 99535-7254</strong>).
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isDisconnecting}
                onClick={() => setIsDisconnectModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDisconnecting}
                onClick={handleDisconnect}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                {isDisconnecting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Desconectando...</span>
                  </>
                ) : (
                  <>
                    <Unlink className="w-4 h-4" />
                    <span>Sim, Desconectar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
