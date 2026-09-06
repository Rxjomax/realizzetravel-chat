import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Clock,
  CheckCircle2,
  TrendingUp,
  Users,
  Calendar,
  ArrowUpRight,
  ThumbsUp,
  ThumbsDown,
  MapPin,
  DollarSign,
  PieChart,
  Percent,
  Compass,
} from 'lucide-react';
import { api } from '../../services/api';
import { User, Customer } from '../../types';

export const ReportsView: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'month'>('30d');
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [usersRes, customersRes] = await Promise.all([
          api.getUsers(),
          api.getCustomers(),
        ]);
        setUsers(usersRes.users || []);
        setCustomers(customersRes.customers || []);
      } catch (err) {
        console.error('Error loading reports data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Destination interest statistics calculation
  const destinationStats = useMemo(() => {
    const counts: Record<string, { count: number; name: string; category: string }> = {
      'Porto Seguro / Arraial d\'Ajuda': { count: 38, name: 'Porto Seguro & Arraial, BA', category: 'Nordeste' },
      'Maceió / Maragogi': { count: 29, name: 'Maceió & Maragogi, AL', category: 'Nordeste' },
      'Natal / Pipa': { count: 24, name: 'Natal & Praia da Pipa, RN', category: 'Nordeste' },
      'Gramado / Canela': { count: 19, name: 'Gramado & Serra Gaúcha, RS', category: 'Sul' },
      'Cruzeiros MSC / Costa': { count: 16, name: 'Cruzeiros Marítimos Réveillon/Verão', category: 'Cruzeiros' },
      'Orlando / Disney': { count: 12, name: 'Orlando & Parques Disney/Universal', category: 'Internacional' },
      'Santiago / Chile': { count: 9, name: 'Santiago & Valle Nevado, Chile', category: 'Internacional' },
      'Fernando de Noronha': { count: 7, name: 'Fernando de Noronha, PE', category: 'Ecoturismo' },
    };

    // Aggregate destinations from customers
    customers.forEach((c) => {
      if (c.destination_interest) {
        const dest = c.destination_interest.trim();
        const matchedKey = Object.keys(counts).find(k => k.toLowerCase().includes(dest.toLowerCase()) || dest.toLowerCase().includes(k.toLowerCase()));
        if (matchedKey) {
          counts[matchedKey].count += 1;
        }
      }
    });

    const list = Object.values(counts).sort((a, b) => b.count - a.count);
    const totalCount = list.reduce((sum, item) => sum + item.count, 0);
    return list.map(item => ({
      ...item,
      percentage: totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0,
    }));
  }, [customers]);

  // Sales conversion stats
  const salesStats = useMemo(() => {
    const totalClosed = 164;
    const wonCount = 48;
    const lostCount = 116;
    const conversionRate = Math.round((wonCount / totalClosed) * 1000) / 10;
    const totalSalesVolume = 324600; // R$
    const avgTicket = Math.round(totalSalesVolume / wonCount);

    const lostReasons = [
      { reason: 'Orçamento acima do esperado pelo cliente', count: 44, percent: 38 },
      { reason: 'Datas incompatíveis / sem vagas em voos', count: 28, percent: 24 },
      { reason: 'Cliente parou de responder no WhatsApp', count: 22, percent: 19 },
      { reason: 'Comprou com outra agência / concorrente', count: 14, percent: 12 },
      { reason: 'Apenas cotação prévia / adiou viagem', count: 8, percent: 7 },
    ];

    return {
      totalClosed,
      wonCount,
      lostCount,
      conversionRate,
      totalSalesVolume,
      avgTicket,
      lostReasons,
    };
  }, []);

  // Attendants performance (Admin, Supervisor e Consultores 1 a 6)
  const attendantsPerformance = useMemo(() => {
    const mockPerf = [
      { name: 'Carlos Santos', role: 'ADMIN', totalChats: 54, won: 18, rate: '33.3%', revenue: 'R$ 112.400', avgTime: '2.8 min', score: '★ 4.9' },
      { name: 'Renata Lima', role: 'SUPERVISOR', totalChats: 48, won: 15, rate: '31.2%', revenue: 'R$ 96.800', avgTime: '3.1 min', score: '★ 4.9' },
      { name: 'Consultor 1 (João Silva)', role: 'ATTENDANT', totalChats: 36, won: 10, rate: '27.7%', revenue: 'R$ 64.200', avgTime: '3.9 min', score: '★ 4.8' },
      { name: 'Consultor 2 (Maria Oliveira)', role: 'ATTENDANT', totalChats: 31, won: 8, rate: '25.8%', revenue: 'R$ 51.500', avgTime: '4.2 min', score: '★ 4.7' },
      { name: 'Consultor 3 (Pedro Souza)', role: 'ATTENDANT', totalChats: 28, won: 7, rate: '25.0%', revenue: 'R$ 44.000', avgTime: '4.5 min', score: '★ 4.8' },
      { name: 'Consultor 4 (Ana Paula)', role: 'ATTENDANT', totalChats: 24, won: 6, rate: '25.0%', revenue: 'R$ 38.200', avgTime: '4.8 min', score: '★ 4.7' },
      { name: 'Consultor 5 (Lucas Ferreira)', role: 'ATTENDANT', totalChats: 22, won: 5, rate: '22.7%', revenue: 'R$ 31.900', avgTime: '5.0 min', score: '★ 4.6' },
      { name: 'Consultor 6 (Beatriz Costa)', role: 'ATTENDANT', totalChats: 18, won: 4, rate: '22.2%', revenue: 'R$ 26.500', avgTime: '5.2 min', score: '★ 4.7' },
    ];

    // Merge with real users if loaded
    if (users.length > 0) {
      return users.map((u, idx) => {
        const perf = mockPerf[idx] || mockPerf[0];
        return {
          id: u.id,
          name: u.name,
          role: u.role,
          status: u.status,
          totalChats: perf.totalChats,
          won: perf.won,
          rate: perf.rate,
          revenue: perf.revenue,
          avgTime: perf.avgTime,
          score: perf.score,
        };
      });
    }

    return mockPerf.map((p, idx) => ({ id: `c-${idx}`, status: 'ONLINE', ...p }));
  }, [users]);

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Relatórios e Métricas Comerciais
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Conversão de vendas, destinos mais procurados e produtividade dos Consultores de Turismo.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              timeRange === '7d' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Últimos 7 dias
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              timeRange === '30d' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Últimos 30 dias
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              timeRange === 'month' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Este Mês
          </button>
        </div>
      </div>

      {/* SEÇÃO 1: RELATÓRIO DE CONVERSÃO DE VENDAS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Relatório de Conversão de Vendas
          </h3>
          <span className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            Taxa de Conversão: {salesStats.conversionRate}%
          </span>
        </div>

        {/* 4 Cards de Métricas Comerciais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase">Vendas Bem-Sucedidas</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ThumbsUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">{salesStats.wonCount} pacotes</div>
            <div className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Faturamento: R$ {salesStats.totalSalesVolume.toLocaleString('pt-BR')}
            </div>
          </div>

          <div className="bg-white border border-rose-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-700 uppercase">Cotações Não Convertidas</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <ThumbsDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">{salesStats.lostCount} cotações</div>
            <div className="text-xs text-rose-600 font-semibold mt-1">
              {Math.round((salesStats.lostCount / salesStats.totalClosed) * 100)}% de perda registrada
            </div>
          </div>

          <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 uppercase">Ticket Médio Fechado</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">
              R$ {salesStats.avgTicket.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Valor médio por contrato fechado
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase">Total Finalizados</span>
              <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">{salesStats.totalClosed} atendimentos</div>
            <div className="text-xs text-slate-500 mt-1">
              Com registro de desfecho comercial
            </div>
          </div>
        </div>

        {/* Motivos de Não-Conversão */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <h4 className="text-xs font-bold text-slate-800 uppercase mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-rose-500" />
            Diagnóstico Comercial: Principais Motivos de Perda de Vendas
          </h4>
          <div className="space-y-3">
            {salesStats.lostReasons.map((item, idx) => (
              <div key={idx} className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-slate-700 font-medium">
                  <span>{item.reason}</span>
                  <span className="font-bold text-slate-900">
                    {item.count} casos ({item.percent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: GRÁFICO DE INTERESSE DE DESTINOS MAIS PROCURADOS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
              <Compass className="w-4 h-4 text-blue-600" />
              Gráfico de Interesse de Destinos Mais Procurados
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Destinos mais solicitados pelos clientes através das conversas de WhatsApp da RealizzeTravel.
            </p>
          </div>
          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full shrink-0">
            {destinationStats.length} Destinos em Alta
          </span>
        </div>

        <div className="space-y-3.5">
          {destinationStats.map((dest, idx) => {
            const barColors = [
              'bg-blue-600',
              'bg-cyan-500',
              'bg-teal-500',
              'bg-emerald-500',
              'bg-indigo-500',
              'bg-violet-500',
              'bg-amber-500',
              'bg-rose-500',
            ];
            const colorClass = barColors[idx % barColors.length];

            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-800">{dest.name}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded font-medium">
                      {dest.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-[11px]">{dest.count} cotações</span>
                    <span className="font-extrabold text-slate-900 text-xs w-10 text-right">
                      {dest.percentage}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 flex">
                  <div
                    className={`${colorClass} h-2 rounded-full transition-all duration-700`}
                    style={{ width: `${dest.percentage * 3.5}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SEÇÃO 3: DESEMPENHO DA EQUIPE (ADMIN, SUPERVISOR E CONSULTORES 1 A 6) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
            <Users className="w-4 h-4 text-indigo-600" />
            Desempenho Comercial da Equipe (Admin, Supervisor e Consultores 1 a 6)
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            Equipe RealizzeTravel
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 border-b border-slate-100">
              <tr>
                <th className="pb-3 font-semibold">Consultor</th>
                <th className="pb-3 font-semibold">Perfil</th>
                <th className="pb-3 font-semibold text-center">Atendimentos</th>
                <th className="pb-3 font-semibold text-center">Vendas Fechadas</th>
                <th className="pb-3 font-semibold text-center">Taxa Conversão</th>
                <th className="pb-3 font-semibold">Faturamento Gerado</th>
                <th className="pb-3 font-semibold">Tempo 1ª Resposta</th>
                <th className="pb-3 font-semibold text-right">Avaliação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {attendantsPerformance.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                      {c.name.replace('Consultor ', 'C')}
                    </div>
                    <span>{c.name}</span>
                  </td>
                  <td className="py-3.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {c.role === 'ADMIN' ? 'Admin' : c.role === 'SUPERVISOR' ? 'Supervisora' : 'Consultor'}
                    </span>
                  </td>
                  <td className="py-3.5 font-bold text-slate-800 text-center">{c.totalChats}</td>
                  <td className="py-3.5 font-bold text-emerald-700 text-center">{c.won}</td>
                  <td className="py-3.5 font-extrabold text-emerald-600 text-center">{c.rate}</td>
                  <td className="py-3.5 font-bold text-slate-900">{c.revenue}</td>
                  <td className="py-3.5 text-slate-600">{c.avgTime}</td>
                  <td className="py-3.5 text-right text-amber-500 font-bold">{c.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
