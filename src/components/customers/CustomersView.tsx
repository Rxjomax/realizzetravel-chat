import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { Customer } from '../../types';
import { Search, MapPin, Calendar, DollarSign, Phone, Mail, Users, MessageSquare, TrendingUp, Wallet, UserCheck } from 'lucide-react';
import { parseBudgetValue } from '../../utils/travelExtractor';

interface CustomersViewProps {
  onSelectCustomerChat?: (customerId: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchCustomers = async () => {
    try {
      const data = await api.getCustomers(search);
      setCustomers(data.customers);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  // Totalização do valor estimado dos clientes
  const { totalEstimatedValue, customersWithBudget, totalPassengers, averageBudget } = useMemo(() => {
    let total = 0;
    let countWithBudget = 0;
    let totalPax = 0;

    customers.forEach((c) => {
      totalPax += c.passenger_count || 1;
      const val = parseBudgetValue(c.budget);
      if (val > 0) {
        total += val;
        countWithBudget += 1;
      }
    });

    const avg = countWithBudget > 0 ? total / countWithBudget : 0;
    return {
      totalEstimatedValue: total,
      customersWithBudget: countWithBudget,
      totalPassengers: totalPax,
      averageBudget: avg,
    };
  }, [customers]);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Base de Clientes & Viagens
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Histórico completo de passageiros que entraram em contato através do WhatsApp.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou destino..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
          />
        </div>
      </div>

      {/* Cards de Totalização dos Valores Estimados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Total em Orçamentos Estimados
            </span>
            <div className="text-lg font-extrabold text-slate-900 mt-0.5">
              R$ {totalEstimatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400">
              {customersWithBudget} cliente(s) com valor cotado
            </span>
          </div>
        </div>

        <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
              Total de Clientes
            </span>
            <div className="text-lg font-extrabold text-slate-900 mt-0.5">
              {customers.length} cadastrados
            </div>
            <span className="text-[10px] text-slate-400">
              Contatos capturados no atendimento
            </span>
          </div>
        </div>

        <div className="bg-white border border-indigo-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Ticket Médio Estimado
            </span>
            <div className="text-lg font-extrabold text-slate-900 mt-0.5">
              R$ {averageBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400">
              Média por pacote cotado
            </span>
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Passageiros Previstos
            </span>
            <div className="text-lg font-extrabold text-slate-900 mt-0.5">
              {totalPassengers} pessoas
            </div>
            <span className="text-[10px] text-slate-400">
              Em cotações abertas e fechadas
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((c) => (
          <div
            key={c.id}
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 transition-colors shadow-xs"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center font-bold text-blue-600 text-sm">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm leading-tight">{c.name}</h3>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{c.phone}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 py-3 border-y border-slate-100 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>
                    <strong className="text-slate-400 font-normal">Destino:</strong>{' '}
                    {c.destination_interest || 'A definir'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    <strong className="text-slate-400 font-normal">Data:</strong>{' '}
                    {c.travel_date || 'A combinar'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-700">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{c.passenger_count || 1} passageiro(s)</span>
                  </div>
                  {c.budget && (
                    <div className="flex items-center gap-1 text-emerald-600 font-bold">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>{c.budget}</span>
                    </div>
                  )}
                </div>
              </div>

              {c.notes && (
                <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                  {c.notes}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 flex items-center justify-between text-[11px] text-slate-400">
              <span>Cadastrado em {new Date(c.created_at).toLocaleDateString()}</span>
              <span className="text-blue-600 flex items-center gap-1 font-bold">
                <MessageSquare className="w-3 h-3" /> WhatsApp Ativo
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
