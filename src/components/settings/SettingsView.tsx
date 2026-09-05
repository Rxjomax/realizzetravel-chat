import React, { useState, useEffect } from 'react';
import {
  Building2,
  Bell,
  User as UserIcon,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  Clock,
  Shield,
  KeyRound,
  RefreshCw,
  Save,
  Radio,
  Sliders,
  Sparkles,
  Play,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../services/api';
import { User } from '../../types';
import {
  isSoundEnabled,
  setSoundEnabled,
  playNotificationSound,
  requestNotificationPermission,
  sendDesktopNotification,
} from '../../services/sound';
import { WhatsAppConfigView } from '../whatsapp/WhatsAppConfigView';

interface SettingsViewProps {
  currentUser: User;
  onUserUpdated?: (user: User) => void;
  onAgencySettingsUpdated?: (settings: any) => void;
  onNavigateToChat?: () => void;
  initialTab?: 'general' | 'notifications' | 'profile' | 'whatsapp';
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onUserUpdated,
  onAgencySettingsUpdated,
  onNavigateToChat,
  initialTab = 'general',
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'profile' | 'whatsapp'>(initialTab);

  // General Settings State
  const [agencyName, setAgencyName] = useState('RealizzeTravel Viagens & Turismo');
  const [agencyPhone, setAgencyPhone] = useState('+55 (11) 4004-9800');
  const [agencyEmail, setAgencyEmail] = useState('contato@realizzetravel.com.br');
  const [welcomeMessage, setWelcomeMessage] = useState(
    'Olá! Seja bem-vindo à RealizzeTravel Viagens. Como podemos ajudar no seu roteiro hoje? Em instantes um de nossos consultores de turismo irá lhe atender.'
  );
  const [outOfHoursMessage, setOutOfHoursMessage] = useState(
    'Nosso horário de atendimento é de Segunda a Sexta das 08h às 19h e Sábados das 09h às 13h. Sua solicitação foi registrada com sucesso e retornaremos no início do próximo expediente!'
  );
  const [businessHoursStart, setBusinessHoursStart] = useState('08:00');
  const [businessHoursEnd, setBusinessHoursEnd] = useState('19:00');
  const [businessDays, setBusinessDays] = useState<string[]>(['seg', 'ter', 'qua', 'qui', 'sex', 'sab']);
  const [queueMode, setQueueMode] = useState<'MANUAL' | 'AUTO_ROUND_ROBIN'>('MANUAL');

  // Test Simulation State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    queueInfo: string;
    autoReplyInfo: string;
    status: string;
  } | null>(null);

  // Notification State
  const [soundActive, setSoundActive] = useState(true);
  const [browserPermStatus, setBrowserPermStatus] = useState<string>('default');

  // Profile State
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profileAvatar, setProfileAvatar] = useState(currentUser.avatar || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status and Loading
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load General Settings & Notification preferences
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const res = await api.getGeneralSettings();
        if (res.settings) {
          setAgencyName((res.settings.agencyName || 'RealizzeTravel Viagens & Turismo').replace(/VooLivre/g, 'RealizzeTravel'));
          setAgencyPhone(res.settings.agencyPhone || '+55 (11) 4004-9800');
          setAgencyEmail((res.settings.agencyEmail || 'contato@realizzetravel.com.br').replace(/@voolivre/g, '@realizzetravel').replace(/voolivre/g, 'realizzetravel'));
          setWelcomeMessage((res.settings.welcomeMessage || '').replace(/VooLivre/g, 'RealizzeTravel'));
          setOutOfHoursMessage(res.settings.outOfHoursMessage || '');
          setBusinessHoursStart(res.settings.businessHoursStart || '08:00');
          setBusinessHoursEnd(res.settings.businessHoursEnd || '19:00');
          setBusinessDays(res.settings.businessDays || ['seg', 'ter', 'qua', 'qui', 'sex', 'sab']);
          setQueueMode(res.settings.queueMode || 'MANUAL');
        }
      } catch (err: any) {
        console.warn('Notice loading settings:', err.message);
      } finally {
        setIsLoading(false);
      }
    }

    setSoundActive(isSoundEnabled());
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermStatus(Notification.permission);
    }
    loadData();
  }, []);

  const showFeedback = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setSuccessMessage(null);
    } else {
      setSuccessMessage(msg);
      setErrorMessage(null);
    }
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 4500);
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const res = await api.saveGeneralSettings({
        agencyName,
        agencyPhone,
        agencyEmail,
        welcomeMessage,
        outOfHoursMessage,
        businessHoursStart,
        businessHoursEnd,
        businessDays,
        queueMode,
      });
      onAgencySettingsUpdated?.(res.settings || { agencyName, agencyPhone, agencyEmail });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agency_settings_updated', { detail: res.settings || { agencyName } }));
      }
      showFeedback('Configurações gerais da agência salvas com sucesso!');
    } catch (err: any) {
      showFeedback(err.message || 'Erro ao salvar configurações gerais.', true);
    } finally {
      setIsSaving(false);
    }
  };

  const isCurrentlyOpen = () => {
    try {
      const spDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const dayMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
      const currentDay = dayMap[spDate.getDay()];
      if (!businessDays.includes(currentDay)) return false;
      const [startH, startM] = (businessHoursStart || '08:00').split(':').map(Number);
      const [endH, endM] = (businessHoursEnd || '19:00').split(':').map(Number);
      const currentMin = spDate.getHours() * 60 + spDate.getMinutes();
      const startMin = (isNaN(startH) ? 8 : startH) * 60 + (isNaN(startM) ? 0 : startM);
      const endMin = (isNaN(endH) ? 19 : endH) * 60 + (isNaN(endM) ? 0 : endM);
      return currentMin >= startMin && currentMin <= endMin;
    } catch {
      return true;
    }
  };

  const handleTestAutomation = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);

      // Auto-save settings first so the test exercises the latest values
      await api.saveGeneralSettings({
        agencyName,
        agencyPhone,
        agencyEmail,
        welcomeMessage,
        outOfHoursMessage,
        businessHoursStart,
        businessHoursEnd,
        businessDays,
        queueMode,
      });

      const randomNames = ['Camila Barbosa', 'Rodrigo Duarte', 'Mariana Siqueira', 'Lucas Tavares'];
      const testName = randomNames[Math.floor(Math.random() * randomNames.length)];
      const testPhone = `+55 11 9${Math.floor(10000000 + Math.random() * 90000000)}`;
      const testMsg = 'Olá, gostaria de fazer uma cotação para pacote em Porto de Galinhas!';

      const res: any = await api.simulateWhatsAppMessage({
        name: testName,
        phone: testPhone,
        message: testMsg,
      });

      const details = res?.details || {};
      const isOpen = isCurrentlyOpen();

      setTestResult({
        queueInfo: details.status === 'ASSIGNED'
          ? 'Distribuído automaticamente via Rodízio (Atendente Online)'
          : 'Fila Manual (Aguardando atendente assumir)',
        autoReplyInfo: details.autoReplySent
          ? (isOpen ? 'Boas-Vindas enviada automaticamente' : 'Aviso de Fora do Horário enviado')
          : 'Sem envio automático configurado',
        status: details.status || 'WAITING',
      });

      showFeedback('Simulação realizada! Mensagem recebida e automações acionadas com sucesso.');
    } catch (err: any) {
      showFeedback(err.message || 'Erro ao simular teste de WhatsApp.', true);
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleSound = (enabled: boolean) => {
    setSoundActive(enabled);
    setSoundEnabled(enabled);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sound_setting_changed', { detail: { enabled } }));
    }
    if (enabled) {
      playNotificationSound('message');
    }
    showFeedback(enabled ? 'Sons de notificação ativados.' : 'Sons de notificação desativados.');
  };

  const handleRequestBrowserNotification = async () => {
    const perm = await requestNotificationPermission();
    setBrowserPermStatus(perm);
    if (perm === 'granted') {
      sendDesktopNotification('RealizzeTravel Viagens', {
        body: 'Notificações na área de trabalho ativadas com sucesso!',
      });
      showFeedback('Notificações de desktop ativadas e autorizadas!');
    } else if (perm === 'denied') {
      showFeedback('Permissão negada no navegador. Habilite nas configurações do navegador.', true);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword) {
      if (newPassword.length < 6) {
        showFeedback('A nova senha deve ter no mínimo 6 caracteres.', true);
        return;
      }
      if (newPassword !== confirmPassword) {
        showFeedback('A confirmação de senha não confere.', true);
        return;
      }
      if (!currentPassword) {
        showFeedback('Informe sua senha atual para poder alterá-la.', true);
        return;
      }
    }

    try {
      setIsSaving(true);
      const res = await api.updateMyProfile({
        name: profileName,
        avatar: profileAvatar,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });

      if (res.user && onUserUpdated) {
        onUserUpdated(res.user);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showFeedback('Dados de perfil atualizados com sucesso!');
    } catch (err: any) {
      showFeedback(err.message || 'Erro ao atualizar perfil.', true);
    } finally {
      setIsSaving(false);
    }
  };

  const daysList = [
    { id: 'seg', label: 'Segunda' },
    { id: 'ter', label: 'Terça' },
    { id: 'qua', label: 'Quarta' },
    { id: 'qui', label: 'Quinta' },
    { id: 'sex', label: 'Sexta' },
    { id: 'sab', label: 'Sábado' },
    { id: 'dom', label: 'Domingo' },
  ];

  const toggleDay = (dayId: string) => {
    if (businessDays.includes(dayId)) {
      setBusinessDays(businessDays.filter((d) => d !== dayId));
    } else {
      setBusinessDays([...businessDays, dayId]);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-blue-600" />
            Configurações do Sistema
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gerenciamento geral da agência, regras de atendimento, notificações e integração oficial WhatsApp.
          </p>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Shield className="w-3.5 h-3.5" />
            {currentUser.role === 'ADMIN' ? 'Acesso Administrador' : 'Acesso da Equipe'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80 overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'general'
              ? 'bg-white text-blue-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Geral da Agência</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'notifications'
              ? 'bg-white text-blue-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notificações & Sons</span>
          {!soundActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'whatsapp'
              ? 'bg-white text-emerald-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Smartphone className="w-4 h-4 text-emerald-600" />
          <span>WhatsApp Meta API</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'profile'
              ? 'bg-white text-blue-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          <span>Meu Perfil & Senha</span>
        </button>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center gap-2.5 shadow-2xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center gap-2.5 shadow-2xs animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tab 1: General Agency Settings */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Identificação da Agência
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome Comercial da Agência</label>
                <input
                  type="text"
                  required
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Telefone Comercial / WhatsApp</label>
                <input
                  type="text"
                  value={agencyPhone}
                  onChange={(e) => setAgencyPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">E-mail de Contato</label>
                <input
                  type="email"
                  value={agencyEmail}
                  onChange={(e) => setAgencyEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>

          {/* Business Hours and Queue Mode */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Horário de Atendimento e Distribuição da Fila
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                  isCurrentlyOpen()
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCurrentlyOpen() ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                {isCurrentlyOpen() ? 'Central Aberta Agora (Boas-Vindas ativa)' : 'Fora do Horário Agora (Aviso de Ausência ativo)'}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-2">Dias com Atendimento Ativo</label>
                <div className="flex flex-wrap gap-2">
                  {daysList.map((day) => {
                    const isSelected = businessDays.includes(day.id);
                    return (
                      <button
                        type="button"
                        key={day.id}
                        onClick={() => toggleDay(day.id)}
                        className={`px-3 py-1.5 rounded-xl font-bold border transition-all text-xs ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Horário de Início</label>
                  <input
                    type="time"
                    value={businessHoursStart}
                    onChange={(e) => setBusinessHoursStart(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Horário de Encerramento</label>
                  <input
                    type="time"
                    value={businessHoursEnd}
                    onChange={(e) => setBusinessHoursEnd(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <label className="block text-slate-700 font-semibold mb-2">Modo de Distribuição dos Clientes</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setQueueMode('MANUAL')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      queueMode === 'MANUAL'
                        ? 'border-blue-600 bg-blue-50/50 shadow-2xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="queueMode"
                        checked={queueMode === 'MANUAL'}
                        onChange={() => setQueueMode('MANUAL')}
                        className="text-blue-600"
                      />
                      <span className="font-bold text-slate-800 text-xs">Fila Manual (Puxar Atendimento)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 pl-5">
                      Os clientes ficam na fila de espera e qualquer atendente livre pode assumir o contato.
                    </p>
                  </div>

                  <div
                    onClick={() => setQueueMode('AUTO_ROUND_ROBIN')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      queueMode === 'AUTO_ROUND_ROBIN'
                        ? 'border-blue-600 bg-blue-50/50 shadow-2xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="queueMode"
                        checked={queueMode === 'AUTO_ROUND_ROBIN'}
                        onChange={() => setQueueMode('AUTO_ROUND_ROBIN')}
                        className="text-blue-600"
                      />
                      <span className="font-bold text-slate-800 text-xs">Distribuição Automática (Rodízio)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 pl-5">
                      O sistema distribui igualmente os novos contatos entre os consultores com status Online.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Automatic Greetings */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Mensagens Automáticas de WhatsApp
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Mensagem de Boas-Vindas (Primeiro Contato)
                </label>
                <textarea
                  rows={3}
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder="Mensagem enviada quando um cliente inicia uma nova conversa..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Mensagem de Fora do Horário de Atendimento
                </label>
                <textarea
                  rows={3}
                  value={outOfHoursMessage}
                  onChange={(e) => setOutOfHoursMessage(e.target.value)}
                  placeholder="Mensagem enviada quando o cliente manda mensagem à noite ou no domingo..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>

          {/* Interactive Automation Test Card */}
          <div className="bg-gradient-to-br from-blue-50/80 via-slate-50 to-indigo-50/50 border border-blue-200/80 rounded-2xl p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Testador das Automações e Fila de Atendimento
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Simule a chegada de uma nova mensagem via WhatsApp para comprovar em tempo real o envio das respostas automáticas e a regra de distribuição da fila.
                </p>
              </div>

              <button
                type="button"
                onClick={handleTestAutomation}
                disabled={isTesting}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-2"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executando Teste...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Simular Chegada de Cliente Agora</span>
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div className="p-4 rounded-xl bg-white border border-blue-200 text-xs space-y-2.5 shadow-2xs animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Simulação Executada com Sucesso!
                  </span>
                  {onNavigateToChat && (
                    <button
                      type="button"
                      onClick={onNavigateToChat}
                      className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 text-xs hover:underline"
                    >
                      <span>Abrir na Central de Atendimento</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] pt-2 border-t border-slate-100">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-500 font-semibold block">Regra da Fila Acionada:</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">{testResult.queueInfo}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-500 font-semibold block">Disparo de Mensagem:</span>
                    <span className="font-bold text-blue-700 mt-0.5 block">{testResult.autoReplyInfo}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Configurações da Agência</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Notifications & Sound */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-blue-600" />
                Alertas Sonoros em Tempo Real
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toques suaves sintetizados nativamente no navegador, sem travamentos ou falhas de carregamento.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">Sons de Notificação Ativos</span>
                    {soundActive ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Ativado
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        Mudo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Toca um aviso quando chegam novas mensagens de passageiros ou novos clientes na fila.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => playNotificationSound('message')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5 shadow-2xs"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Testar Som</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleSound(!soundActive)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                      soundActive
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    {soundActive ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Ligado</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        <span>Desligado</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Novo Cliente na Fila</span>
                    <button
                      type="button"
                      onClick={() => playNotificationSound('new_ticket')}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Ouvir acorde C-E-G
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Acorde ascendente e elegante quando um passageiro inicia contato no WhatsApp.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Mensagem Recebida</span>
                    <button
                      type="button"
                      onClick={() => playNotificationSound('message')}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Ouvir tom duplo
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Bipe duplo discreto para que o atendente não se assuste durante o trabalho.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Push Notifications */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600" />
                Notificações na Área de Trabalho (Desktop)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Receba alertas na tela do seu computador mesmo se a aba estiver minimizada ou em segundo plano.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">Status do Navegador:</span>
                  {browserPermStatus === 'granted' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Permitido ✅
                    </span>
                  ) : browserPermStatus === 'denied' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Bloqueado pelo Navegador
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Pendente de Autorização
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Ideal para não perder mensagens urgentes de clientes solicitando cotações de voos e hotéis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {browserPermStatus === 'granted' ? (
                  <button
                    type="button"
                    onClick={() => {
                      sendDesktopNotification('RealizzeTravel Viagens', {
                        body: 'Teste de notificação de nova mensagem no WhatsApp!',
                      });
                      showFeedback('Notificação de teste disparada na sua tela!');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                  >
                    Disparar Notificação de Teste
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestBrowserNotification}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                  >
                    Ativar Notificações no Navegador
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: WhatsApp Meta API View */}
      {activeTab === 'whatsapp' && (
        <WhatsAppConfigView />
      )}

      {/* Tab 4: Profile & Password */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-blue-600" />
              Seus Dados de Acesso
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-5 pb-5 border-b border-slate-100">
              <img
                src={
                  profileAvatar ||
                  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=face'
                }
                alt={profileName}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200 shadow-xs"
              />
              <div className="flex-1 w-full space-y-1">
                <label className="block text-xs font-semibold text-slate-700">URL da Foto de Perfil (Avatar)</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={profileAvatar}
                  onChange={(e) => setProfileAvatar(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">E-mail de Login</label>
                <input
                  type="email"
                  disabled
                  value={currentUser.email}
                  className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-500 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400">O e-mail de acesso corporativo só pode ser alterado pelo Admin.</span>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-600" />
              Alterar Senha de Acesso
            </h3>
            <p className="text-xs text-slate-500">
              Deixe estes campos em branco se não desejar alterar sua senha neste momento.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Senha Atual</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nova Senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 dígitos"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Confirmar Nova Senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Atualizando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Dados de Perfil</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
