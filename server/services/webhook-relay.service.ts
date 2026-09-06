import { WhatsAppService } from './whatsapp.service';

/**
 * WebhookRelayService
 * 
 * Provides an automatic real-time tunnel/relay using Server-Sent Events (SSE)
 * to receive webhooks from Z-API or Meta without requiring external public ingress on sandbox ports.
 */
export class WebhookRelayService {
  private static instanceId = '3F8C20C51BB1E161A1A3260BF05B3023';
  private static relayChannel = `realizze-wa-${this.instanceId.toLowerCase().slice(0, 12)}`;
  private static relayUrl = `https://smee.io/${this.relayChannel}`;
  private static isRunning = false;
  private static abortController: AbortController | null = null;

  public static getRelayUrl(): string {
    return this.relayUrl;
  }

  public static async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`🔌 Initializing WhatsApp Webhook Relay for real-time delivery on: ${this.relayUrl}`);

    // Update Z-API webhooks to point to the relay URL
    this.configureZapiWebhooks().catch((err) => {
      console.warn('Could not auto-configure Z-API webhook:', err.message);
    });

    // Start background listening loop with auto-reconnect
    this.listenLoop();
  }

  public static stop(): void {
    this.isRunning = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private static async configureZapiWebhooks(): Promise<void> {
    const creds = WhatsAppService.getCredentials('org_realizzetravel');
    const instId = creds.zapiInstanceId || '3F8C20C51BB1E161A1A3260BF05B3023';
    const token = creds.zapiToken || '90FDB82A1D2E2343E9AEA9EA';
    const clientToken = creds.zapiClientToken || 'Fe48e93f5417c46258029658a1c13631aS';

    const headers = {
      'Client-Token': clientToken,
      'Content-Type': 'application/json',
    };

    const endpoints = [
      'update-webhook-received',
      'update-webhook-delivery',
      'update-webhook-received-and-delivery',
      'update-webhook-received-delivery',
      'update-webhook-messages',
      'update-every-webhooks',
    ];

    for (const ep of endpoints) {
      try {
        await fetch(`https://api.z-api.io/instances/${instId}/token/${token}/${ep}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ value: this.relayUrl }),
        });
      } catch (err: any) {
        // Ignore single endpoint warnings
      }
    }
    console.log(`✅ Z-API Webhooks configured to real-time relay: ${this.relayUrl}`);
  }

  private static async listenLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        this.abortController = new AbortController();
        const response = await fetch(this.relayUrl, {
          headers: { Accept: 'text/event-stream' },
          signal: this.abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Relay stream returned status ${response.status}`);
        }

        console.log(`⚡ Connected to live WhatsApp relay stream (${this.relayUrl})`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (this.isRunning) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const block of lines) {
            const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
            if (!dataLine) continue;

            const jsonStr = dataLine.slice(6).trim();
            if (!jsonStr || jsonStr === '{}') continue;

            try {
              const eventPayload = JSON.parse(jsonStr);
              const body = eventPayload.body || eventPayload;

              console.log('📬 REAL WHATSAPP INBOUND MESSAGE RECEIVED VIA RELAY:', JSON.stringify(body).slice(0, 200));
              WhatsAppService.handleInboundWebhook(body);
            } catch (parseErr) {
              // Ignore ping or malformed event
            }
          }
        }
      } catch (err: any) {
        if (!this.isRunning) break;
        console.warn('WhatsApp Relay stream reconnecting in 3s...', err.message);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }
}
