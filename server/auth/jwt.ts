import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'realizzetravel-viagens-super-secret-jwt-key-2026';
const LEGACY_JWT_SECRET = 'voolivre-viagens-super-secret-jwt-key-2026';

export interface TokenPayload {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'AGENT';
}

export function generateToken(payload: TokenPayload, rememberMe = false): string {
  const expiresIn = rememberMe ? '30d' : '24h';
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): TokenPayload | null {
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
