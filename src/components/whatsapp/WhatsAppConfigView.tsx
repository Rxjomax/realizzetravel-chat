import React, { useState, useEffect } from 'react';
import { Smartphone, CheckCircle2, ShieldCheck, Key, RefreshCw, Send, Copy, Check, Info } from 'lucide-react';
import { api } from '../../services/api';

export const WhatsAppConfigView: React.FC = () => {
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('viagens_whatsapp_verify_token_2026');
  const [connectionStatus, setConnectionStatus] = useState<string>('DISCONNECTED');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'url' | 'token' | null>(null);

  const webhookCallbackUrl = `${window.location.origin}/webhooks/whatsapp`;

  useEffect(() => {
    async function loadConfig() {
      try {
        setIsLoading(true);
        const res = await api.getWhatsAppSettings();
        if (res.config) {
          setPhoneNumberId(res.config.phoneNumberId || '');
          setBusinessAccountId(res.config.businessAccountId || '');
          setAccessToken(res.config.accessToken || '');
          setVerifyToken(res.config.verifyToken || 'viagens_whatsapp_verify_token_2026');
          setConnectionStatus(res.config.status || 'DISCONNECTED');
        }
      } catch (e: any) {
        console.warn('Notice loading WhatsApp config:', e.message);
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await api.saveWhatsAppSettings({
        phoneNumberId,
        businessAccountId,
        accessToken,
        verifyToken,
      });
      setIsSaved(true);
      setConnectionStatus(phoneNumberId && accessToken ? 'CONNECTED' : 'DISCONNECTED');
      setTimeout(() => setIsSaved(false), 4000);
    } catch (e: any) {
      setErrorMessage(e.message || 'Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = (text: string, field: 'url' | 'token') => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleTestSimulation = async () => {
    try {
      setTestStatus('Enviando mensagem de simulação ao Webhook...');
      await api.simulateWhatsAppMessage({
        name: 'Cliente Teste WhatsApp',
        phone: '+55 11 99999-0000',
        message: 'Olá! Estou testando a integração oficial do WhatsApp na agência RealizzeTravel!',
      });
      setTestStatus('✅ Mensagem de teste recebida! Veja o atendimento na aba Chat/Fila.');
      setTimeout(() => setTestStatus(null), 5000);
    } catch (e: any) {
      setTestStatus(`Erro: ${e.message || 'Falha ao executar simulação.'}`);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-600" />
            Conexão WhatsApp Business Cloud API (Oficial Meta)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Integração direta com os servidores oficiais da Meta para atendimento corporativo seguro, sem risco de banimento de chip.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connectionStatus === 'CONNECTED' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              API Conectada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Aguardando Credenciais
            </span>
          )}
        </div>
      </div>

      {/* Visual Step-by-Step Guide */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
          <span>🚀 Como liberar para funcionar com um WhatsApp real (3 passos):</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs space-y-1">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs mb-2">1</span>
            <h4 className="font-bold text-slate-800">Crie o App na Meta</h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Acesse <strong>developers.facebook.com</strong>, crie um aplicativo empresarial e adicione o produto <strong>WhatsApp</strong>.
            </p>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs space-y-1">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs mb-2">2</span>
            <h4 className="font-bold text-slate-800">Copie as Chaves</h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Copie o <strong>Phone Number ID</strong>, <strong>Business Account ID</strong> e o <strong>Access Token</strong> gerados no painel e cole abaixo.
            </p>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs space-y-1">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs mb-2">3</span>
            <h4 className="font-bold text-slate-800">Cadastre o Webhook</h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              No painel da Meta, cole a <strong>URL de Callback</strong> e o <strong>Token de Verificação</strong> fornecidos no cartão abaixo e ative o evento <em>messages</em>.
            </p>
          </div>
        </div>
      </div>

      {isSaved && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2.5 shadow-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">Configurações salvas e validadas com sucesso no banco de dados!</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2.5 shadow-xs">
          <Info className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Webhook Info Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
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
      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
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
              * O token é armazenado criptografado no banco de dados e nunca é exposto publicamente no frontend.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleTestSimulation}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-xs font-bold text-slate-700 border border-slate-200 flex items-center justify-center gap-2 transition-colors shadow-2xs"
          >
            <Send className="w-3.5 h-3.5 text-blue-600" />
            <span>Testar Recebimento de Webhook</span>
          </button>

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
              <span>Salvar Configurações</span>
            )}
          </button>
        </div>

        {testStatus && (
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 flex items-center gap-2 animate-fadeIn">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
            <span>{testStatus}</span>
          </div>
        )}
      </form>
    </div>
  );
};

