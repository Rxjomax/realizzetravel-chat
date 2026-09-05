-- Organizations table for future SaaS multi-tenancy
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'BUSINESS',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Users table (Agents, Supervisors, Admins)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'SUPERVISOR', 'AGENT')),
  status TEXT NOT NULL DEFAULT 'OFFLINE' CHECK(status IN ('ONLINE', 'BUSY', 'OFFLINE')),
  avatar TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Customers table (Travel agency leads & travelers)
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  destination_interest TEXT,
  travel_date TEXT,
  passenger_count INTEGER DEFAULT 1,
  budget TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);

-- Conversations table (Queue, Assignment, State)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  assigned_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK(status IN ('WAITING', 'ASSIGNED', 'OPEN', 'CLOSED', 'TRANSFERRED')),
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  closed_by_user_id TEXT,
  last_message_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (closed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(last_message_at DESC);

-- Messages table (Customer, Agent, System with WhatsApp ID and media support)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK(sender_type IN ('CUSTOMER', 'AGENT', 'SYSTEM')),
  sender_id TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK(message_type IN ('text', 'image', 'video', 'audio', 'document')),
  content TEXT NOT NULL,
  media_url TEXT,
  whatsapp_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent', 'delivered', 'read', 'failed')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at ASC);

-- Conversation Events (assignment, transfer, close, reopen logs)
CREATE TABLE IF NOT EXISTS conversation_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT,
  event_type TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Customer Notes (Internal notes by agents regarding destinations, quotes, etc.)
CREATE TABLE IF NOT EXISTS customer_notes (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Key-value settings table (e.g. WhatsApp integration credentials)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, key),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Audit logs (Security & action history)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
