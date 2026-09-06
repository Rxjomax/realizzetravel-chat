import { Request, Response, NextFunction } from 'express';
import { TokenPayload, verifyToken } from './jwt';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Acesso não autorizado. Token não fornecido.' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(403).json({ error: 'Sessão expirada ou token inválido. Faça login novamente.' });
    return;
  }

  // Normalize organization_id to org_realizzetravel
  if (!payload.organization_id || payload.organization_id === 'org_voolivre') {
    payload.organization_id = 'org_realizzetravel';
  }

  req.user = payload;
  next();
}

export function requireRole(allowedRoles: ('ADMIN' | 'SUPERVISOR' | 'AGENT')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Você não tem permissão para realizar esta operação.' });
      return;
    }

    next();
  };
}

// In-memory rate limiting against brute-force login attacks
interface AttemptRecord {
  count: number;
  blockedUntil: number;
}
const loginAttempts = new Map<string, AttemptRecord>();

export function checkLoginRateLimit(key: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record) {
    return { allowed: true };
  }

  if (record.blockedUntil > now) {
    const waitSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // Reset if expired
  if (record.blockedUntil > 0 && record.blockedUntil <= now) {
    loginAttempts.delete(key);
  }

  return { allowed: true };
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const record = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
  record.count += 1;

  // If 5 or more failed attempts, block for 2 minutes
  if (record.count >= 5) {
    record.blockedUntil = now + 2 * 60 * 1000;
  }

  loginAttempts.set(key, record);
}

export function resetLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}
