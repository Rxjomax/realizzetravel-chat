// Web Audio API Synthesizer and Native Notification Service
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem('realizzetravel_sound_enabled') ?? localStorage.getItem('voolivre_sound_enabled');
  return val === null ? true : val === 'true';
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('realizzetravel_sound_enabled', String(enabled));
}

export function playNotificationSound(type: 'new_ticket' | 'message' | 'alert' = 'message'): void {
  if (!isSoundEnabled()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'new_ticket') {
      // Ascending major chord (C5 -> E5 -> G5) for new customer arrival
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      osc.start(now);
      osc.stop(now + 0.45);
    } else {
      // Soft gentle two-tone chime for new chat message
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(880.0, now + 0.09);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch {
    // Audio playback error handled gracefully
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function sendDesktopNotification(
  title: string,
  options?: { body?: string; icon?: string; tag?: string; onClick?: () => void }
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const notif = new Notification(title, {
      body: options?.body,
      icon: options?.icon || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=96&h=96&fit=crop',
      tag: options?.tag || 'realizzetravel-chat',
    });

    if (options?.onClick) {
      notif.onclick = () => {
        window.focus();
        options.onClick?.();
        notif.close();
      };
    }
  } catch {
    // Notification error handled gracefully
  }
}
