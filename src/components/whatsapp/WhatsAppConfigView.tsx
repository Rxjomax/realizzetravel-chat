import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  QrCode,
  Globe,
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
  X,
  PhoneCall,
  Volume2,
  Save,
} from 'lucide-react';
import { api } from '../../services/api';
import { WhatsAppConfig, WhatsAppProviderType } from '../../types';

export const WhatsAppConfigView: React.FC = () => {
  // Provider Selection: Z-API (Recomendado) vs Conexão Direta / Gateway QR Code vs Meta Cloud API (Official)
  const [providerType, setProviderType] = useState<WhatsAppProviderType>('Z_API');

  // Z-API State
  const [zapiInstanceId, setZapiInstanceId] = useState('3F8C20C51BB1E161A1A3260BF05B3023');
  const [zapiToken, setZapiToken] = useState('90FDB82A1D2E2343E9AEA9EA');
  const [zapiClientToken, setZapiClientToken] = useState('');

  // QR Code Gateway State
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState('realizze-travel');
  const [gatewayUrl, setGatewayUrl] = useState('');
  const [gatewayApiKey, setGatewayApiKey] = useState('');
  const [phoneConnected, setPhoneConnected] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [pairingCountdown, setPairingCountdown] = useState<number>(45);

  // Meta Cloud API State
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('viagens_whatsapp_verify_token_2026');

  // Common State
  const [connectionStatus, setConnectionStatus] = useState<string>('DISCONNECTED');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'url' | 'token' | 'webhook' | null>(null);

  // Modal States (Replacing all window.prompt and window.confirm for iframe stability)
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [modalPhoneInput, setModalPhoneInput] = useState('+55 (11) 98765-4321');
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  // Real-Time WhatsApp Simulator State
  const [simPhone, setSimPhone] = useState('+55 (11) 99887-6655');
  const [simName, setSimName] = useState('Carlos Eduardo (Cliente)');
  const [simMessage, setSimMessage] = useState('Olá! Gostaria de cotar um pacote de viagem para Fernando de Noronha para 2 pessoas em Outubro.');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{ success: boolean; text: string; conversationId?: string } | null>(null);

  const webhookCallbackUrl = `${window.location.origin}/webhooks/whatsapp`;

  useEffect(() => {
    async function loadConfig() {
      try {
        setIsLoading(true);
        const res = await api.getWhatsAppSettings();
        if (res.config) {
          const cfg = res.config;
          if (cfg.providerType) {
            setProviderType(cfg.providerType);
          }
          if (cfg.zapiInstanceId) setZapiInstanceId(cfg.zapiInstanceId);
          if (cfg.zapiToken) setZapiToken(cfg.zapiToken);
          if (cfg.zapiClientToken) setZapiClientToken(cfg.zapiClientToken);
          setPhoneNumberId(cfg.phoneNumberId || '');
          setBusinessAccountId(cfg.businessAccountId || '');
          setAccessToken(cfg.accessToken || '');
          setVerifyToken(cfg.verifyToken || 'viagens_whatsapp_verify_token_2026');
          setInstanceName(cfg.instanceName || 'realizze-travel');
          setGatewayUrl(cfg.gatewayUrl || '');
          setGatewayApiKey(cfg.apiKey || '');
          setPhoneConnected(cfg.phoneConnected || null);
          setQrCodeData(cfg.qrCodeBase64 || null);
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

  // Timer for QR Refresh
  useEffect(() => {
    if (qrCodeData && connectionStatus !== 'CONNECTED') {
      const interval = setInterval(() => {
        setPairingCountdown((prev) => {
          if (prev <= 1) return 45;
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [qrCodeData, connectionStatus]);

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsSaving(true);
      setErrorMessage(null);
      const payload: Partial<WhatsAppConfig> = {
        providerType,
        phoneNumberId,
        businessAccountId,
        accessToken,
        verifyToken,
        instanceName,
        gatewayUrl,
        apiKey: gatewayApiKey,
        zapiInstanceId,
        zapiToken,
        zapiClientToken,
        status: connectionStatus as any,
      };

      await api.saveWhatsAppSettings(payload);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 4000);
    } catch (e: any) {
      setErrorMessage(e.message || 'Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateQr = async () => {
    try {
      setIsGeneratingQr(true);
      setErrorMessage(null);
      setConnectionStatus('QR_READY');
      const res = await api.generateWhatsAppQr({
        gatewayUrl,
        instanceName,
        apiKey: gatewayApiKey,
        zapiInstanceId,
        zapiToken,
        zapiClientToken,
      });

      if (res.qrCode) {
        setQrCodeData(res.qrCode);
        setPairingCountdown(45);
        if (res.status === 'CONNECTED') {
          setConnectionStatus('CONNECTED');
        } else {
          setConnectionStatus('QR_READY');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao gerar QR Code.');
    } finally {
      setIsGeneratingQr(false);
    }
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
        setQrCodeData(null);
        setIsConnectModalOpen(false);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 4000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao confirmar pareamento.');
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
      setQrCodeData(null);
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
      setTestStatus(res.message || 'Histórico limpo com sucesso! Pronto para receber atendimentos.');
      setTimeout(() => setTestStatus(null), 5000);
    } catch (e: any) {
      setTestStatus(`Erro: ${e.message || 'Falha ao limpar histórico.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = (text: string, field: 'url' | 'token' | 'webhook') => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSimulateIncoming = async (presetContent?: string) => {
    try {
      setIsSimulating(true);
      setSimResult(null);
      const content = presetContent || simMessage;
      const res = await api.simulateWhatsAppIncomingMessage({
        phone: simPhone,
        name: simName,
        content,
      });

      if (res.success) {
        setSimResult({
          success: true,
          text: `Mensagem disparada com sucesso! A conversa já entrou na fila da agência com notificação em tempo real.`,
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
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Smartphone className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Canais de Conexão do WhatsApp
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Conecte o número de atendimento da <strong>RealizzeTravel</strong> para receber mensagens e gerenciar conversas com a equipe de consultores.
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
              Desconectado
            </span>
          )}
        </div>
      </div>

      {/* CLARIFICATION ALERT: Por que a leitura direta pelo celular pode falhar */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
          <HelpCircle className="w-5 h-5" />
        </div>
        <div className="text-xs text-amber-900 space-y-1.5 flex-1">
          <h4 className="font-bold text-amber-950 text-sm">
            Entenda como funciona a conexão com o WhatsApp do seu celular:
          </h4>
          <p className="leading-relaxed text-amber-800">
            O recurso <em>"Aparelhos Conectados"</em> do aplicativo oficial do WhatsApp exige uma <strong>sessão criptográfica WebSocket em tempo real</strong> (como a fornecida pela <strong>Meta Cloud API Oficial</strong> ou por um servidor dedicado de gateway como <strong>Evolution API / Z-API</strong>).
          </p>
          <p className="leading-relaxed text-amber-800">
            Se você está testando o sistema da agência agora, você pode <strong>conectar seu número com 1 clique</strong> no botão verde abaixo ou usar o <strong>Simulador de Mensagens em Tempo Real</strong> para enviar cotações e ver todos os 8 consultores recebendo notificações sonoras imediatamente!
          </p>
        </div>
      </div>

      {/* Tabs: Choose Integration Method */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Option 1: Z-API Card Tab (Recommended) */}
        <button
          type="button"
          onClick={() => setProviderType('Z_API')}
          className={`relative p-5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
            providerType === 'Z_API'
              ? 'border-indigo-500 bg-indigo-50/25 shadow-sm ring-2 ring-indigo-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    providerType === 'Z_API'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Opção 1: Z-API (Gateway Oficial)
                  </h3>
                  <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
                    Conectado / Ativo na Agência
                  </span>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  providerType === 'Z_API'
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-300'
                }`}
              >
                {providerType === 'Z_API' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Integração via Instância Z-API configurada com Webhook para receber e enviar mensagens instantaneamente.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center gap-2 text-[11px] text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>Instância e Token Ativos • Webhooks em Tempo Real</span>
          </div>
        </button>

        {/* Option 2: QR Code Card Tab */}
        <button
          type="button"
          onClick={() => setProviderType('QR_CODE')}
          className={`relative p-5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
            providerType === 'QR_CODE'
              ? 'border-emerald-500 bg-emerald-50/20 shadow-sm ring-2 ring-emerald-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    providerType === 'QR_CODE'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Opção 2: Conexão Direta / QR Code
                  </h3>
                  <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                    Pareamento local
                  </span>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  providerType === 'QR_CODE'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300'
                }`}
              >
                {providerType === 'QR_CODE' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Permite pareamento direto do número da sua agência ou integração com servidores Evolution API.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center gap-2 text-[11px] text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Sem custo por mensagem • Ativação rápida</span>
          </div>
        </button>

        {/* Option 3: Meta Cloud API Card Tab */}
        <button
          type="button"
          onClick={() => setProviderType('META_CLOUD')}
          className={`relative p-5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
            providerType === 'META_CLOUD'
              ? 'border-blue-500 bg-blue-50/20 shadow-sm ring-2 ring-blue-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    providerType === 'META_CLOUD'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Opção 3: Meta Cloud API Oficial
                  </h3>
                  <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
                    Infraestrutura Facebook
                  </span>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  providerType === 'META_CLOUD'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300'
                }`}
              >
                {providerType === 'META_CLOUD' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Conexão via Token e Phone Number ID cadastrados no portal <strong>Meta Developers</strong>.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>Criptografia direta Meta • Selo verificado</span>
          </div>
        </button>
      </div>

      {/* Notifications / Feedback */}
      {isSaved && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Configurações do WhatsApp salvas com sucesso! Canal sincronizado com a central de atendimento.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 animate-fadeIn">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 0: Z-API VIEW (When Z_API is selected - DEFAULT & RECOMMENDED)     */}
      {/* ========================================================================= */}
      {providerType === 'Z_API' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Webhook Info Card for Z-API */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-600" />
                Configuração do Webhook no Z-API
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Webhook Ativo
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              No seu painel do <strong>Z-API (z-api.io)</strong>, abra a sua instância e em <strong>Webhooks</strong>, cadastre a URL abaixo no evento <em>"Ao receber mensagem"</em> e <em>"Ao conectar / desconectar"</em>:
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">URL de Callback (Webhook RealizzeTravel)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/api/webhooks/zapi`}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-indigo-600 text-xs select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(`${window.location.origin}/api/webhooks/zapi`, 'webhook')}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
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
              </div>
            </div>
          </div>

          {/* Z-API Credentials Card */}
          <form onSubmit={handleSaveConfig} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-600" />
                  Credenciais da Instância Z-API
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conecte a instância Z-API da sua agência para envio e recebimento em tempo real.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateQr}
                  disabled={isGeneratingQr}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingQr ? 'animate-spin' : ''}`} />
                  <span>Verificar Status / QR Code</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  ID da Instância (Instance ID) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: 3F8C20C51BB1E161A1A3260BF05B3023"
                  value={zapiInstanceId}
                  onChange={(e) => setZapiInstanceId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Token da Instância <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: 90FDB82A1D2E2343E9AEA9EA"
                  value={zapiToken}
                  onChange={(e) => setZapiToken(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">
                  Client-Token (Opcional - caso ativado na sua conta Z-API)
                </label>
                <input
                  type="text"
                  placeholder="Deixe em branco se a sua conta não exigir Client-Token"
                  value={zapiClientToken}
                  onChange={(e) => setZapiClientToken(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* QR Code display if available */}
            {qrCodeData && connectionStatus !== 'CONNECTED' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center gap-4">
                <img
                  src={qrCodeData}
                  alt="QR Code Z-API"
                  className="w-40 h-40 bg-white p-2 rounded-lg border border-slate-200 object-contain shadow-xs shrink-0"
                />
                <div className="space-y-2 text-xs text-slate-600">
                  <h4 className="font-bold text-slate-900 text-sm">Aponte o WhatsApp do seu celular</h4>
                  <p>Abra o WhatsApp no celular &gt; Menu ou Configurações &gt; <strong>Aparelhos Conectados</strong> &gt; <strong>Conectar um aparelho</strong>.</p>
                  <p className="text-slate-500">Expira em: <span className="font-mono font-bold text-indigo-600">{pairingCountdown}s</span></p>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(true)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Informar Telefone Conectado
                </button>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar Credenciais Z-API</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Simulator & Live Test */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    Testar Recepção de Mensagens (Webhook Z-API)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Envie uma mensagem de teste como cliente para validar o fluxo do webhook Z-API, som das notificações e distribuição aos 8 consultores da agência.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 shrink-0">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Alerta Sonoro Ativo</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Nome do Cliente Teste:
                </label>
                <input
                  type="text"
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo (Cliente)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Número de Telefone do Cliente:
                </label>
                <input
                  type="text"
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  placeholder="Ex: +55 (11) 99887-6655"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mensagem Enviada pelo Cliente:
              </label>
              <textarea
                rows={3}
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-[11px] font-semibold text-slate-400 self-center">Testes Rápidos:</span>
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
                disabled={isSimulating || !simMessage.trim()}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Disparando Mensagem...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Disparar Mensagem pelo Z-API</span>
                  </>
                )}
              </button>

              {simResult && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  simResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {simResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{simResult.text}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: QR CODE VIEW (When QR_CODE is selected)                       */}
      {/* ========================================================================= */}
      {providerType === 'QR_CODE' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main Pairing Stage */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 shadow-2xs">
            <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start justify-between">
              {/* Instructions on the Left */}
              <div className="space-y-4 max-w-lg">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Conexão rápida em 2 etapas</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Como conectar o número da agência agora:
                </h3>

                <div className="space-y-3 text-xs text-slate-600">
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                    <p className="font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center">1</span>
                      Ativação Instantânea do Número:
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      Clique no botão verde ao lado para <strong>informar o número de WhatsApp</strong> (seu celular ou o telefone da agência). O canal será ativado imediatamente no painel!
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                    <p className="font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center">2</span>
                      Testar Envio e Recebimento Imediato:
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      Use a ferramenta de <strong>Simulação em Tempo Real</strong> logo abaixo para enviar uma mensagem de teste como cliente e ver a notificação tocando para todos os 8 consultores!
                    </p>
                  </div>
                </div>

                {/* Gateway config toggle / custom backend settings */}
                <div className="pt-2">
                  <details className="group text-xs">
                    <summary className="cursor-pointer text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1.5 select-none">
                      <span>Possui um servidor Evolution API ou Z-API próprio? Configurar aqui</span>
                      <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
                    </summary>
                    <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">
                          URL do Servidor Gateway (Ex: https://api.meuevolution.com.br)
                        </label>
                        <input
                          type="text"
                          placeholder="https://meu-evolution-api.meudominio.com"
                          value={gatewayUrl}
                          onChange={(e) => setGatewayUrl(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-700 font-semibold mb-1">Nome da Instância</label>
                          <input
                            type="text"
                            value={instanceName}
                            onChange={(e) => setInstanceName(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-semibold mb-1">API Key / Token</label>
                          <input
                            type="password"
                            placeholder="Chave secreta da API"
                            value={gatewayApiKey}
                            onChange={(e) => setGatewayApiKey(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveConfig()}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs"
                      >
                        Salvar Endpoints do Gateway
                      </button>
                    </div>
                  </details>
                </div>
              </div>

              {/* QR Code / Connection Box on the Right */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-2xl w-full max-w-sm shrink-0">
                {connectionStatus === 'CONNECTED' ? (
                  <div className="text-center py-4 space-y-3 w-full">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                      <CheckCircle2 className="w-9 h-9" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900">WhatsApp Conectado</h4>
                      <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                        Canal ativo e sincronizado com os consultores
                      </p>
                      {phoneConnected && (
                        <p className="text-xs text-slate-700 font-mono font-bold mt-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 inline-block shadow-2xs">
                          {phoneConnected}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 flex flex-col gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => setIsConnectModalOpen(true)}
                        className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        <span>Alterar Número Conectado</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDisconnectModalOpen(true)}
                        className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold text-rose-700 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Unlink className="w-3.5 h-3.5 text-rose-600" />
                        <span>Desconectar Canal</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4 w-full">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                      <Smartphone className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Conectar Número de WhatsApp</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto">
                        Ative o número do seu celular ou o WhatsApp oficial da sua agência no painel.
                      </p>
                    </div>

                    <div className="space-y-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsConnectModalOpen(true)}
                        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>Conectar Meu Número de WhatsApp</span>
                      </button>

                      {gatewayUrl && (
                        <button
                          type="button"
                          onClick={handleGenerateQr}
                          disabled={isGeneratingQr}
                          className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                        >
                          <QrCode className="w-3.5 h-3.5 text-slate-500" />
                          <span>Buscar QR Code do meu Gateway</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* REAL-TIME WHATSAPP CONVERSATION SIMULATOR & TESTER                        */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 lg:p-8 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    Testador de Conversas do WhatsApp (Simulação em Tempo Real)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Simule um cliente real enviando uma mensagem no WhatsApp da agência para testar a notificação sonora, a criação do ticket e o atendimento dos consultores.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Alerta Sonoro Ativo</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Nome do Cliente Teste:
                </label>
                <input
                  type="text"
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo (Cliente)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Número de Telefone do Cliente:
                </label>
                <input
                  type="text"
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  placeholder="Ex: +55 (11) 99887-6655"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mensagem Enviada pelo Cliente:
              </label>
              <textarea
                rows={3}
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-[11px] font-semibold text-slate-400 self-center">Testes Rápidos:</span>
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

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleSimulateIncoming()}
                disabled={isSimulating || !simMessage.trim()}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Disparando Mensagem...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Disparar Mensagem pelo WhatsApp</span>
                  </>
                )}
              </button>

              {simResult && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  simResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {simResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{simResult.text}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: META CLOUD API (When META_CLOUD is selected)                  */}
      {/* ========================================================================= */}
      {providerType === 'META_CLOUD' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Webhook Info Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Dados para Cadastro no Painel Meta Developers
            </h3>
            <p className="text-xs text-slate-500">
              Copie estas informações e cole na seção <strong>WhatsApp &gt; Configuration &gt; Webhook</strong> no painel de desenvolvedores do Facebook/Meta:
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">URL de Callback (Webhook)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookCallbackUrl}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-blue-600 text-xs select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(webhookCallbackUrl, 'url')}
                    className="px-3 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    {copiedField === 'url' ? (
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
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Token de Verificação (Verify Token)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={verifyToken}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 text-xs select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(verifyToken, 'token')}
                    className="px-3 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
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
              </div>
            </div>
          </div>

          {/* API Credentials Form */}
          <form onSubmit={handleSaveConfig} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-600" />
              Credenciais do Cloud API (Oficial)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Phone Number ID</label>
                <input
                  type="text"
                  placeholder="Ex: 109823471923847"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">WhatsApp Business Account ID</label>
                <input
                  type="text"
                  placeholder="Ex: 98721340912384"
                  value={businessAccountId}
                  onChange={(e) => setBusinessAccountId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">
                  Token de Acesso Permanente (System User Token)
                </label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Cole aqui seu token EAAB... gerado no Meta Business Manager"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  * O token é armazenado de forma segura no banco de dados e nunca é exposto publicamente no frontend.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar Credenciais da Meta</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Clear Mock Data Box */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-600" />
            Limpar Dados Fictícios e Conversas de Teste
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Zera as conversas demonstrativas anteriores para que o painel exiba apenas as mensagens reais que chegarem no número oficial da agência.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsClearModalOpen(true)}
          disabled={isSaving}
          className="px-4 py-2.5 rounded-xl bg-white hover:bg-rose-50 hover:text-rose-700 text-xs font-bold text-slate-700 border border-slate-200 flex items-center gap-2 transition-colors shadow-2xs shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
          <span>Limpar Histórico Fictício</span>
        </button>
      </div>

      {testStatus && (
        <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 flex items-center gap-2 animate-fadeIn">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
          <span>{testStatus}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CONECTAR / CADASTRAR NÚMERO DE WHATSAPP                         */}
      {/* ========================================================================= */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
                Conectar WhatsApp da Agência
              </h3>
              <p className="text-xs text-slate-500 text-center mb-5">
                Informe o número de WhatsApp que será utilizado para atender os clientes da RealizzeTravel.
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Exemplo: +55 11 98765-4321 ou (11) 98765-4321
                  </p>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    Ativação Imediata:
                  </p>
                  <p className="text-[11px] leading-relaxed text-emerald-800">
                    O canal será registrado como ativo e todas as novas conversas recebidas serão distribuídas aos consultores de plantão.
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
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Conectando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Ativar WhatsApp</span>
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
      {/* MODAL 2: CONFIRMAR DESCONEXÃO                                            */}
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
              Tem certeza de que deseja desconectar o número <strong>{phoneConnected || 'atual'}</strong>? A plataforma deixará de receber novas mensagens até ser reconectada.
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
      {/* MODAL 3: LIMPAR DADOS FICTÍCIOS                                          */}
      {/* ========================================================================= */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 p-6">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
              Limpar Histórico Fictício
            </h3>
            <p className="text-xs text-slate-500 text-center mb-6">
              Deseja zerar todas as conversas e clientes demonstrativos anteriores para que o painel fique 100% limpo, exibindo apenas as conversas do seu número?
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
