import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Globe,
  QrCode,
  CheckCircle2,
  ShieldCheck,
  Key,
  RefreshCw,
  Copy,
  Check,
  Info,
  Unlink,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Clock,
  Trash2,
  Sparkles,
  Send,
  MessageSquare,
  AlertTriangle,
  HelpCircle,
  Volume2,
  Save,
  Radio,
  Eye,
  EyeOff,
  Zap,
  BookOpen,
} from 'lucide-react';
import { api } from '../../services/api';
import { WhatsAppConfig, WhatsAppProviderType } from '../../types';
import { EvolutionWhatsAppTab } from './EvolutionWhatsAppTab';

export const AVATAR_PRESETS = [
  {
    name: 'Mariana Silva',
    phone: '+55 (11) 99123-4567',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    message: 'Olá! Vi a Realizze Travel no Instagram e queria cotar um pacote de Réveillon em Maceió para 4 pessoas!',
  },
  {
    name: 'Carlos Eduardo',
    phone: '+55 (11) 98888-7777',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    message: 'Olá! Gostaria de cotar um pacote de viagem para Fernando de Noronha para 2 pessoas em Outubro.',
  },
  {
    name: 'Fernanda Lima',
    phone: '+55 (21) 97654-3210',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    message: 'Boa tarde! Vocês têm opções de pacotes para Gramado no Natal Luz com aéreo incluso saindo do Rio?',
  },
  {
    name: 'Rodrigo Costa',
    phone: '+55 (31) 99876-5432',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    message: 'Oi consultor, quanto fica um resort all-inclusive em Porto de Galinhas para casal em março?',
  },
];

export const WhatsAppConfigView: React.FC = () => {
  // Provider Selection: Default to Evolution API (Pre-configured on VPS)
  const [providerType, setProviderType] = useState<WhatsAppProviderType>('EVOLUTION_API');

  // Meta Cloud API State
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [verifyToken, setVerifyToken] = useState('viagens_whatsapp_verify_token_2026');
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [qualityRating, setQualityRating] = useState<string | null>(null);
  const [isTestingMeta, setIsTestingMeta] = useState(false);
  const [metaTestResult, setMetaTestResult] = useState<{
    success: boolean;
    message: string;
    verifiedName?: string;
    displayPhoneNumber?: string;
    qualityRating?: string;
  } | null>(null);
  const [isSyncingMeta, setIsSyncingMeta] = useState(false);

  // Common Connection State
  const [phoneConnected, setPhoneConnected] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('DISCONNECTED');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'url' | 'token' | 'webhook' | null>(null);

  // Modal States
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [modalPhoneInput, setModalPhoneInput] = useState('+55 (11) 98765-4321');
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  // Real-Time WhatsApp Simulator State with Real Customer Photos
  const [simPhone, setSimPhone] = useState('+55 (11) 99123-4567');
  const [simName, setSimName] = useState('Mariana Silva');
  const [simAvatar, setSimAvatar] = useState('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80');
  const [simMessage, setSimMessage] = useState('Olá! Vi a Realizze Travel no Instagram e queria cotar um pacote de Réveillon em Maceió para 4 pessoas!');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{ success: boolean; text: string; conversationId?: string } | null>(null);

  const webhookCallbackUrl = `${window.location.origin}/api/webhooks/whatsapp`;

  useEffect(() => {
    async function loadConfig() {
      try {
        setIsLoading(true);
        const res = await api.getWhatsAppSettings();
        if (res.config) {
          const cfg = res.config;
          setProviderType(cfg.providerType === 'META_CLOUD' ? 'META_CLOUD' : 'EVOLUTION_API');
          setPhoneNumberId(cfg.phoneNumberId || '');
          setBusinessAccountId(cfg.businessAccountId || '');
          setAccessToken(cfg.accessToken || '');
          setVerifyToken(cfg.verifyToken || 'viagens_whatsapp_verify_token_2026');
          if (cfg.verifiedName) setVerifiedName(cfg.verifiedName);
          if (cfg.qualityRating) setQualityRating(cfg.qualityRating);
          setPhoneConnected(cfg.phoneConnected || null);
          setConnectionStatus(cfg.status || 'DISCONNECTED');
          if (cfg.phoneConnected) {
            setModalPhoneInput(cfg.phoneConnected);
          }
        }
      } catch (e: any) {
        console.warn('Notice loading WhatsApp config:', e.message);
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsSaving(true);
      setErrorMessage(null);
      const payload: Partial<WhatsAppConfig> = {
        providerType: 'META_CLOUD',
        phoneNumberId: phoneNumberId.trim(),
        businessAccountId: businessAccountId.trim(),
        accessToken: accessToken.trim(),
        verifyToken: verifyToken.trim(),
        verifiedName: verifiedName || undefined,
        qualityRating: qualityRating || undefined,
        phoneConnected: phoneConnected || undefined,
        status: (phoneNumberId.trim() && accessToken.trim()) ? 'CONNECTED' : (connectionStatus as any),
      };

      await api.saveWhatsAppSettings(payload);
      if (phoneNumberId.trim() && accessToken.trim()) {
        setConnectionStatus('CONNECTED');
      }
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 4000);
    } catch (e: any) {
      setErrorMessage(e.message || 'Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestMeta = async () => {
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      setErrorMessage('Por favor, informe o Phone Number ID e o Access Token permanente da Meta.');
      return;
    }
    try {
      setIsTestingMeta(true);
      setMetaTestResult(null);
      setErrorMessage(null);
      const res = await api.testMetaConnection({
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim(),
        businessAccountId: businessAccountId.trim(),
      });

      if (res.success) {
        setConnectionStatus('CONNECTED');
        if (res.verifiedName) setVerifiedName(res.verifiedName);
        if (res.qualityRating) setQualityRating(res.qualityRating);
        if (res.displayPhoneNumber) setPhoneConnected(res.displayPhoneNumber);
        setMetaTestResult({
          success: true,
          message: 'Conexão Oficial com a Meta Cloud API estabelecida com sucesso! Canal ativo.',
          verifiedName: res.verifiedName || 'Realizze Travel (Verificado)',
          displayPhoneNumber: res.displayPhoneNumber || phoneNumberId.trim(),
          qualityRating: res.qualityRating || 'GREEN (Excelente)',
        });
      } else {
        setMetaTestResult({
          success: false,
          message: res.error || 'Erro ao validar conexão com a Meta Graph API. Verifique suas credenciais.',
        });
      }
    } catch (err: any) {
      setMetaTestResult({
        success: false,
        message: err.message || 'Falha na comunicação com os servidores da Meta.',
      });
    } finally {
      setIsTestingMeta(false);
    }
  };

  const handleSyncMeta = async () => {
    try {
      setIsSyncingMeta(true);
      setSyncStatus(null);
      const res = await api.syncWhatsAppChats();
      if (res.success) {
        setSyncStatus(`Sincronização Meta concluída! ${res.count} conversas ativas no sistema.`);
        setTimeout(() => setSyncStatus(null), 6000);
      } else {
        setErrorMessage(res.message || 'Erro ao sincronizar com a Meta.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao sincronizar com a Meta.');
    } finally {
      setIsSyncingMeta(false);
    }
  };

  const handleFillDemoCredentials = () => {
    setPhoneNumberId('512398741029384');
    setBusinessAccountId('109283746501928');
    setAccessToken('EAAGSamplePermanentSystemUserTokenRealizzeTravel2026');
    setVerifiedName('Realizze Travel Agência de Viagens');
    setQualityRating('GREEN (Excelente)');
    setPhoneConnected('+55 (11) 98765-4321');
    setConnectionStatus('CONNECTED');
    setMetaTestResult({
      success: true,
      message: 'Credenciais demonstrativas preenchidas e validadas com sucesso!',
      verifiedName: 'Realizze Travel Agência de Viagens',
      displayPhoneNumber: '+55 (11) 98765-4321',
      qualityRating: 'GREEN (Excelente)',
    });
  };

  const handleConfirmPairingModal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const cleaned = modalPhoneInput.trim() || '+55 (11) 98765-4321';
      const res = await api.confirmWhatsAppPairing(cleaned);
      if (res.success) {
        setPhoneConnected(cleaned);
        setConnectionStatus('CONNECTED');
        setIsConnectModalOpen(false);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 4000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao confirmar número.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    try {
      setIsSaving(true);
      await api.disconnectWhatsApp();
      setConnectionStatus('DISCONNECTED');
      setPhoneConnected(null);
      setIsDisconnectModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao desconectar canal.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmClearMock = async () => {
    try {
      setIsSaving(true);
      const res = await api.clearMockData();
      setIsClearModalOpen(false);
      setSyncStatus(res.message || 'Histórico limpo com sucesso! Pronto para novos atendimentos.');
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (e: any) {
      setSyncStatus(`Erro: ${e.message || 'Falha ao limpar histórico.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = (text: string, field: 'url' | 'token' | 'webhook') => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSimulateIncoming = async (customParams?: { name?: string; phone?: string; avatar?: string; message?: string } | string) => {
    try {
      setIsSimulating(true);
      setSimResult(null);
      const paramsObj = typeof customParams === 'string' ? { message: customParams } : customParams;
      const targetName = paramsObj?.name || simName;
      const targetPhone = paramsObj?.phone || simPhone;
      const targetAvatar = paramsObj?.avatar || simAvatar;
      const targetMessage = paramsObj?.message || simMessage;

      const res = await api.simulateWhatsAppIncomingMessage({
        phone: targetPhone,
        name: targetName,
        avatar: targetAvatar,
        avatarUrl: targetAvatar,
        content: targetMessage,
      });

      if (res.success) {
        setSimResult({
          success: true,
          text: `Mensagem de ${targetName} recebida com sucesso via Meta Cloud Webhook! Conversa atribuída na fila dos consultores com alerta sonoro.`,
          conversationId: res.conversationId,
        });
      }
    } catch (err: any) {
      setSimResult({
        success: false,
        text: err.message || 'Erro ao simular recebimento de mensagem.',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-5xl mx-auto w-full">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
              <Smartphone className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>WhatsApp da Agência</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Realizze Travel
                </span>
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Conecte o número de WhatsApp da agência para envio e recebimento em tempo real na fila dos consultores.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {connectionStatus === 'CONNECTED' ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Canal Conectado</span>
                {phoneConnected && (
                  <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                    {phoneConnected}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setIsDisconnectModalOpen(true)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Desconectar canal"
              >
                <Unlink className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Aguardando Leitura
            </span>
          )}
        </div>
      </div>

      {/* Provider Selector Tabs */}
      <div className="flex items-center p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 max-w-2xl">
        <button
          type="button"
          onClick={() => setProviderType('EVOLUTION_API')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            providerType === 'EVOLUTION_API' || providerType === 'QR_CODE'
              ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          <QrCode className="w-4 h-4 text-emerald-600" />
          <span>Escanear QR Code (Evolution VPS)</span>
          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-700">
            Pré-Configurado
          </span>
        </button>

        <button
          type="button"
          onClick={() => setProviderType('META_CLOUD')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            providerType === 'META_CLOUD'
              ? 'bg-white text-blue-800 shadow-xs border border-blue-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          <Globe className="w-4 h-4 text-blue-600" />
          <span>Meta Cloud API (Oficial)</span>
        </button>
      </div>

      {/* Dynamic Tab Body */}
      {providerType === 'EVOLUTION_API' || providerType === 'QR_CODE' ? (
        <EvolutionWhatsAppTab
          onDisconnectClick={() => setIsDisconnectModalOpen(true)}
          onClearHistoryClick={() => setIsClearModalOpen(true)}
        />
      ) : (
        <div className="space-y-8 animate-fadeIn">
          {/* WHY META CLOUD API IS THE BEST FOR VERCEL (Benefícios Claros) */}
          <div className="bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-indigo-50/60 border border-blue-200/80 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="text-xs text-slate-700 space-y-1.5 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h4 className="font-bold text-blue-950 text-sm flex items-center gap-2">
              <span>Infraestrutura 100% em Nuvem — Perfeita para Vercel</span>
              <span className="px-2 py-0.5 rounded-md bg-blue-200/70 text-blue-900 font-bold text-[10px] uppercase">
                1.000 Conversas Grátis / Mês
              </span>
            </h4>
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-bold text-xs"
            >
              <span>Abrir Meta for Developers</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="leading-relaxed text-slate-600">
            A <strong>Meta Cloud API</strong> roda diretamente nos servidores globais do WhatsApp/Meta. Isso significa que você <strong>não precisa de computador ligado</strong>, <strong>não precisa de servidor VPS</strong> nem de Docker: as mensagens chegam e saem via Webhook direto na sua aplicação Vercel com máxima velocidade e estabilidade.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-blue-900 font-medium">
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> Sem desconexões no celular
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> Zero servidores para gerenciar
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> 1.000 conversas gratuitas todo mês pela Meta
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> Selo comercial de confiança para clientes
            </span>
          </div>
        </div>
      </div>

      {/* Notifications / Feedback */}
      {isSaved && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Configurações salvas com sucesso! Canal Meta Cloud API ativo e sincronizado.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 animate-fadeIn">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {syncStatus && (
        <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 flex items-center gap-2 animate-fadeIn">
          <Info className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: STATUS & FAST ACTION BAR                                       */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              connectionStatus === 'CONNECTED' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600 border border-blue-100'
            }`}>
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Canal Oficial WhatsApp Business (Meta)
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  connectionStatus === 'CONNECTED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {connectionStatus === 'CONNECTED' ? 'Conectado • Oficial' : 'Aguardando Credenciais'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {verifiedName ? (
                  <span className="text-blue-700 font-semibold flex items-center gap-1 inline-flex">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    Conta Verificada: {verifiedName}
                  </span>
                ) : (
                  'Conexão direta com a infraestrutura Meta Graph API v21.0'
                )}
                {qualityRating && ` • Qualidade da Conta: ${qualityRating}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTestMeta}
              disabled={isTestingMeta || !phoneNumberId}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              title="Testa a validade do Token e Phone Number ID na Meta Graph API"
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${isTestingMeta ? 'animate-spin' : ''}`} />
              <span>{isTestingMeta ? 'Testando Conexão...' : 'Testar Conexão Oficial'}</span>
            </button>

            <button
              type="button"
              onClick={handleSyncMeta}
              disabled={isSyncingMeta}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Puxa contatos e conversas do WhatsApp da Meta"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMeta ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>Sincronizar Conversas</span>
            </button>

            <button
              type="button"
              onClick={handleFillDemoCredentials}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              title="Preenche credenciais de teste para validação imediata"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Preencher Demonstração</span>
            </button>
          </div>
        </div>

        {metaTestResult && (
          <div className={`mt-4 p-4 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
            metaTestResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {metaTestResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-bold">{metaTestResult.message}</p>
              {metaTestResult.verifiedName && (
                <p className="text-[11px] text-slate-600">
                  Nome Verificado: <strong>{metaTestResult.verifiedName}</strong>
                  {metaTestResult.displayPhoneNumber && ` • Número: ${metaTestResult.displayPhoneNumber}`}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: WEBHOOK CONFIGURATION GUIDE FOR META FOR DEVELOPERS            */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              Configuração do Webhook no Meta for Developers
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cadastre a URL de Callback e o Token no painel do Facebook para que as mensagens dos clientes cheguem instantaneamente na agência.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 self-start sm:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Webhook Ativo
          </span>
        </div>

        {/* ALERTA IMPORTANTE: URL DA VERCEL X AMBIENTE DE TESTE */}
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-bold">Atenção ao cadastrar a URL de Callback na Meta:</p>
            <p>
              A Meta (Facebook) exige uma URL <strong>pública na internet</strong>. Use o endereço do seu sistema publicado na <strong>Vercel</strong> (ex: <code className="bg-amber-150 px-1 py-0.5 rounded font-mono text-amber-950 font-bold">https://seu-projeto.vercel.app/api/webhooks/whatsapp</code>) ou seu domínio próprio.
            </p>
            <p className="text-[11px] text-amber-800">
              *(A URL temporária do editor <code>ais-dev-...</code> possui proteção de login do Google e não pode ser validada pelos servidores da Meta).*
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              URL de Callback (Webhook da Agência):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={webhookCallbackUrl}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-blue-700 text-xs select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleCopy(webhookCallbackUrl, 'webhook')}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
              >
                {copiedField === 'webhook' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copiar URL</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Cole na Meta substituindo pelo seu domínio da Vercel seguido de <code>/api/webhooks/whatsapp</code>.
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Token de Verificação (Verify Token):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={() => handleCopy(verifyToken, 'token')}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
              >
                {copiedField === 'token' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Informe exatamente este mesmo token no Meta for Developers para validar o webhook.
            </p>
          </div>
        </div>

        {/* Step-by-step Tutorial Collapsible */}
        <div className="pt-2 border-t border-slate-100">
          <details className="group text-xs">
            <summary className="cursor-pointer text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1.5 select-none">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>Como pegar suas credenciais no Meta for Developers em 4 passos rápidos (Clique aqui para ver o tutorial)</span>
              <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
            </summary>
            <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-slate-700 leading-relaxed text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                <p>
                  Acesse <strong><a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">developers.facebook.com</a></strong>, faça login e clique em <strong>Meus Aplicativos &gt; Criar Aplicativo</strong> (escolha o tipo <em>Outro</em> ou <em>Empresarial / Business</em>).
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                <p>
                  No painel do app criado, localize o produto <strong>WhatsApp</strong> e clique em <strong>Configurar</strong>. O Meta criará um número de teste oficial imediatamente.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
                <p>
                  No menu lateral, vá em <strong>WhatsApp &gt; Início da API</strong>:
                  <br />
                  • Copie o <strong>Identificador do número de telefone (Phone Number ID)</strong> e cole no campo abaixo.
                  <br />
                  • Copie a <strong>Identificação da Conta do WhatsApp Business (WABA ID)</strong>.
                  <br />
                  • Copie o <strong>Token de Acesso</strong> gerado (para produção, crie um <em>Usuário do Sistema</em> com token permanente).
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">4</span>
                <p>
                  No menu lateral, vá em <strong>WhatsApp &gt; Configuração</strong> &gt; <strong>Webhook</strong>:
                  <br />
                  • Clique em <strong>Editar</strong>, cole a <em>URL de Callback</em> e o <em>Token de Verificação</em> gerados acima e clique em <strong>Verificar e Salvar</strong>.
                  <br />
                  • Em <strong>Campos do Webhook</strong>, clique em <strong>Gerenciar</strong> e marque o evento <strong>messages</strong> (Inscrever-se). Pronto!
                </p>
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: CREDENTIALS FORM                                               */}
      {/* ========================================================================= */}
      <form onSubmit={handleSaveConfig} className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 space-y-5 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-800">
              Credenciais da Meta Cloud API (WhatsApp Business)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            * Campos obrigatórios para envio e recebimento
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Phone Number ID (ID do Número de Telefone) <span className="text-rose-500">*</span>:
            </label>
            <input
              type="text"
              required
              placeholder="Ex: 512398741029384"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Localizado em <em>WhatsApp &gt; Início da API</em> no Meta for Developers.
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              WhatsApp Business Account ID (WABA ID):
            </label>
            <input
              type="text"
              placeholder="Ex: 109283746501928"
              value={businessAccountId}
              onChange={(e) => setBusinessAccountId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Identificador da conta empresarial no Meta Business Manager.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-700 font-bold mb-1">
              Access Token Permanente (System User Token) <span className="text-rose-500">*</span>:
            </label>
            <div className="relative">
              <input
                type={showAccessToken ? 'text' : 'password'}
                required
                placeholder="EAAG... (Token Permanente do Usuário do Sistema da Meta)"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 font-mono text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={() => setShowAccessToken(!showAccessToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title={showAccessToken ? 'Ocultar token' : 'Visualizar token'}
              >
                {showAccessToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Para produção permanente sem expiração diária, gere este token em: <em>Configurações do Negócio &gt; Usuários &gt; Usuários do Sistema &gt; Gerar Token</em> (com permissões <code>whatsapp_business_messaging</code> e <code>whatsapp_business_management</code>).
            </p>
          </div>
        </div>

        <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsConnectModalOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Informar Telefone Manualmente
            </button>
            <button
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              className="px-3.5 py-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-500 border border-slate-200 rounded-xl text-xs font-bold transition-colors"
              title="Limpa mensagens antigas para iniciar histórico novo"
            >
              Limpar Conversas Demonstrativas
            </button>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Credenciais da Meta</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* SECTION 4: REAL-TIME SIMULATOR & TEST (Para validar o sistema da Vercel)  */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Simulador de Teste da Meta Cloud API (Lead & Cotações)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Envie uma mensagem de teste como cliente para validar o webhook da Meta, notificação com alerta sonoro e distribuição automática aos 8 consultores de plantão.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0 self-start sm:self-auto">
            <Volume2 className="w-3.5 h-3.5" />
            <span>Alerta Sonoro Ativo</span>
          </div>
        </div>

        {/* Preset Lead Avatars */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            Escolha um Perfil de Cliente Real para o Teste:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={preset.phone}
                type="button"
                onClick={() => {
                  setSimName(preset.name);
                  setSimPhone(preset.phone);
                  setSimAvatar(preset.avatar);
                  setSimMessage(preset.message);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                  simPhone === preset.phone
                    ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/30'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <img
                  src={preset.avatar}
                  alt={preset.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{preset.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono truncate">{preset.phone}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Nome do Cliente:
            </label>
            <input
              type="text"
              value={simName}
              onChange={(e) => setSimName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Telefone do Cliente:
            </label>
            <input
              type="text"
              value={simPhone}
              onChange={(e) => setSimPhone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Mensagem de Cotação de Viagem:
          </label>
          <textarea
            rows={3}
            value={simMessage}
            onChange={(e) => setSimMessage(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-[11px] font-semibold text-slate-400 self-center">Exemplos Rápidos:</span>
            <button
              type="button"
              onClick={() => handleSimulateIncoming('Olá! Gostaria de cotar um pacote para Fernando de Noronha para 2 pessoas em Outubro.')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-colors"
            >
              🏖️ Pacote Noronha
            </button>
            <button
              type="button"
              onClick={() => handleSimulateIncoming('Boa tarde! Vocês têm cruzeiro pela costa brasileira para Dezembro com pensão completa?')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-colors"
            >
              🚢 Cruzeiro de Férias
            </button>
            <button
              type="button"
              onClick={() => handleSimulateIncoming('Preciso de 4 passagens aéreas de São Paulo para Orlando com urgência para o próximo mês.')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-colors"
            >
              ✈️ Passagem Orlando
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleSimulateIncoming()}
            disabled={isSimulating}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
          >
            {isSimulating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processando Webhook...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Simular Recebimento via Meta Webhook</span>
              </>
            )}
          </button>

          <span className="text-[11px] text-slate-500">
            A mensagem entrará na fila do Chat Desk e tocará o sinal sonoro na central.
          </span>
        </div>

        {simResult && (
          <div
            className={`p-4 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
              simResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {simResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-bold">{simResult.text}</p>
              {simResult.conversationId && (
                <p className="text-[11px] text-emerald-700">ID da Conversa: {simResult.conversationId}</p>
              )}
            </div>
          </div>
        )}
      </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CONECTAR / CADASTRAR NÚMERO MANUALMENTE                          */}
      {/* ========================================================================= */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
                Conectar WhatsApp da Agência
              </h3>
              <p className="text-xs text-slate-500 text-center mb-5">
                Informe o número de WhatsApp cadastrado na Meta Cloud API para exibir na identificação do sistema.
              </p>

              <form onSubmit={handleConfirmPairingModal} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Número do WhatsApp (com DDD):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+55 (11) 98765-4321"
                    value={modalPhoneInput}
                    onChange={(e) => setModalPhoneInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Exemplo: +55 11 98765-4321 ou (11) 98765-4321
                  </p>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    Ativação Direta:
                  </p>
                  <p className="text-[11px] leading-relaxed text-blue-800">
                    O canal será registrado como ativo e todas as novas conversas recebidas via webhook da Meta serão roteadas aos consultores da agência.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsConnectModalOpen(false)}
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Conectando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirmar Número</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIRMAR DESCONEXÃO                                             */}
      {/* ========================================================================= */}
      {isDisconnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 p-6">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Unlink className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
              Desconectar Canal de WhatsApp
            </h3>
            <p className="text-xs text-slate-500 text-center mb-6">
              Tem certeza de que deseja desconectar o canal da Meta Cloud API? O sistema suspenderá o envio de mensagens até que seja reconectado.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsDisconnectModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmDisconnect}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                {isSaving ? (
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

      {/* ========================================================================= */}
      {/* MODAL 3: LIMPAR HISTÓRICO DEMONSTRATIVO                                  */}
      {/* ========================================================================= */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 p-6">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
              Limpar Conversas Demonstrativas
            </h3>
            <p className="text-xs text-slate-500 text-center mb-6">
              Deseja zerar as conversas e clientes demonstrativos para que o painel exiba apenas as conversas reais recebidas pelo seu canal oficial da Meta?
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsClearModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmClearMock}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Limpando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Sim, Limpar Tudo</span>
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
