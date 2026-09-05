import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserStatus } from '../../types';
import { socketClient } from '../../services/socket';
import { api } from '../../services/api';
import {
  isSoundEnabled,
  setSoundEnabled,
  playNotificationSound,
  sendDesktopNotification,
} from '../../services/sound';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  BarChart3,
  UserCog,
  Smartphone,
  Settings,
  LogOut,
  Bell,
  Plane,
  ChevronDown,
  Menu,
  X,
  Radio,
  Volume2,
  VolumeX,
  CheckCheck,
  Trash2,
  ExternalLink,
  MessageCircle,
  UserCheck,
  Clock,
  Sparkles,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  type: 'NEW_TICKET' | 'NEW_MESSAGE' | 'ASSIGNED' | 'TRANSFERRED' | 'CLOSED';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  conversationId?: string;
  customerName?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_init_1',
    type: 'NEW_TICKET',
    title: 'Novo Cliente na Fila',
    message: 'Marcos Oliveira aguarda consultoria para pacote em Cancún.',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    read: false,
    customerName: 'Marcos Oliveira',
  },
  {
    id: 'notif_init_2',
    type: 'NEW_MESSAGE',
    title: 'Mensagem Recebida',
    message: 'Camila Rodrigues enviou os dados dos passageiros para emissão.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    read: false,
    customerName: 'Camila Rodrigues',
  },
  {
    id: 'notif_init_3',
    type: 'TRANSFERRED',
    title: 'Atendimento Transferido',
    message: 'Carlos Santos transferiu a conversa de Fernando Costa para você.',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    read: true,
    customerName: 'Fernando Costa',
  },
];

interface AppShellProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ currentTab, onTabChange, children }) => {
  const { user, logout, updateUserStatus } = useAuth();
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [soundActive, setSoundActive] = useState<boolean>(true);
  const [activeNotifFilter, setActiveNotifFilter] = useState<'all' | 'unread'>('all');
  const [agencyName, setAgencyName] = useState<string>('RealizzeTravel Viagens');

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('realizzetravel_notifications') || localStorage.getItem('voolivre_notifications');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return INITIAL_NOTIFICATIONS;
  });

  const [showNotificationToast, setShowNotificationToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'ADMIN';
  const isSupervisor = user?.role === 'SUPERVISOR';
  const canAccessAdmin = isAdmin || isSupervisor;

  // Persist notifications
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('realizzetravel_notifications', JSON.stringify(notifications));
    }
  }, [notifications]);

  // Load and sync agency branding
  useEffect(() => {
    async function loadAgencyName() {
      try {
        const res = await api.getGeneralSettings();
        if (res.settings?.agencyName) {
          const cleanName = res.settings.agencyName.replace(/VooLivre/g, 'RealizzeTravel');
          setAgencyName(cleanName);
          document.title = `${cleanName} - Central WhatsApp`;
        }
      } catch {}
    }
    loadAgencyName();

    const handleSettingsUpdated = (e: any) => {
      const updated = e.detail?.agencyName;
      if (updated) {
        const cleanName = updated.replace(/VooLivre/g, 'RealizzeTravel');
        setAgencyName(cleanName);
        document.title = `${cleanName} - Central WhatsApp`;
      }
    };

    const handleSoundChanged = (e: any) => {
      if (typeof e.detail?.enabled === 'boolean') {
        setSoundActive(e.detail.enabled);
      }
    };

    window.addEventListener('agency_settings_updated', handleSettingsUpdated);
    window.addEventListener('sound_setting_changed', handleSoundChanged);

    return () => {
      window.removeEventListener('agency_settings_updated', handleSettingsUpdated);
      window.removeEventListener('sound_setting_changed', handleSoundChanged);
    };
  }, []);

  // Sync sound status
  useEffect(() => {
    setSoundActive(isSoundEnabled());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationsOpen]);

  // Realtime events
  useEffect(() => {
    const unbindCreated = socketClient.on('conversation:created', (payload) => {
      playNotificationSound('new_ticket');
      const newNotif: NotificationItem = {
        id: `notif_${Date.now()}`,
        type: 'NEW_TICKET',
        title: 'Novo Cliente na Fila',
        message: `${payload.customerName || 'Cliente'} enviou mensagem no WhatsApp: "${payload.content || 'Solicitação de cotação'}"`,
        timestamp: new Date().toISOString(),
        read: false,
        conversationId: payload.conversationId,
        customerName: payload.customerName,
      };

      setNotifications((prev) => [newNotif, ...prev.slice(0, 49)]);
      setToastMessage(`Novo atendimento: ${payload.customerName || 'Cliente'} aguarda na fila.`);
      setShowNotificationToast(true);
      setTimeout(() => setShowNotificationToast(false), 5000);

      sendDesktopNotification(`${agencyName || 'RealizzeTravel Viagens'} - Novo Atendimento`, {
        body: `${payload.customerName || 'Cliente'} está aguardando no WhatsApp.`,
        onClick: () => onTabChange('chat'),
      });
    });

    const unbindNewMessage = socketClient.on('message:new', (payload) => {
      if (payload.message && payload.message.sender_type === 'CUSTOMER') {
        playNotificationSound('message');
        const newNotif: NotificationItem = {
          id: `notif_${Date.now()}`,
          type: 'NEW_MESSAGE',
          title: 'Mensagem Recebida',
          message: payload.message.content || 'Nova mensagem de passageiro.',
          timestamp: new Date().toISOString(),
          read: false,
          conversationId: payload.conversationId,
        };

        setNotifications((prev) => [newNotif, ...prev.slice(0, 49)]);
        setToastMessage(`Nova mensagem recebida de cliente.`);
        setShowNotificationToast(true);
        setTimeout(() => setShowNotificationToast(false), 4000);

        sendDesktopNotification(`${agencyName || 'RealizzeTravel Viagens'} - Mensagem Recebida`, {
          body: payload.message.content,
          onClick: () => onTabChange('chat'),
        });
      }
    });

    const unbindAssigned = socketClient.on('conversation:assigned', (payload) => {
      if (payload.assignedUserId !== user?.id) {
        setToastMessage(`Conversa assumida por ${payload.assignedUserName}.`);
        setShowNotificationToast(true);
        setTimeout(() => setShowNotificationToast(false), 3500);
      }
    });

    const unbindTransferred = socketClient.on('conversation:transferred', (payload) => {
      playNotificationSound('message');
      const newNotif: NotificationItem = {
        id: `notif_${Date.now()}`,
        type: 'TRANSFERRED',
        title: 'Atendimento Transferido',
        message: `Uma conversa foi transferida para você: ${payload.reason || 'Atendimento de cotação'}`,
        timestamp: new Date().toISOString(),
        read: false,
        conversationId: payload.conversationId,
      };
      setNotifications((prev) => [newNotif, ...prev.slice(0, 49)]);
      setToastMessage('Você recebeu a transferência de um atendimento.');
      setShowNotificationToast(true);
      setTimeout(() => setShowNotificationToast(false), 5000);
    });

    return () => {
      unbindCreated();
      unbindNewMessage();
      unbindAssigned();
      unbindTransferred();
    };
  }, [user?.id, onTabChange]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    setNotificationsOpen(false);
    onTabChange('chat');
  };

  const handleToggleSound = () => {
    const next = !soundActive;
    setSoundActive(next);
    setSoundEnabled(next);
    if (next) playNotificationSound('message');
  };

  const filteredNotifications =
    activeNotifFilter === 'unread'
      ? notifications.filter((n) => !n.read)
      : notifications;

  const formatRelativeTime = (isoString: string) => {
    try {
      const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diff < 60) return 'agora';
      if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
      if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
      return `há ${Math.floor(diff / 86400)}d`;
    } catch {
      return '';
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, public: true },
    { id: 'chat', label: 'Atendimentos', icon: MessageSquare, public: true, badge: 'Fila' },
    { id: 'customers', label: 'Clientes', icon: Users, public: true },
    { id: 'reports', label: 'Relatórios', icon: BarChart3, public: true },
    { id: 'agents', label: 'Atendentes', icon: UserCog, adminOnly: true },
    { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone, adminOnly: true },
    { id: 'settings', label: 'Configurações', icon: Settings, adminOnly: true },
  ];

  const filteredNavItems = navItems.filter((item) => {
    if (item.adminOnly && !canAccessAdmin) return false;
    return true;
  });

  const getStatusColor = (status?: UserStatus) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-emerald-500';
      case 'BUSY':
        return 'bg-amber-500';
      default:
        return 'bg-rose-500';
    }
  };

  const getStatusText = (status?: UserStatus) => {
    switch (status) {
      case 'ONLINE':
        return 'Online';
      case 'BUSY':
        return 'Ocupado';
      default:
        return 'Offline';
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full">ADMIN</span>;
      case 'SUPERVISOR':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">SUPERVISOR</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">ATENDENTE</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans antialiased">
      {/* Realtime Floating Toast */}
      {showNotificationToast && (
        <div
          onClick={() => {
            onTabChange('chat');
            setShowNotificationToast(false);
          }}
          className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-white border border-blue-200 text-slate-900 px-4 py-3 rounded-2xl shadow-xl cursor-pointer hover:shadow-2xl transition-all animate-bounce"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div className="text-xs">
            <div className="font-bold text-slate-900">Alerta da Central</div>
            <div className="text-slate-600 font-medium">{toastMessage}</div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowNotificationToast(false);
            }}
            className="text-slate-400 hover:text-slate-600 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOPBAR */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Agency Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs font-bold text-base">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-base text-slate-900 tracking-tight leading-tight flex items-center gap-2">
                {agencyName || 'RealizzeTravel Viagens'}
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  WhatsApp Oficial
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium leading-none mt-0.5">
                Central Multiatendimento
              </div>
            </div>
          </div>
        </div>

        {/* User Info & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Status Dropdown */}
          <div className="relative">
            <button
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 transition-colors shadow-2xs"
            >
              <span className={`w-2 h-2 rounded-full ${getStatusColor(user?.status)}`} />
              <span className="hidden sm:inline font-bold">{getStatusText(user?.status)}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {statusDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-2xl shadow-xl py-1 z-50 text-xs animate-fadeIn">
                <button
                  onClick={() => {
                    updateUserStatus('ONLINE');
                    setStatusDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-emerald-600 font-bold"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>🟢 Disponível</span>
                </button>
                <button
                  onClick={() => {
                    updateUserStatus('BUSY');
                    setStatusDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-amber-600 font-bold"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>🟡 Ocupado</span>
                </button>
                <button
                  onClick={() => {
                    updateUserStatus('OFFLINE');
                    setStatusDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-rose-600 font-bold"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>🔴 Ausente</span>
                </button>
              </div>
            )}
          </div>

          {/* User Profile display */}
          <div
            onClick={() => onTabChange('settings')}
            className="flex items-center gap-2.5 border-l border-slate-200 pl-3 sm:pl-3.5 cursor-pointer hover:opacity-80 transition-opacity"
            title="Editar meu perfil"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="hidden md:block text-left">
              <div className="text-xs font-bold text-slate-800 leading-tight flex items-center gap-1.5">
                {user?.name}
              </div>
              <div className="mt-0.5">{getRoleBadge(user?.role)}</div>
            </div>
          </div>

          {/* Notifications Bell with Rich Popover */}
          <div className="relative" ref={notifDropdownRef}>
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className={`relative p-2 rounded-xl transition-all ${
                notificationsOpen
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="Central de Notificações"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-600 text-[10px] font-bold text-white flex items-center justify-center shadow-xs animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden text-xs animate-fadeIn">
                {/* Panel Header */}
                <div className="p-3.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">Notificações</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                        title="Marcar todas como lidas"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Lidas</span>
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={clearAllNotifications}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Limpar histórico"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 px-3.5 py-2 border-b border-slate-100 bg-white">
                  <button
                    onClick={() => setActiveNotifFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      activeNotifFilter === 'all'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    Todas ({notifications.length})
                  </button>
                  <button
                    onClick={() => setActiveNotifFilter('unread')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      activeNotifFilter === 'unread'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    Não lidas ({unreadCount})
                  </button>
                </div>

                {/* Notification List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {filteredNotifications.length === 0 ? (
                    <div className="py-8 px-4 text-center space-y-1">
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                        <Bell className="w-4 h-4" />
                      </div>
                      <p className="font-semibold text-slate-700 text-xs">Tudo em dia!</p>
                      <p className="text-[11px] text-slate-400">Nenhuma notificação encontrada nesta categoria.</p>
                    </div>
                  ) : (
                    filteredNotifications.map((notif) => {
                      return (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                            !notif.read ? 'bg-blue-50/40' : 'bg-white'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              notif.type === 'NEW_TICKET'
                                ? 'bg-blue-100 text-blue-600'
                                : notif.type === 'NEW_MESSAGE'
                                ? 'bg-emerald-100 text-emerald-600'
                                : notif.type === 'TRANSFERRED'
                                ? 'bg-indigo-100 text-indigo-600'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {notif.type === 'NEW_TICKET' && <Plane className="w-3.5 h-3.5" />}
                            {notif.type === 'NEW_MESSAGE' && <MessageCircle className="w-3.5 h-3.5" />}
                            {notif.type === 'TRANSFERRED' && <UserCheck className="w-3.5 h-3.5" />}
                            {notif.type === 'ASSIGNED' && <UserCheck className="w-3.5 h-3.5" />}
                            {notif.type === 'CLOSED' && <CheckCheck className="w-3.5 h-3.5" />}
                          </div>

                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 text-xs truncate">
                                {notif.title}
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {formatRelativeTime(notif.timestamp)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                              {notif.message}
                            </p>
                          </div>

                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Quick Preferences Bar */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={handleToggleSound}
                    className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-semibold px-2 py-1 rounded-lg hover:bg-slate-200/60 transition-colors"
                  >
                    {soundActive ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Som Ligado</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                        <span>Som Mudo</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNotificationsOpen(false);
                      onTabChange('settings');
                    }}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <span>Configurações</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Settings shortcut */}
          {canAccessAdmin && (
            <button
              onClick={() => onTabChange('settings')}
              className={`p-2 rounded-xl transition-colors hidden sm:block ${
                currentTab === 'settings'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="Configurações da Agência"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Logout Button */}
          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"
            title="Sair do sistema"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR (Desktop) */}
        <aside className="hidden md:flex flex-col w-60 bg-white border-r border-slate-200 p-3.5 shrink-0 shadow-2xs">
          <nav className="space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Agency Status Footer */}
          <div className="mt-auto p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 space-y-1">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              WhatsApp Oficial Meta
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Canal ativo para pacotes, cruzeiros e passagens aéreas.
            </p>
          </div>
        </aside>

        {/* MOBILE DRAWER */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-64 bg-white h-full p-4 flex flex-col z-50 shadow-2xl border-r border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <span className="font-bold text-slate-800">Menu Principal</span>
                <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border border-blue-100'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* MAIN VIEW CONTENT */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
};
