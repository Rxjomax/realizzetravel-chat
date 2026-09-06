import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { User, UserRole, UserStatus } from '../../types';
import {
  UserCog,
  Plus,
  ShieldCheck,
  Headphones,
  Mail,
  CheckCircle2,
  Pencil,
  Trash2,
  Camera,
  Upload,
  X,
  AlertCircle,
  RotateCcw,
  Check,
  User as UserIcon,
  Sparkles,
} from 'lucide-react';

interface AgentsViewProps {
  currentUser?: User | null;
  onUserUpdated?: (user: User) => void;
}

const PRESET_AVATARS = [
  { label: 'Executivo 1', url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face' },
  { label: 'Executiva 1', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=face' },
  { label: 'Consultora 1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face' },
  { label: 'Consultor 1', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face' },
  { label: 'Consultor 2', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face' },
  { label: 'Consultora 2', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face' },
  { label: 'Consultora 3', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face' },
  { label: 'Consultor 3', url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=face' },
  { label: 'Consultora 4', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face' },
  { label: 'Consultor 4', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face' },
];

export const AgentsView: React.FC<AgentsViewProps> = ({ currentUser, onUserUpdated }) => {
  const [agents, setAgents] = useState<(User & { active_conversations_count?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit Modal State
  const [editingAgent, setEditingAgent] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('AGENT');
  const [editStatus, setEditStatus] = useState<UserStatus>('ONLINE');
  const [editAvatar, setEditAvatar] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Modal State
  const [deletingAgent, setDeletingAgent] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('AGENT');
  const [newPassword, setNewPassword] = useState('viagens123');
  const [newAvatar, setNewAvatar] = useState(PRESET_AVATARS[0].url);
  const [isSavingCreate, setIsSavingCreate] = useState(false);

  // File input refs
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const createFileInputRef = useRef<HTMLInputElement>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

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

  const handleOpenEdit = (agent: User) => {
    setEditingAgent(agent);
    setEditName(agent.name);
    setEditEmail(agent.email);
    setEditRole(agent.role);
    setEditStatus(agent.status);
    setEditAvatar(agent.avatar || '');
    setEditPassword('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;

    if (!editName.trim()) {
      showFeedback('O nome do atendente não pode ficar vazio.', 'error');
      return;
    }

    try {
      setIsSavingEdit(true);
      const updateData: any = {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        status: editStatus,
        avatar: editAvatar.trim(),
      };

      if (editPassword.trim()) {
        if (editPassword.trim().length < 6) {
          showFeedback('A nova senha deve ter no mínimo 6 caracteres.', 'error');
          setIsSavingEdit(false);
          return;
        }
        updateData.password = editPassword.trim();
      }

      const res = await api.updateUser(editingAgent.id, updateData);

      if (res.success && res.user) {
        showFeedback(`Perfil de "${res.user.name}" atualizado e salvo com sucesso!`);
        if (currentUser && currentUser.id === editingAgent.id && onUserUpdated) {
          onUserUpdated(res.user);
        }
        await fetchAgents();
        setEditingAgent(null);
      }
    } catch (err: any) {
      showFeedback(err.message || 'Erro ao atualizar perfil.', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      showFeedback('Preencha todos os campos obrigatórios.', 'error');
      return;
    }

    try {
      setIsSavingCreate(true);
      const res = await api.createUser({
        name: newName.trim(),
        email: newEmail.trim(),
        role: newRole,
        password: newPassword.trim(),
        avatar: newAvatar,
      });

      if (res.success) {
        showFeedback(`Consultor "${res.user.name}" criado com sucesso!`);
        await fetchAgents();
        setIsCreateModalOpen(false);
        setNewName('');
        setNewEmail('');
        setNewPassword('viagens123');
      }
    } catch (err: any) {
      showFeedback(err.message || 'Erro ao criar atendente.', 'error');
    } finally {
      setIsSavingCreate(false);
    }
  };

  const requestDeleteAgent = (agent: User) => {
    if (currentUser?.id === agent.id) {
      showFeedback('Você não pode excluir o seu próprio perfil conectado no momento.', 'error');
      return;
    }
    setDeletingAgent(agent);
  };

  const confirmDeleteAgent = async () => {
    if (!deletingAgent) return;

    if (currentUser?.id === deletingAgent.id) {
      showFeedback('Você não pode excluir o seu próprio perfil conectado no momento.', 'error');
      setDeletingAgent(null);
      return;
    }

    try {
      setIsDeleting(true);
      await api.deleteUser(deletingAgent.id);
      showFeedback(`Perfil "${deletingAgent.name}" excluído com sucesso.`);
      if (editingAgent?.id === deletingAgent.id) {
        setEditingAgent(null);
      }
      setDeletingAgent(null);
      await fetchAgents();
    } catch (err: any) {
      showFeedback(err.message || 'Erro ao remover perfil.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isEditing: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showFeedback('Por favor selecione um arquivo de imagem válido (PNG, JPG, WEBP).', 'error');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      showFeedback('A imagem deve ter no máximo 4MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (isEditing) {
        setEditAvatar(dataUrl);
      } else {
        setNewAvatar(dataUrl);
      }
      showFeedback('Foto carregada com sucesso! Clique em Salvar para persistir.');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <UserCog className="w-5 h-5 text-emerald-600" />
              Gestão de Perfis & Consultores RealizzeTravel
            </h2>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              {agents.length} Perfis
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Personalize os nomes, fotos de perfil e cargos da equipe (Admin, Supervisor e Consultores 1 a 6). Todas as alterações ficam salvas e se adaptam automaticamente ao chat com os clientes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Consultor / Perfil</span>
          </button>
        </div>
      </div>

      {/* Grid of User Profiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {agents.map((ag) => {
          const isOnline = ag.status === 'ONLINE';
          const isBusy = ag.status === 'BUSY';
          const isMe = currentUser?.id === ag.id;

          return (
            <div
              key={ag.id}
              className={`bg-white border rounded-xl p-5 flex flex-col justify-between shadow-xs transition-all hover:shadow-sm ${
                isMe ? 'border-emerald-300 ring-2 ring-emerald-500/10' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative group">
                      {ag.avatar ? (
                        <img
                          src={ag.avatar}
                          alt={ag.name}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100 group-hover:ring-emerald-400 transition-all"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-base ring-2 ring-slate-100">
                          {ag.name.charAt(0)}
                        </div>
                      )}
                      <span
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full ring-2 ring-white ${
                          isOnline ? 'bg-emerald-500' : isBusy ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        title={`Status: ${ag.status}`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-slate-900 text-sm">{ag.name}</h3>
                        {isMe && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                            Você
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[180px]">{ag.email}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                      ag.role === 'ADMIN'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                        : ag.role === 'SUPERVISOR'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200/70'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                    }`}
                  >
                    {ag.role === 'ADMIN' ? 'Administrador' : ag.role === 'SUPERVISOR' ? 'Supervisor' : 'Consultor'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 my-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status Operacional:</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      {isOnline ? '🟢 Online' : isBusy ? '🟡 Ocupado' : '🔴 Offline'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Conversas em Andamento:</span>
                    <span className="font-bold text-emerald-700">
                      {ag.active_conversations_count || 0} ativas
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(ag)}
                  className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar Perfil & Foto</span>
                </button>

                {!isMe && (
                  <button
                    type="button"
                    onClick={() => requestDeleteAgent(ag)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Excluir Perfil de Consultor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* EDIT USER MODAL                                                       */}
      {/* ===================================================================== */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Editar Perfil de Atendente</h3>
                  <p className="text-xs text-slate-500">Mude o nome, foto de perfil e cargo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAgent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-5">
              {/* Photo & Avatar Customization */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Foto de Perfil do Atendente
                  </span>
                  {editAvatar && (
                    <button
                      type="button"
                      onClick={() => setEditAvatar('')}
                      className="text-[11px] text-rose-600 hover:underline font-medium"
                    >
                      Remover Foto
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    {editAvatar ? (
                      <img
                        src={editAvatar}
                        alt="Preview"
                        className="w-16 h-16 rounded-full object-cover ring-4 ring-emerald-500/20 shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xl flex items-center justify-center ring-4 ring-emerald-500/20 shadow-sm">
                        {editName ? editName.charAt(0) : 'U'}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-md transition-colors"
                      title="Fazer Upload de Foto"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      ref={editFileInputRef}
                      onChange={(e) => handleFileUpload(e, true)}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Fazer Upload do Computador</span>
                    </button>
                    <input
                      type="text"
                      placeholder="Ou cole a URL da imagem aqui..."
                      value={editAvatar}
                      onChange={(e) => setEditAvatar(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                {/* Preset Avatars Gallery */}
                <div className="pt-2 border-t border-slate-200/70">
                  <span className="text-[11px] text-slate-500 font-medium block mb-2">
                    Ou selecione uma foto profissional pronta:
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {PRESET_AVATARS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditAvatar(p.url)}
                        className={`relative rounded-full shrink-0 transition-transform hover:scale-105 ${
                          editAvatar === p.url ? 'ring-3 ring-emerald-500 ring-offset-2' : 'opacity-70 hover:opacity-100'
                        }`}
                        title={p.label}
                      >
                        <img
                          src={p.url}
                          alt={p.label}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                        {editAvatar === p.url && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px]">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Profile Details Form */}
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome Completo / Nome de Exibição *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: João Silva ou Consultor 1"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Este é o nome que aparecerá no chat antes das mensagens enviadas aos clientes.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail Institucional *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="ex: joao@realizzetravel.com.br"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cargo / Função
                    </label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="AGENT">Consultor(a) de Vendas</option>
                      <option value="SUPERVISOR">Supervisor(a)</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status Atual
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="ONLINE">🟢 Online</option>
                      <option value="BUSY">🟡 Ocupado</option>
                      <option value="OFFLINE">🔴 Offline</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Redefinir Senha de Acesso (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Deixe em branco para manter a senha atual"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Caso deseje alterar a senha deste consultor, digite a nova senha (mínimo 6 caracteres).
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                {currentUser?.id !== editingAgent.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      const toDelete = editingAgent;
                      setEditingAgent(null);
                      requestDeleteAgent(toDelete);
                    }}
                    className="px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Perfil</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingAgent(null)}
                    disabled={isSavingEdit}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    {isSavingEdit ? (
                      <span>Salvando...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Salvar Alterações</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CREATE USER MODAL                                                     */}
      {/* ===================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Novo Perfil de Atendente / Consultor</h3>
                  <p className="text-xs text-slate-500">Cadastre um novo membro da equipe RealizzeTravel</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="p-6 space-y-5">
              {/* Photo & Avatar Customization */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Foto de Perfil
                </span>

                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    {newAvatar ? (
                      <img
                        src={newAvatar}
                        alt="Preview"
                        className="w-16 h-16 rounded-full object-cover ring-4 ring-emerald-500/20 shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xl flex items-center justify-center ring-4 ring-emerald-500/20 shadow-sm">
                        {newName ? newName.charAt(0) : 'N'}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => createFileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-md transition-colors"
                      title="Fazer Upload de Foto"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      ref={createFileInputRef}
                      onChange={(e) => handleFileUpload(e, false)}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => createFileInputRef.current?.click()}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Fazer Upload do Computador</span>
                    </button>
                    <input
                      type="text"
                      placeholder="Ou cole a URL da imagem aqui..."
                      value={newAvatar}
                      onChange={(e) => setNewAvatar(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                {/* Preset Avatars Gallery */}
                <div className="pt-2 border-t border-slate-200/70">
                  <span className="text-[11px] text-slate-500 font-medium block mb-2">
                    Ou selecione uma foto profissional pronta:
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {PRESET_AVATARS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setNewAvatar(p.url)}
                        className={`relative rounded-full shrink-0 transition-transform hover:scale-105 ${
                          newAvatar === p.url ? 'ring-3 ring-emerald-500 ring-offset-2' : 'opacity-70 hover:opacity-100'
                        }`}
                        title={p.label}
                      >
                        <img
                          src={p.url}
                          alt={p.label}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                        {newAvatar === p.url && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px]">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Profile Details Form */}
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome Completo / Nome de Exibição *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Consultor 7 ou Ana Clara"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail Institucional *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="ex: consultor7@realizzetravel.com.br"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cargo / Função
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="AGENT">Consultor(a) de Vendas</option>
                      <option value="SUPERVISOR">Supervisor(a)</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Senha Provisória
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSavingCreate}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCreate}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {isSavingCreate ? (
                    <span>Criando...</span>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Cadastrar Perfil</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE PERFIL                           */}
      {/* ===================================================================== */}
      {deletingAgent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
                Excluir Perfil de Atendente
              </h3>
              <p className="text-xs text-slate-500 text-center mb-5">
                Esta ação é irreversível e removerá o acesso deste atendente ao sistema.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 flex items-center gap-3">
                {deletingAgent.avatar ? (
                  <img
                    src={deletingAgent.avatar}
                    alt={deletingAgent.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-xs"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center">
                    {deletingAgent.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 truncate">{deletingAgent.name}</p>
                  <p className="text-xs text-slate-500 truncate">{deletingAgent.email}</p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-200 text-slate-700">
                    {deletingAgent.role === 'ADMIN' ? 'Administrador' : deletingAgent.role === 'SUPERVISOR' ? 'Supervisor' : 'Consultor'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs mb-6 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  As conversas que estavam atribuídas a este consultor ficarão automaticamente livres na fila de atendimento para que outro atendente possa assumir.
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingAgent(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDeleteAgent}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Sim, Excluir Perfil</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
