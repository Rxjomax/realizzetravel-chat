import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Plane, Eye, EyeOff, Lock, Mail, AlertCircle, CheckCircle2, ShieldCheck, Headphones, Compass } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsSubmitting(true);
    try {
      await login({ email, password, rememberMe });
    } catch (err) {
      // Error is caught and stored in auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('viagens123');
    clearError();
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSuccess('Um link de redefinição de senha foi enviado para o seu e-mail cadastrado.');
    setTimeout(() => {
      setForgotModalOpen(false);
      setForgotSuccess(null);
    }, 2800);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      <div className="w-full max-w-md z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 mb-3 shadow-xs">
            <Plane className="w-7 h-7 -rotate-45" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800">
            RealizzeTravel Viagens
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center justify-center gap-1.5">
            <Compass className="w-4 h-4 text-blue-600" />
            Central de Atendimento Multicanal WhatsApp
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="leading-snug">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* E-mail */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                E-mail corporativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) clearError();
                  }}
                  placeholder="ex: joao@realizzetravel.com.br"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-colors"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) clearError();
                  }}
                  placeholder="Digite sua senha"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none rounded-lg pl-10 pr-11 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Lembrar sessão */}
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500"
                />
                <span>Lembrar sessão neste dispositivo</span>
              </label>
            </div>

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-lg transition-colors shadow-xs flex items-center justify-center gap-2 text-sm"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <span>Entrar na Central</span>
              )}
            </button>
          </form>

          {/* Quick Demo Logins for fast testing of multiple attendants & roles */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2.5 text-center">
              Acesso rápido para testes de concorrência e perfis (senha: <code className="text-blue-600">viagens123</code>):
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@realizzetravel.com.br')}
                className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="truncate">
                  <div className="font-bold text-slate-800">Carlos (Admin)</div>
                  <div className="text-[10px] text-slate-500 truncate">admin@realizzetravel...</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('supervisor@realizzetravel.com.br')}
                className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="truncate">
                  <div className="font-bold text-slate-800">Renata (Superv.)</div>
                  <div className="text-[10px] text-slate-500 truncate">supervisor@...</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('joao@realizzetravel.com.br')}
                className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors flex items-center gap-2"
              >
                <Headphones className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="truncate">
                  <div className="font-bold text-slate-800">João (Atendente)</div>
                  <div className="text-[10px] text-slate-500 truncate">joao@realizzetravel...</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('maria@realizzetravel.com.br')}
                className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors flex items-center gap-2"
              >
                <Headphones className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="truncate">
                  <div className="font-bold text-slate-800">Maria (Atendente)</div>
                  <div className="text-[10px] text-slate-500 truncate">maria@realizzetravel...</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('pedro@realizzetravel.com.br')}
                className="col-span-2 p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors flex items-center gap-2 justify-center"
              >
                <Headphones className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-slate-800">Pedro Souza (Atendente 3)</span>
                  <span className="text-[11px] text-slate-500 ml-2">pedro@realizzetravel.com.br</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Recuperação de Senha */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Recuperação de Senha</h3>
            <p className="text-xs text-slate-500 mb-4">
              Informe seu e-mail cadastrado. Enviaremos as orientações para redefinir sua senha de acesso.
            </p>

            {forgotSuccess ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>{forgotSuccess}</div>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="ex: joao@realizzetravel.com.br"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    className="px-3.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 font-bold text-white rounded-lg shadow-xs"
                  >
                    Enviar Instruções
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
