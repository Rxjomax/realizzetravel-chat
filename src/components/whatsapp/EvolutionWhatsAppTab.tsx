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
} from 'lucide-react';
import { api } from '../../services/api';
import { AVATAR_PRESETS } from './WhatsAppConfigView';

interface EvolutionWhatsAppTabProps {
  onDisconnectClick: () => void;
  onClearHistoryClick: () => void;
}

export const EvolutionWhatsAppTab: React.FC<EvolutionWhatsAppTabProps> = ({
  onDisconnectClick,
  onClearHistoryClick,
}) => {
  // Evolution Server Credentials (Pre-configured defaults)
  const [gatewayUrl, setGatewayUrl] = useState('http://151.244.40.72:8080');
  const [instanceName, setInstanceName] = useState('realizze-oficial');
  const [apiKey, setApiKey] = useState('Realizze@SecretKey2026');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial configuration on mount
  useEffect(() => {
    loadSettings();
    return () => {
      stopPolling();
    };
  }, []);

  // Poll for connection status when QR code is active
  useEffect(() => {
    if (connectionStatus !== 'CONNECTED') {
      startPolling();
    } else {
      stopPolling();
    }
    return () => {
      stopPolling();
    };
  }, [connectionStatus]);

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
        if (cfg.instanceName) setInstanceName(cfg.instanceName);
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
      } else if (!qrCodeImage) {
        // Auto-generate QR code if not connected
        handleGenerateQr();
      }
    } catch (e: any) {
      console.warn('Notice loading Evolution settings:', e.message);
    } finally {
      setIsCheckingState(false);
    }
  };

  const handleGenerateQr = async () => {
    try {
      setIsLoadingQr(true);
      setFeedbackMessage(null);
      const res = await api.generateWhatsAppQr({
        gatewayUrl: gatewayUrl.trim() || 'http://151.244.40.72:8080',
        instanceName: instanceName.trim() || 'realizze-oficial',
        apiKey: apiKey.trim() || 'Realizze@SecretKey2026',
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
          setFeedbackMessage({
            type: 'info',
            text: 'QR Code atualizado! Abra o WhatsApp no celular > Aparelhos Conectados > Conectar um aparelho.',
          });
          startPolling();
        }
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.message || 'Erro ao gerar QR Code na VPS.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Falha de comunicação com o servidor Evolution API.',
      });
    } finally {
      setIsLoadingQr(false);
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

  const handleSyncChats = async () => {
    try {
      setIsSyncing(true);
      setFeedbackMessage(null);
      const [chatRes, groupRes] = await Promise.allSettled([
        api.syncEvolutionChats(),
        api.syncWhatsAppGroups(),
      ]);

      const chatCount = chatRes.status === 'fulfilled' && chatRes.value.success ? chatRes.value.count : 0;
      const groupCount = groupRes.status === 'fulfilled' && groupRes.value.success ? groupRes.value.count : 0;

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
          className={`p-4 rounded-xl text-xs flex items-center gap-2.5 transition-all animate-fadeIn ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : feedbackMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : feedbackMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          )}
          <span className="font-medium">{feedbackMessage.text}</span>
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
              onClick={onDisconnectClick}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50/40 text-rose-700 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all text-center"
            >
              <Unlink className="w-5 h-5 text-rose-500" />
              <span>Desconectar Aparelho</span>
              <span className="text-[10px] text-slate-400 font-normal">Encerrar sessão</span>
            </button>
          </div>
        </div>
      ) : (
        /* PAIRING / QR CODE STATE */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Instructions */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-2">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Conexão Rápida via QR Code</span>
                </span>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  Conecte seu WhatsApp ao Realizze CRM
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Siga os 3 passos simples abaixo no aplicativo do WhatsApp no celular da sua agência:
                </p>
              </div>

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
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Aguardando leitura do QR Code pelo celular...</span>
              </div>
            </div>

            {/* Right Column: QR Code Container */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              <div className="p-4 bg-white border-2 border-slate-900/10 rounded-2xl shadow-md flex flex-col items-center justify-center relative min-h-[280px] w-full max-w-[280px]">
                {isLoadingQr ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-6">
                    <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                    <p className="text-xs text-slate-600 font-medium text-center">
                      Gerando QR Code na Evolution API...
                    </p>
                  </div>
                ) : qrCodeImage ? (
                  <div className="space-y-3 flex flex-col items-center">
                    <img
                      src={qrCodeImage}
                      alt="WhatsApp QR Code"
                      className="w-56 h-56 object-contain rounded-lg shadow-xs"
                    />
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Instância: <strong>{instanceName}</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <Smartphone className="w-12 h-12 text-slate-300" />
                    <p className="text-xs text-slate-600">
                      Clique abaixo para carregar o QR Code de conexão.
                    </p>
                  </div>
                )}
              </div>

              {/* Action button below QR */}
              <button
                type="button"
                disabled={isLoadingQr}
                onClick={handleGenerateQr}
                className="mt-3.5 w-full max-w-[280px] py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQr ? 'animate-spin' : ''}`} />
                <span>{isLoadingQr ? 'Carregando...' : 'Atualizar QR Code'}</span>
              </button>
            </div>
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
    </div>
  );
};
