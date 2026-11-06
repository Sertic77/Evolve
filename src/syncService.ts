import { AppState, AppStateStatus } from 'react-native';
import { useStore } from './store';
import {
  apiSyncPush,
  apiSyncPull,
  apiUpdateProfile,
  apiGetFriends,
  apiGetNotifications,
  apiGetFriendRequests,
} from './api';

let syncTimeout: any = null;
let isSyncing = false;
let isInitialized = false;

// Llaves de datos del usuario que se deben guardar en la base de datos (UserData)
export const USER_DATA_SYNC_KEYS = [
  'goals',
  'ingredients',
  'savedMeals',
  'logs',
  'exercises',
  'workoutLogs',
  'measurementLogs',
  'weightLogs',
  'bodyFatLogs',
  'photoLogs',
  'supplements',
  'supplementLogs',
  'healthMetrics',
  'healthLogs',
  'sleepLogs',
  'userProfile',
  'privacySettings',
  'sentWorkoutInvites',
  'sentChallenges',
  'pendingSentRequestUserIds',
  'activePaletteId',
  'customPalettes',
  'deletedPaletteIds',
  'typography',
  'homeWidgets',
] as const;

/**
 * Extrae toda la data y configuraciones del usuario desde el estado para la BD
 */
export function extractUserDataForDb(state: any): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const key of USER_DATA_SYNC_KEYS) {
    if (state[key] !== undefined) {
      payload[key] = state[key];
    }
  }
  return payload;
}

/**
 * Empuja toda la información del usuario a la base de datos de manera inmediata
 */
export async function pushUserDataToDatabase(): Promise<{ success: boolean; error?: string }> {
  const state = useStore.getState();
  const token = state.authToken;

  if (!token || !state.isAuthenticated) {
    return { success: false, error: 'No autenticado' };
  }

  try {
    state.setSyncStatus('syncing');
    const records = extractUserDataForDb(state);

    const res = await apiSyncPush(token, records);

    // Si el perfil cambió, actualizamos también la tabla principal User
    if (state.userProfile?.name || state.userProfile?.nickname) {
      try {
        await apiUpdateProfile(token, {
          name: state.userProfile.name,
          nickname: state.userProfile.nickname,
        });
      } catch (profileErr) {
        // Silencioso si falla la tabla auxiliar de perfil
        console.warn('Advertencia al sincronizar perfil en User:', profileErr);
      }
    }

    state.setSyncStatus('saved', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    return { success: true };
  } catch (err: any) {
    console.error('Error al guardar datos en la base de datos:', err);
    state.setSyncStatus('error', undefined, err.message || 'Error de conexión');
    return { success: false, error: err.message };
  }
}

/**
 * Sincroniza amigos y notificaciones relacionales directamente desde la base de datos
 */
export async function syncSocialFromDatabase(customToken?: string): Promise<void> {
  const state = useStore.getState();
  const token = customToken || state.authToken;

  if (!token || !state.isAuthenticated) return;

  try {
    const [friendsRes, notifsRes, reqsRes] = await Promise.allSettled([
      apiGetFriends(token),
      apiGetNotifications(token),
      apiGetFriendRequests(token),
    ]);

    if (friendsRes.status === 'fulfilled' && Array.isArray(friendsRes.value?.friends)) {
      state.setFriendsFromDb(friendsRes.value.friends);
    }

    if (notifsRes.status === 'fulfilled' && Array.isArray(notifsRes.value?.notifications)) {
      state.setNotificationsFromDb(notifsRes.value.notifications);
    }

    if (reqsRes.status === 'fulfilled' && Array.isArray(reqsRes.value?.sent)) {
      const activePending: string[] = [];
      reqsRes.value.sent.forEach((r: any) => {
        if (r.receiver?.id) activePending.push(r.receiver.id);
        if (r.receiver?.nickname) {
          const clean = r.receiver.nickname.startsWith('@') ? r.receiver.nickname : `@${r.receiver.nickname}`;
          activePending.push(clean);
          activePending.push(r.receiver.nickname);
        }
      });
      state.setPendingSentRequestUserIds(activePending);
    }
  } catch (err) {
    console.warn('Advertencia al sincronizar datos sociales de la base de datos:', err);
  }
}

/**
 * Descarga y sincroniza toda la data del usuario desde la base de datos
 */
export async function pullUserDataFromDatabase(): Promise<{ success: boolean; count: number; error?: string }> {
  const state = useStore.getState();
  const token = state.authToken;

  if (!token || !state.isAuthenticated) {
    return { success: false, count: 0, error: 'No autenticado' };
  }

  try {
    state.setSyncStatus('syncing');
    const records = await apiSyncPull(token);
    const keysCount = Object.keys(records || {}).length;

    if (keysCount > 0) {
      // El usuario ya tiene datos en la BD: aplicamos su información
      state.applyRemoteData(records);
      state.setSyncStatus('saved', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } else {
      // Es un usuario nuevo o sin registros previos en BD: inicializamos su BD con el estado actual
      await pushUserDataToDatabase();
    }

    // Sincronizar además relaciones de amigos y notificaciones
    await syncSocialFromDatabase(token);

    return { success: true, count: keysCount };
  } catch (err: any) {
    console.error('Error al descargar datos de la base de datos:', err);
    state.setSyncStatus('error', undefined, err.message || 'Error de conexión');
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Programa una sincronización con debounce para no saturar la base de datos
 */
export function scheduleDebouncedSync(delayMs = 1500) {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(async () => {
    syncTimeout = null;
    if (isSyncing) return;
    isSyncing = true;
    try {
      await pushUserDataToDatabase();
    } finally {
      isSyncing = false;
    }
  }, delayMs);
}

/**
 * Fuerza el guardado inmediato si hay cambios pendientes
 */
export async function flushPendingSync() {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
    await pushUserDataToDatabase();
  }
}

/**
 * Inicializa el observador de cambios global para auto-sincronizar con la BD
 */
export function initSyncService() {
  if (isInitialized) return;
  isInitialized = true;

  let lastSerialized = '';
  try {
    const s = useStore.getState();
    if (s.isAuthenticated && s.authToken) {
      lastSerialized = JSON.stringify(extractUserDataForDb(s));
    }
  } catch {}

  // Escucha cambios en el estado de Zustand
  useStore.subscribe((state) => {
    if (!state.isAuthenticated || !state.authToken) {
      lastSerialized = '';
      return;
    }

    try {
      const currentData = extractUserDataForDb(state);
      const serialized = JSON.stringify(currentData);

      if (serialized !== lastSerialized) {
        lastSerialized = serialized;
        // Hubo cambios reales en la información del usuario -> auto-sincronizar de inmediato a la BD
        scheduleDebouncedSync(350);
      }
    } catch (e) {
      // Ignorar error de serialización
    }
  });

  // Guardar inmediatamente si el usuario minimiza la app o recargar datos si vuelve
  AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      flushPendingSync();
    } else if (nextAppState === 'active') {
      const s = useStore.getState();
      if (s.isAuthenticated && s.authToken) {
        syncSocialFromDatabase();
      }
    }
  });

  // Carga inicial social de la base de datos
  syncSocialFromDatabase();

  // Polling recurrente de relaciones sociales cada 10 segundos para mantener amigos y solicitudes en tiempo real
  setInterval(() => {
    const s = useStore.getState();
    if (s.isAuthenticated && s.authToken) {
      syncSocialFromDatabase();
    }
  }, 10000);
}
