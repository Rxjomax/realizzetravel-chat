import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'realizzetravel-viagens-super-secret-jwt-key-2026';
const LEGACY_JWT_SECRET = 'voolivre-viagens-super-secret-jwt-key-2026';

export interface TokenPayload {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'AGENT';
  avatar?: string;
}

export function generateToken(payload: TokenPayload, rememberMe = false): string {
  const expiresIn = rememberMe ? '30d' : '24h';
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): TokenPayload | null {
  // Support demo tokens seamlessly
  if (token.startsWith('demo_token_')) {
    const parts = token.split('_');
    const userId = parts[2] ? `usr_${parts[2].replace('usr_', '')}` : 'usr_admin';
    const isAdmin = userId.includes('admin');
    const isSupervisor = userId.includes('supervisor');
    return {
      id: userId,
      organization_id: 'org_realizzetravel',
      email: isAdmin ? 'admin@realizzetravel.com.br' : isSupervisor ? 'supervisor@realizzetravel.com.br' : 'consultor1@realizzetravel.com.br',
      name: isAdmin ? 'Carlos Santos (Administrador)' : isSupervisor ? 'Renata Lima (Supervisora)' : 'Consultor 1 (João Silva)',
      role: isAdmin ? 'ADMIN' : isSupervisor ? 'SUPERVISOR' : 'AGENT',
    };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (err) {
    try {
      // Backwards compatibility for legacy tokens
      const decodedLegacy = jwt.verify(token, LEGACY_JWT_SECRET) as TokenPayload;
      return decodedLegacy;
    } catch {
      return null;
    }
  }
}
