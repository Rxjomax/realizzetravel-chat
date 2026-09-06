import { Conversation, Customer, Message, User, WhatsAppGroup } from '../types';

export const USERS_STORAGE_KEY = 'realizzetravel_users';

export function loadStoredUsers(): User[] {
  if (typeof window === 'undefined') return [...DEMO_USERS];
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return [...DEMO_USERS];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // fallback to demo users
  }
  return [...DEMO_USERS];
}

export function saveStoredUsers(users: User[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('Falha ao salvar usuários no localStorage', e);
  }
}

export const DEMO_USERS: User[] = [
  {
    id: 'usr_admin',
    organization_id: 'org_realizzetravel',
    name: 'Carlos Santos (Administrador)',
    email: 'admin@realizzetravel.com.br',
    role: 'ADMIN',
    status: 'ONLINE',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=face',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  },
  {
    id: 'usr_supervisor',
    organization_id: 'org_realizzetravel',
    name: 'Renata Lima (Supervisora)',
    email: 'supervisor@realizzetravel.com.br',
    role: 'SUPERVISOR',
    status: 'ONLINE',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&h=120&fit=crop&crop=face',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  },
  {
    id: 'usr_joao',
    organization_id: 'org_realizzetravel',
    name: 'Consultor 1 (João Silva)',
    email: 'consultor1@realizzetravel.com.br',
    role: 'AGENT',
    status: 'ONLINE',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop&crop=face',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  },
  {
    id: 'usr_maria',
    organization_id: 'org_realizzetravel',
    name: 'Consultor 2 (Maria Oliveira)',
    email: 'consultor2@realizzetravel.com.br',
    role: 'AGENT',
    status: 'ONLINE',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=face',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  },
  {
    id: 'usr_pedro',
    organization_id: 'org_realizzetravel',
    name: 'Consultor 3 (Pedro Souza)',
    email: 'consultor3@realizzetravel.com.br',
    role: 'AGENT',
    status: 'ONLINE',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&h=120&fit=crop&crop=face',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  },
  {
    id: 'usr_anapaula',
    organization_id: 'org_realizzetravel',
    name: 'Consultor 4 (Ana Paula)',
    email: 'consultor4@realizzetravel.com.br',
    role: 'AGENT',
    status: 'ONLINE',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=face',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  },
  {
    id: 'usr_lucas',
    organization_id: 'org_realizzetravel',
    name: 'Consultor 5 (Lucas Ferreira)',
    email: 'consultor5@realizzetravel.com.br',
    role: 'AGENT',
    status: 'ONLINE',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  },
  {
    id: 'usr_beatriz',
    organization_id: 'org_realizzetravel',
    name: 'Consultor 6 (Beatriz Costa)',
    email: 'consultor6@realizzetravel.com.br',
    role: 'AGENT',
    status: 'ONLINE',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop&crop=face',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  },
];

export const DEMO_CUSTOMERS: Customer[] = [];
export const DEMO_CONVERSATIONS: Conversation[] = [];
export const DEMO_MESSAGES: Record<string, Message[]> = {};
export const DEMO_WHATSAPP_GROUPS: WhatsAppGroup[] = [];
