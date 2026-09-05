import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { User } from '../../types';
import { UserCog, Plus, ShieldCheck, Headphones, Mail, CheckCircle2 } from 'lucide-react';

export const AgentsView: React.FC = () => {
  const [agents, setAgents] = useState<(User & { active_conversations_count?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAgents = async () => {
    try {
      const res = await api.getUsers();
      setAgents(res.users);
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <UserCog className="w-5 h-5 text-blue-600" />
            Gerenciamento de Atendentes & Acessos
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Controle de papéis (Admin, Supervisor, Atendente), status em tempo real e capacidade de atendimento.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((ag) => {
          const isOnline = ag.status === 'ONLINE';
          const isBusy = ag.status === 'BUSY';
          return (
            <div
              key={ag.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {ag.avatar ? (
                        <img
                          src={ag.avatar}
                          alt={ag.name}
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-blue-600 ring-2 ring-slate-100">
                          {ag.name.charAt(0)}
                        </div>
                      )}
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white ${
                          isOnline ? 'bg-emerald-500' : isBusy ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                      />
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{ag.name}</h3>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{ag.email}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      ag.role === 'ADMIN'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                        : ag.role === 'SUPERVISOR'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200/70'
                        : 'bg-blue-50 text-blue-700 border border-blue-200/70'
                    }`}
                  >
                    {ag.role}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 my-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status Atual:</span>
                    <span className="font-semibold text-slate-800">
                      {isOnline ? '🟢 Online' : isBusy ? '🟡 Ocupado' : '🔴 Offline'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Conversas Ativas:</span>
                    <span className="font-bold text-blue-600">
                      {ag.active_conversations_count || 0} em andamento
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span>Criado em {new Date(ag.created_at).toLocaleDateString()}</span>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ativo
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
