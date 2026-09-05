import React from 'react';
import { BarChart3, Clock, CheckCircle2, TrendingUp, Users, Calendar, ArrowUpRight } from 'lucide-react';

export const ReportsView: React.FC = () => {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Relatórios e Métricas de Atendimento
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Desempenho de conversão, tempos médios de primeira resposta e volume de mensagens.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs font-medium">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            Últimos 30 dias
          </span>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">Tempo Médio 1ª Resposta</div>
          <div className="text-2xl font-bold text-blue-600">3.8 min</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> 18% mais rápido que a média
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">Taxa de Conversão em Venda</div>
          <div className="text-2xl font-bold text-emerald-600">28.4%</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> +4.2% este mês
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">Total de Atendimentos</div>
          <div className="text-2xl font-bold text-slate-800">412</div>
          <div className="text-[11px] text-slate-400 mt-1">Via WhatsApp Oficial</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">Satisfação dos Clientes (CSAT)</div>
          <div className="text-2xl font-bold text-amber-500">4.9 / 5.0</div>
          <div className="text-[11px] text-slate-400 mt-1">Baseado em pesquisas pós-fechamento</div>
        </div>
      </div>

      {/* Breakdown by Attendants */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Desempenho Individual por Atendente</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 border-b border-slate-100">
              <tr>
                <th className="pb-3 font-semibold">Atendente</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Atendimentos</th>
                <th className="pb-3 font-semibold">Tempo Médio</th>
                <th className="pb-3 font-semibold">Conversão</th>
                <th className="pb-3 font-semibold text-right">Avaliação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-3.5 font-bold text-slate-800">João Silva</td>
                <td className="py-3.5">
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 text-[10px]">Online</span>
                </td>
                <td className="py-3.5 font-bold text-slate-800">128</td>
                <td className="py-3.5 text-slate-600">3.2 min</td>
                <td className="py-3.5 text-emerald-600 font-bold">32.1%</td>
                <td className="py-3.5 text-right text-amber-500 font-bold">★ 4.9</td>
              </tr>
              <tr>
                <td className="py-3.5 font-bold text-slate-800">Maria Oliveira</td>
                <td className="py-3.5">
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 text-[10px]">Online</span>
                </td>
                <td className="py-3.5 font-bold text-slate-800">142</td>
                <td className="py-3.5 text-slate-600">4.1 min</td>
                <td className="py-3.5 text-emerald-600 font-bold">29.6%</td>
                <td className="py-3.5 text-right text-amber-500 font-bold">★ 4.8</td>
              </tr>
              <tr>
                <td className="py-3.5 font-bold text-slate-800">Pedro Souza</td>
                <td className="py-3.5">
                  <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60 text-[10px]">Offline</span>
                </td>
                <td className="py-3.5 font-bold text-slate-800">96</td>
                <td className="py-3.5 text-slate-600">4.8 min</td>
                <td className="py-3.5 text-emerald-600 font-bold">24.5%</td>
                <td className="py-3.5 text-right text-amber-500 font-bold">★ 4.7</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
