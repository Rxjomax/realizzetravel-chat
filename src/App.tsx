import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { AppShell } from './components/layout/AppShell';
import { DashboardView } from './components/dashboard/DashboardView';
import { ChatDeskView } from './components/chat/ChatDeskView';
import { CustomersView } from './components/customers/CustomersView';
import { ReportsView } from './components/reports/ReportsView';
import { AgentsView } from './components/agents/AgentsView';
import { WhatsAppConfigView } from './components/whatsapp/WhatsAppConfigView';
import { SettingsView } from './components/settings/SettingsView';
import { Plane } from 'lucide-react';

const MainContent: React.FC = () => {
  const { user, updateUser, isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 animate-pulse">
          <Plane className="w-6 h-6 -rotate-45" />
        </div>
        <div className="text-sm font-medium text-slate-300">Carregando Central de Atendimento...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  const renderView = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardView onNavigateToChat={() => setCurrentTab('chat')} />;
      case 'chat':
        return <ChatDeskView />;
      case 'customers':
        return <CustomersView />;
      case 'reports':
        return <ReportsView />;
      case 'agents':
        return <AgentsView />;
      case 'whatsapp':
        return <SettingsView currentUser={user} onUserUpdated={updateUser} initialTab="whatsapp" onNavigateToChat={() => setCurrentTab('chat')} />;
      case 'settings':
        return <SettingsView currentUser={user} onUserUpdated={updateUser} initialTab="general" onNavigateToChat={() => setCurrentTab('chat')} />;
      default:
        return <DashboardView onNavigateToChat={() => setCurrentTab('chat')} />;
    }
  };

  return (
    <AppShell currentTab={currentTab} onTabChange={setCurrentTab}>
      {renderView()}
    </AppShell>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
