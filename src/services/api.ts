import { AuthResponse, Conversation, Customer, LoginCredentials, Message, User, UserStatus } from '../types';

const API_BASE = '/api';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('realizzetravel_token') || localStorage.getItem('voolivre_token');
  }

  public setToken(token: string | null): void {
    this.token = token;
    if (token) {
      localStorage.setItem('realizzetravel_token', token);
      localStorage.removeItem('voolivre_token');
    } else {
      localStorage.removeItem('realizzetravel_token');
      localStorage.removeItem('voolivre_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMessage = 'Ocorreu um erro ao processar sua solicitação.';
      try {
        const errorData = await res.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        errorMessage = `Erro ${res.status}: ${res.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return res.json();
  }

  // Auth Endpoints
  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(res.token);
    return res;
  }

  public async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  public async recoverPassword(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/recover-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Users Endpoints
  public async getUsers(): Promise<{ users: (User & { active_conversations_count?: number })[] }> {
    return this.request<{ users: (User & { active_conversations_count?: number })[] }>('/users');
  }

  public async updateUserStatus(userId: string, status: UserStatus): Promise<{ success: boolean; status: UserStatus }> {
    return this.request<{ success: boolean; status: UserStatus }>(`/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Conversations Endpoints
  public async getConversations(filter?: string, search?: string): Promise<{ conversations: Conversation[] }> {
    const params = new URLSearchParams();
    if (filter) params.append('filter', filter);
    if (search) params.append('search', search);
    return this.request<{ conversations: Conversation[] }>(`/conversations?${params.toString()}`);
  }

  public async getConversationDetails(id: string): Promise<{
    conversation: Conversation;
    messages: Message[];
    events: any[];
    notes: any[];
  }> {
    return this.request(`/conversations/${id}`);
  }

  public async assignConversation(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/conversations/${id}/assign`, {
      method: 'POST',
    });
  }

  public async sendMessage(
    conversationId: string,
    content: string,
    messageType: string = 'text',
    mediaUrl?: string
  ): Promise<{ message: Message }> {
    return this.request<{ message: Message }>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, messageType, mediaUrl }),
    });
  }

  public async transferConversation(
    conversationId: string,
    targetUserId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/conversations/${conversationId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId, reason }),
    });
  }

  public async closeConversation(conversationId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/conversations/${conversationId}/close`, {
      method: 'POST',
    });
  }

  public async reopenConversation(conversationId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/conversations/${conversationId}/reopen`, {
      method: 'POST',
    });
  }

  public async getMetrics(): Promise<{
    waitingCount: number;
    openCount: number;
    myCount: number;
    closedTodayCount: number;
    totalCustomersCount: number;
    avgResponseMinutes: number;
    avgHandleMinutes: number;
  }> {
    return this.request('/conversations/metrics/summary');
  }

  // Customers Endpoints
  public async getCustomers(search?: string): Promise<{ customers: Customer[] }> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    return this.request<{ customers: Customer[] }>(`/customers?${params.toString()}`);
  }

  public async updateCustomer(id: string, data: Partial<Customer>): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async addCustomerNote(customerId: string, content: string): Promise<{ note: any }> {
    return this.request<{ note: any }>(`/customers/${customerId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Simulation Endpoint for testing WhatsApp messages
  public async simulateWhatsAppMessage(data: { name: string; phone?: string; message: string }): Promise<{ success: boolean }> {
    return this.request('/webhooks/simulate-inbound', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Settings Endpoints
  public async getWhatsAppSettings(): Promise<{ config: {
    phoneNumberId: string;
    businessAccountId: string;
    accessToken: string;
    verifyToken: string;
    status: string;
  } }> {
    return this.request('/settings/whatsapp');
  }

  public async saveWhatsAppSettings(data: {
    phoneNumberId: string;
    businessAccountId: string;
    accessToken: string;
    verifyToken: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.request('/settings/whatsapp', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async getGeneralSettings(): Promise<{ settings: {
    agencyName: string;
    agencyPhone: string;
    agencyEmail: string;
    welcomeMessage: string;
    outOfHoursMessage: string;
    businessHoursStart: string;
    businessHoursEnd: string;
    businessDays: string[];
    queueMode: 'MANUAL' | 'AUTO_ROUND_ROBIN';
    soundAlertsEnabled: boolean;
    desktopNotificationsEnabled: boolean;
  } }> {
    return this.request('/settings/general');
  }

  public async saveGeneralSettings(data: any): Promise<{ success: boolean; message: string; settings: any }> {
    return this.request('/settings/general', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async updateMyProfile(data: {
    name?: string;
    avatar?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<{ success: boolean; message: string; user: User }> {
    return this.request('/users/profile/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiService();
