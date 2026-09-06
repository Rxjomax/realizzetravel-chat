import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '../auth/jwt';
import { dbRun } from '../db/database';

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  organizationId?: string;
  isAlive: boolean;
}

let wss: WebSocketServer | null = null;
const clients = new Set<ClientConnection>();

export function initWebSocketServer(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const host = request.headers.host || 'localhost:3000';
      const url = new URL(request.url || '', `http://${host}`);
      if (url.pathname === '/ws' || url.pathname === '/ws/') {
        wss!.handleUpgrade(request, socket, head, (ws) => {
          wss!.emit('connection', ws, request);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, req) => {
    const client: ClientConnection = {
      ws,
      isAlive: true,
    };
    clients.add(client);

    // Safely extract token from query string or headers
    let token: string | null = null;
    try {
      const host = req.headers.host || 'localhost:3000';
      const url = new URL(req.url || '', `http://${host}`);
      token = url.searchParams.get('token');
    } catch {
      token = null;
    }

    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        client.userId = payload.id;
        client.organizationId = payload.organization_id;

        // Update last seen
        try {
          dbRun('UPDATE users SET last_seen_at = ?, status = ? WHERE id = ?', [
            new Date().toISOString(),
            'ONLINE',
            client.userId,
          ]);
          broadcastAttendantsList();
        } catch (e) {
          console.warn('Notice updating user presence on WS connect:', e);
        }
      }
    }

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle client auth after connection
        if (message.type === 'auth' && message.token) {
          const payload = verifyToken(message.token);
          if (payload) {
            client.userId = payload.id;
            client.organizationId = payload.organization_id;
            ws.send(JSON.stringify({ type: 'auth:success', userId: payload.id }));
            broadcastAttendantsList();
          } else {
            ws.send(JSON.stringify({ type: 'auth:error', error: 'Invalid token' }));
          }
        }

        // Handle ping
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(client);
      if (client.userId) {
        try {
          dbRun('UPDATE users SET last_seen_at = ? WHERE id = ?', [
            new Date().toISOString(),
            client.userId,
          ]);
          broadcastAttendantsList();
        } catch (e) {
          console.error('Error updating presence on WS close:', e);
        }
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket client error:', err);
      clients.delete(client);
    });
  });

  // Heartbeat ping interval
  const pingInterval = setInterval(() => {
    for (const client of clients) {
      if (!client.isAlive) {
        client.ws.terminate();
        clients.delete(client);
        continue;
      }
      client.isAlive = false;
      client.ws.ping();
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  console.log('⚡ WebSocket server initialized on path /ws');
  return wss;
}

export function broadcastEvent(
  eventType: string,
  payload: any,
  organizationId?: string,
  excludeUserId?: string
): void {
  if (!wss) return;

  const data = JSON.stringify({
    type: eventType,
    payload,
    timestamp: new Date().toISOString(),
  });

  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (organizationId && client.organizationId) {
        const isDefaultOrgA = client.organizationId === 'org_realizzetravel' || client.organizationId === 'org_voolivre';
        const isDefaultOrgB = organizationId === 'org_realizzetravel' || organizationId === 'org_voolivre';
        if (!(isDefaultOrgA && isDefaultOrgB) && client.organizationId !== organizationId) {
          continue;
        }
      }
      if (excludeUserId && client.userId === excludeUserId) {
        continue;
      }
      client.ws.send(data);
    }
  }
}

export function broadcastAttendantsList(): void {
  // Let clients know attendant presences have updated
  broadcastEvent('attendants:updated', { timestamp: Date.now() });
}
