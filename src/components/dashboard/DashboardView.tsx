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
  Send,
  Sparkles,
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
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [simName, setSimName] = useState('Mariana Rios');
  const [simPhone, setSimPhone] = useState('+55 11 98888-7766');
  const [simMessage, setSimMessage] = useState('Olá! Gostaria de uma cotação para pacote de réveillon em Porto Seguro com aéreo.');
  const [isSimulating, setIsSimulating] = useState(false);

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

    return () => {
      unbindCreated();
      unbindAssigned();
      unbindClosed();
      unbindAttendants();
      unbindPollSync();
    };
  }, []);

  const handleSimulateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simMessage) return;
    setIsSimulating(true);
    try {
      await api.simulateWhatsAppMessage({
        name: simName,
        phone: simPhone,
        message: simMessage,
      });
      setSimModalOpen(false);
      await fetchDashboardData();
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

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
            onClick={() => setSimModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Simular WhatsApp</span>
          </button>

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

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                <div className="font-bold text-slate-800 mb-1.5">Produtos mais consultados hoje</div>
                <ul className="text-slate-600 space-y-1.5 mt-2">
                  <li className="flex items-center justify-between">
                    <span>Pacotes Porto Seguro & Nordeste</span>
                    <span className="font-bold text-slate-800">38%</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Cruzeiros Costa / MSC Réveillon</span>
                    <span className="font-bold text-slate-800">27%</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Passagens aéreas nacionais</span>
                    <span className="font-bold text-slate-800">22%</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Disney / Orlando e Exterior</span>
                    <span className="font-bold text-slate-800">13%</span>
                  </li>
                </ul>
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

      {/* Simulation Modal */}
      {simModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Simular Mensagem de Cliente via WhatsApp
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Dispara o pipeline oficial do webhook. A mensagem entrará na fila imediatamente como &quot;Aguardando&quot; para todos os atendentes em tempo real.
            </p>

            <form onSubmit={handleSimulateInbound} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Exemplos Prontos (Clique para preencher):</label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSimName('Mariana Ferreira');
                      setSimPhone('+55 (11) 98765-4321');
                      setSimMessage('Olá! Gostaria de uma cotação para pacote em Porto Seguro para 4 pessoas na segunda quinzena de Julho. Vocês têm opções com resort all-inclusive?');
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-[11px] font-medium transition-colors border border-slate-200"
                  >
                    🏖️ Pacote Porto Seguro
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimName('Ricardo & Patrícia');
                      setSimPhone('+55 (21) 99888-1122');
                      setSimMessage('Boa tarde! Estamos buscando um Cruzeiro MSC ou Costa para o Réveillon saindo de Santos ou Rio de Janeiro. Ainda há cabines disponíveis?');
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-[11px] font-medium transition-colors border border-slate-200"
                  >
                    🚢 Cruzeiro Réveillon
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimName('Lucas Mendes');
                      setSimPhone('+55 (31) 97123-8899');
                      setSimMessage('Oi! Preciso de passagem de ida e volta para Lisboa para 2 adultos em outubro. Qual o valor aproximado e formas de parcelamento?');
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-[11px] font-medium transition-colors border border-slate-200"
                  >
                    ✈️ Passagem Internacional
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome do Passageiro / Cliente</label>
                <input
                  type="text"
                  required
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">WhatsApp</label>
                <input
                  type="text"
                  required
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Mensagem enviada pelo cliente</label>
                <textarea
                  rows={3}
                  required
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSimModalOpen(false)}
                  className="px-3.5 py-2 text-slate-500 hover:text-slate-800 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSimulating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSimulating ? 'Enviando...' : 'Receber na Fila'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
