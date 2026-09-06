import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { socketClient } from '../../services/socket';
import { User } from '../../types';
import {
  Clock,
  MessageSquare,
  Users,
  CheckCircle2,
  Hourglass,
  ArrowRight,
  TrendingUp,
  Radio,
  Compass,
  MapPin,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateToChat: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateToChat }) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState({
    waitingCount: 6,
    openCount: 8,
    myCount: 3,
    closedTodayCount: 6,
    totalCustomersCount: 10,
    avgResponseMinutes: 4.2,
    avgHandleMinutes: 18.5,
  });

  const [attendants, setAttendants] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [metricsData, usersData] = await Promise.all([
        api.getMetrics(),
        api.getUsers(),
      ]);
      setMetrics(metricsData);
      setAttendants(usersData.users);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Listen to realtime events to refresh cards live
    const unbindCreated = socketClient.on('conversation:created', () => fetchDashboardData());
    const unbindAssigned = socketClient.on('conversation:assigned', () => fetchDashboardData());
    const unbindClosed = socketClient.on('conversation:closed', () => fetchDashboardData());
    const unbindAttendants = socketClient.on('attendants:updated', () => fetchDashboardData());
    const unbindPollSync = socketClient.on('poll:sync', () => fetchDashboardData());
    const unbindCleared = socketClient.on('conversation:cleared', () => fetchDashboardData());

    return () => {
      unbindCreated();
      unbindAssigned();
      unbindClosed();
      unbindAttendants();
      unbindPollSync();
      unbindCleared();
    };
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Welcome & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-xl shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
            Olá, {user?.name.split(' ')[0]}!
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Central de Atendimento da Agência de Viagens • Fila de espera e distribuição em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onNavigateToChat}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-xs font-bold text-white flex items-center gap-2 shadow-xs transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Abrir Fila de Atendimentos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Card 1: Conversas aguardando */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-orange-500 mb-2">
            <span className="text-xs font-semibold text-slate-500">Aguardando</span>
            <Hourglass className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-orange-600 tracking-tight">
            {metrics.waitingCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span>Na fila de espera</span>
          </div>
        </div>

        {/* Card 2: Conversas em atendimento */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-semibold text-slate-500">Em Atendimento</span>
            <Radio className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            {metrics.openCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Com atendentes ativos</div>
        </div>

        {/* Card 3: Minhas conversas */}
        <div className="bg-white border border-blue-200 rounded-xl p-5 flex flex-col justify-between shadow-xs bg-blue-50/10">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold text-blue-600">Minhas Conversas</span>
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-600 tracking-tight">
            {metrics.myCount}
          </div>
          <div className="text-[11px] text-blue-600/70 mt-2">Atribuídas a você</div>
        </div>

        {/* Card 4: Encerradas hoje */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold text-slate-500">Encerradas Hoje</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            {metrics.closedTodayCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Finalizadas hoje</div>
        </div>

        {/* Card 5: Tempo médio de atendimento */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-500">Tempo Médio</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            {metrics.avgHandleMinutes}m
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Duração média</div>
        </div>

        {/* Card 6: Clientes na base */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-500">Total Clientes</span>
            <Users className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            {metrics.totalCustomersCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Base cadastrada</div>
        </div>
      </div>

      {/* LOWER SECTION: ATENDENTES ONLINE & INDICATORS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Atendentes Online Box */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-1 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              ATENDENTES ONLINE
            </h3>
            <span className="text-xs text-slate-400 font-medium">Equipe</span>
          </div>

          <div className="space-y-2.5">
            {attendants.length === 0 ? (
              <div className="text-xs text-slate-400 py-3">Carregando atendentes...</div>
            ) : (
              attendants.map((att) => {
                const isOnline = att.status === 'ONLINE';
                const isBusy = att.status === 'BUSY';
                return (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {att.avatar ? (
                          <img
                            src={att.avatar}
                            alt={att.name}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-600">
                            {att.name.charAt(0)}
                          </div>
                        )}
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                            isOnline ? 'bg-emerald-500' : isBusy ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          {att.name}
                          {att.id === user?.id && (
                            <span className="text-[10px] text-blue-600 font-semibold">(você)</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {att.role === 'ADMIN' ? 'Administrador' : att.role === 'SUPERVISOR' ? 'Supervisora' : 'Atendente'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isOnline
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                            : isBusy
                            ? 'bg-amber-50 text-amber-600 border border-amber-200/60'
                            : 'bg-rose-50 text-rose-600 border border-rose-200/60'
                        }`}
                      >
                        {isOnline ? 'Online' : isBusy ? 'Ocupado' : 'Offline'}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {att.status === 'ONLINE' ? 'Disponível' : att.status === 'BUSY' ? 'Em chamada' : 'Ausente'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Travel Agency Operational Overview */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-2 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                STATUS OPERACIONAL DO WHATSAPP DA AGÊNCIA
              </h3>
              <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                API Oficial Conectada
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                <div className="font-bold text-slate-800 mb-1.5">Distribuição e Fila Inteligente</div>
                <p className="text-slate-600 leading-relaxed">
                  Clientes que enviam mensagens entram imediatamente na fila com status <strong className="text-orange-600">Aguardando</strong>. Qualquer atendente disponível pode clicar em <strong className="text-blue-600">Atender</strong> para iniciar o suporte com controle atômico de concorrência.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-blue-600" />
                    Destinos Mais Procurados (Interesse)
                  </div>
                  <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded font-bold">
                    WhatsApp
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {[
                    { name: 'Porto Seguro & Arraial, BA', percent: 38, count: 42, color: 'bg-blue-600' },
                    { name: 'Maceió & Maragogi, AL', percent: 27, count: 30, color: 'bg-cyan-500' },
                    { name: 'Natal & Praia da Pipa, RN', percent: 22, count: 25, color: 'bg-teal-500' },
                    { name: 'Gramado & Canela, RS', percent: 18, count: 20, color: 'bg-emerald-500' },
                    { name: 'Cruzeiros Réveillon / MSC', percent: 14, count: 16, color: 'bg-indigo-500' },
                  ].map((dest, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-700 truncate">{dest.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-slate-400">{dest.count} cotações</span>
                          <span className="font-bold text-slate-900 w-8 text-right">{dest.percent}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`${dest.color} h-1.5 rounded-full`}
                          style={{ width: `${dest.percent * 2.5}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div>Regra de Concorrência Ativa: Operação atômica no banco de dados para prevenir atribuição dupla.</div>
            <button
              onClick={onNavigateToChat}
              className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
            >
              Ver Conversas Agora →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

