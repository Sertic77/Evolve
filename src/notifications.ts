import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const ALARM_CHANNEL_ID = 'evolve-supplement-alarms';

if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Entorno sin soporte nativo de handler
  }
}

/** Formatea una hora "HH:mm" (24h) a formato legible 12h (ej. "8:30 AM", "9:00 PM"). */
export function formatAlarmTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h24 = Math.max(0, Math.min(23, parseInt(hStr || '8', 10) || 0));
  const min = Math.max(0, Math.min(59, parseInt(mStr || '0', 10) || 0));
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${period}`;
}

/** Convierte una cadena "HH:mm" (o por defecto 08:00) a componentes de 12h y 24h. */
export function parseAlarmTime(hhmm?: string): {
  hour24: number;
  minute: number;
  hour12: number;
  period: 'AM' | 'PM';
} {
  if (!hhmm) {
    return { hour24: 8, minute: 0, hour12: 8, period: 'AM' };
  }
  const [hStr, mStr] = hhmm.split(':');
  const hour24 = Math.max(0, Math.min(23, parseInt(hStr || '8', 10) || 0));
  const minute = Math.max(0, Math.min(59, parseInt(mStr || '0', 10) || 0));
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour24, minute, hour12, period };
}

/** Convierte hora 12h (1-12), minuto (0-59) y AM/PM a cadena 24h "HH:mm". */
export function toAlarmTime24h(
  hour12: number,
  minute: number,
  period: 'AM' | 'PM',
): { hhmm: string; hour24: number; minute: number } {
  const cleanH12 = Math.max(1, Math.min(12, Math.round(hour12 || 12)));
  const cleanMin = Math.max(0, Math.min(59, Math.round(minute || 0)));
  let hour24 = cleanH12 % 12;
  if (period === 'PM') {
    hour24 += 12;
  }
  const hhmm = `${String(hour24).padStart(2, '0')}:${String(cleanMin).padStart(2, '0')}`;
  return { hhmm, hour24, minute: cleanMin };
}

/** Cancela de forma segura una alarma diaria previamente programada. */
export async function cancelSupplementDailyAlarm(notificationId?: string): Promise<void> {
  if (!notificationId || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Si ya no existía en el sistema operativo, ignoramos el error
  }
}

/** Programa una alarma local diaria para recordar tomar un suplemento. */
export async function scheduleSupplementDailyAlarm(params: {
  supplementId: string;
  supplementName: string;
  hour: number;
  minute: number;
  soundId?: string;
  previousNotificationId?: string;
}): Promise<{ notificationId?: string; permissionDenied?: boolean }> {
  if (params.previousNotificationId) {
    await cancelSupplementDailyAlarm(params.previousNotificationId);
  }

  if (Platform.OS === 'web') {
    return { notificationId: undefined };
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return { permissionDenied: true };
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
        name: 'Alarmas de Suplementos',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300],
        lightColor: '#8B5CF6',
        sound: 'default',
        enableVibrate: true,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
        },
      });
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ Suplemento: ${params.supplementName}`,
        body: `Es hora de tomar ${params.supplementName}. ¡No olvides marcar tu toma del día!`,
        sound: 'default',
        data: { supplementId: params.supplementId, soundId: params.soundId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: params.hour,
        minute: params.minute,
        channelId: ALARM_CHANNEL_ID,
        delivery: 'alarmClock',
      },
    });

    return { notificationId };
  } catch {
    return { notificationId: undefined };
  }
}
