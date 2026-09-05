export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT';
export type UserStatus = 'ONLINE' | 'BUSY' | 'OFFLINE';

export type ConversationStatus = 'WAITING' | 'ASSIGNED' | 'OPEN' | 'CLOSED' | 'TRANSFERRED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type SenderType = 'CUSTOMER' | 'AGENT' | 'SYSTEM';
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface User {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  created_at: string;
  updated_at: string;
  last_seen_at?: string;
}

export interface Customer {
  id: string;
  organization_id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  destination_interest?: string;
  travel_date?: string;
  passenger_count?: number;
  budget?: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  organization_id: string;
  customer_id: string;
  assigned_user_id?: string | null;
  status: ConversationStatus;
  priority: Priority;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  closed_by_user_id?: string | null;
  last_message_at: string;
  // Joined relation fields for UI
  customer?: Customer;
  assigned_user?: User | null;
  unread_count?: number;
  last_message?: Message;
}

export interface Message {
  id: string;
  organization_id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id: string;
  message_type: MessageType;
  content: string;
  media_url?: string | null;
  whatsapp_message_id?: string | null;
  status: MessageStatus;
  created_at: string;
}

export interface ConversationEvent {
  id: string;
  conversation_id: string;
  user_id?: string | null;
  event_type: 'CREATED' | 'ASSIGNED' | 'TRANSFERRED' | 'CLOSED' | 'REOPENED' | 'NOTE_ADDED';
  metadata?: string | null;
  created_at: string;
  user?: User;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: User;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id?: string | null;
  action: string;
  metadata?: string | null;
  created_at: string;
  user_name?: string;
}

export interface WhatsAppConfig {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  verifyToken: string;
  status: 'CONNECTED' | 'DISCONNECTED';
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}
