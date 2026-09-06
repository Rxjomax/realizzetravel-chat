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
  const [salesStats, setSalesStats] = useState({
    totalClosed: 0,
    wonCount: 0,
    lostCount: 0,
    conversionRate: 0,
    totalSalesVolume: 0,
    avgTicket: 0,
    lostReasons: [] as { reason: string; count: number; percent: number }[],
  });
  const [destinationStats, setDestinationStats] = useState<{ name: string; count: number; category: string; percentage: number }[]>([]);
  const [attendantsPerformance, setAttendantsPerformance] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const data = await api.getCommercialReports();
        if (data) {
          setSalesStats(data.salesStats || {
            totalClosed: 0,
            wonCount: 0,
            lostCount: 0,
            conversionRate: 0,
            totalSalesVolume: 0,
            avgTicket: 0,
            lostReasons: [],
          });
          setDestinationStats(data.destinationStats || []);
          setAttendantsPerformance(data.attendantsPerformance || []);
        }
      } catch (err) {
        console.error('Error loading reports data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [timeRange]);

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
              {salesStats.totalClosed > 0 ? `${Math.round((salesStats.lostCount / salesStats.totalClosed) * 100)}% de perda registrada` : '0% de perda registrada'}
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
          {salesStats.lostReasons.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              Nenhuma perda registrada até o momento. As métricas aparecerão automaticamente ao finalizar atendimentos.
            </div>
          ) : (
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
          )}
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

        {destinationStats.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Nenhum destino catalogado ainda. Conforme os clientes solicitarem cotações, os destinos em alta serão listados aqui.
          </div>
        ) : (
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
                      style={{ width: `${Math.min(dest.percentage * 3.5, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
