/**
 * Utilidades para Notificaciones Nativas del Celular / Navegador (Notification API + Service Worker)
 */

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Inicializa y registra el Service Worker para permitir notificaciones del sistema
 */
export async function initNotificationService(): Promise<void> {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('/sw.js');
    } catch (err) {
      console.warn('Error registrando Service Worker:', err);
    }
  }
}

/**
 * Solicita permiso al usuario para enviar notificaciones al celular / computadora
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return Notification.permission;
  }
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Envía una notificación nativa al teléfono (aparece en la barra de notificaciones del celular)
 */
export async function sendNativeNotification(
  title: string,
  options: {
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    requireInteraction?: boolean;
    data?: any;
    vibrate?: number[];
  }
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission !== 'granted') {
    // Intentar solicitar permiso si no fue otorgado antes
    const perm = await requestNotificationPermission();
    if (perm !== 'granted') return;
  }

  const notificationOptions: any = {
    body: options.body,
    tag: options.tag || 'restaurante-alerta',
    requireInteraction: options.requireInteraction ?? true, // Permanece visible hasta tocarla
    vibrate: options.vibrate || [500, 200, 500, 200, 800],
    data: options.data,
    silent: false,
  };

  try {
    // Método 1: Si hay Service Worker activo (recomendado para celulares Android y PWA)
    if (swRegistration && 'showNotification' in swRegistration) {
      await swRegistration.showNotification(title, notificationOptions as any);
      return;
    }

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notificationOptions as any);
        return;
      }
    }

    // Método 2: Instancia directa de Notification en navegador
    new Notification(title, notificationOptions);
  } catch (err) {
    console.warn('No se pudo mostrar la notificación nativa:', err);
    try {
      new Notification(title, { body: options.body });
    } catch {}
  }
}
