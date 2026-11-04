import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY_SERVER_URL = '@evolve_server_url';

// URL predeterminada inteligente según plataforma
export const DEFAULT_SERVER_URL = Platform.select({
  android: 'http://192.168.78.209:3001', // IP local de tu PC para que funcione en dispositivos físicos y Expo Go
  ios: 'http://192.168.78.209:3001',
  default: 'http://localhost:3001',
});

let currentServerUrl = DEFAULT_SERVER_URL;

// Inicializar la URL desde AsyncStorage si existe
AsyncStorage.getItem(STORAGE_KEY_SERVER_URL).then((saved) => {
  if (saved && saved.trim()) {
    currentServerUrl = saved.trim();
  }
});

export function getServerUrl(): string {
  return currentServerUrl;
}

export async function setServerUrl(newUrl: string): Promise<void> {
  let cleaned = newUrl.trim();
  if (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  currentServerUrl = cleaned;
  await AsyncStorage.setItem(STORAGE_KEY_SERVER_URL, cleaned);
}

export async function checkServerHealth(customUrl?: string): Promise<{ ok: boolean; message: string }> {
  const url = customUrl || getServerUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${url}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return { ok: true, message: data.message || 'Servidor conectado' };
    }
    return { ok: false, message: `Error del servidor: ${res.status}` };
  } catch (err: any) {
    return {
      ok: false,
      message: err.name === 'AbortError' ? 'Tiempo de espera agotado' : 'No se pudo conectar con el servidor',
    };
  }
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    nickname?: string;
    provider: string;
    avatarUrl?: string;
    streak?: number;
    level?: number;
    rankTitle?: string;
    totalXp?: number;
    createdAt?: string;
  };
}

export async function apiRegister(payload: {
  email: string;
  password: string;
  name: string;
  nickname?: string;
  gender?: string;
  height?: number;
  birthDate?: string;
  age?: number;
}): Promise<AuthResponse & { userProfile?: any }> {
  const res = await fetch(`${getServerUrl()}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al registrar la cuenta.');
  }
  return data;
}

export async function apiForgotPassword(email: string): Promise<{
  success: boolean;
  message: string;
  email: string;
  resetCode?: string;
}> {
  const res = await fetch(`${getServerUrl()}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'No fue posible solicitar el código de recuperación.');
  }
  return data;
}

export async function apiResetPassword(payload: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${getServerUrl()}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'No fue posible restablecer la contraseña.');
  }
  return data;
}

export async function apiCheckNickname(
  nickname: string,
): Promise<{ available: boolean; nickname?: string; error?: string; message?: string }> {
  try {
    const clean = encodeURIComponent(nickname.trim().replace('@', ''));
    const res = await fetch(`${getServerUrl()}/api/auth/check-nickname?nickname=${clean}`, {
      method: 'GET',
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { available: false, error: err.message || 'Error de conexión' };
  }
}

export async function apiCheckEmail(
  email: string,
): Promise<{ exists: boolean; user?: any }> {
  try {
    const clean = encodeURIComponent(email.trim().toLowerCase());
    const res = await fetch(`${getServerUrl()}/api/auth/check-email?email=${clean}`, {
      method: 'GET',
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { exists: false };
  }
}

export async function apiLogin(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${getServerUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Credenciales inválidas.');
  }
  return data;
}

export interface SocialAuthResponse extends Partial<AuthResponse> {
  isNewUser?: boolean;
  message?: string;
  email?: string;
  name?: string;
  provider?: string;
  providerId?: string;
  avatarUrl?: string;
  userProfile?: any;
}

export async function apiSocialLogin(payload: {
  provider: 'google' | 'apple';
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}): Promise<SocialAuthResponse> {
  const res = await fetch(`${getServerUrl()}/api/auth/social`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al autenticar con proveedor social.');
  }
  return data;
}

export async function apiSocialRegister(payload: {
  provider: 'google' | 'apple';
  providerId?: string;
  email: string;
  name: string;
  nickname: string;
  gender?: string;
  height?: number;
  birthDate?: string;
  age?: number;
  avatarUrl?: string;
}): Promise<AuthResponse & { userProfile?: any }> {
  const res = await fetch(`${getServerUrl()}/api/auth/social-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al completar el registro del atleta.');
  }
  return data;
}

export async function apiGetMe(token: string): Promise<AuthResponse['user']> {
  const res = await fetch(`${getServerUrl()}/api/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Sesión no válida.');
  }
  return data.user;
}

export async function apiUpdateProfile(
  token: string,
  data: {
    name?: string;
    nickname?: string;
    avatarUrl?: string;
    streak?: number;
    level?: number;
    rankTitle?: string;
    totalXp?: number;
  },
): Promise<AuthResponse['user']> {
  const res = await fetch(`${getServerUrl()}/api/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || 'Error al actualizar perfil en el servidor.');
  }
  return body.user;
}

export async function apiSyncPush(
  token: string,
  records: Record<string, any>,
): Promise<{ success: boolean; syncedAt: string }> {
  const res = await fetch(`${getServerUrl()}/api/sync/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ records }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al sincronizar con el servidor.');
  }
  return data;
}

export async function apiSyncPull(token: string): Promise<Record<string, any>> {
  const res = await fetch(`${getServerUrl()}/api/sync/pull`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al obtener datos del servidor.');
  }
  return data.records || {};
}

/* ==========================================================
   MÓDULO SOCIAL & AMIGOS (BASE DE DATOS RELACIONAL)
========================================================== */

export interface DbUserItem {
  id: string;
  name: string;
  nickname: string;
  email: string;
  avatarUrl?: string;
  streak: number;
  level: number;
  rank: string;
  totalXp: number;
}

export async function apiGetUsers(token?: string, query?: string): Promise<DbUserItem[]> {
  const q = query ? `?q=${encodeURIComponent(query)}` : '';
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${getServerUrl()}/api/users${q}`, {
    method: 'GET',
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al buscar usuarios en el servidor.');
  }
  return data.users || [];
}

export async function apiGetUserFullProfile(
  targetIdOrNickname: string,
  token?: string,
): Promise<{ success: boolean; user: any; fullProfile: any }> {
  const clean = targetIdOrNickname.replace('@', '').trim();
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const timestamp = Date.now();
  const res = await fetch(`${getServerUrl()}/api/users/${encodeURIComponent(clean)}/full-profile?_t=${timestamp}`, {
    method: 'GET',
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al obtener perfil completo del usuario.');
  }
  return data;
}

export async function apiAddFriend(
  token: string,
  payload: { friendId?: string; friendNickname?: string },
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${getServerUrl()}/api/friends/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al agregar amigo.');
  }
  return data;
}

export async function apiSendFriendRequest(
  token: string,
  payload: { receiverNickname?: string; receiverId?: string; message?: string },
): Promise<{ success: boolean; request: any }> {
  const res = await fetch(`${getServerUrl()}/api/friends/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al enviar solicitud de amistad.');
  }
  return data;
}

export async function apiGetFriendRequests(token: string): Promise<{ received: any[]; sent: any[] }> {
  const res = await fetch(`${getServerUrl()}/api/friends/requests`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al obtener solicitudes de amistad.');
  }
  return data;
}

export async function apiRespondFriendRequest(
  token: string,
  requestId: string,
  accept: boolean,
): Promise<{ success: boolean; status: string }> {
  const res = await fetch(`${getServerUrl()}/api/friends/request/${requestId}/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ accept }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al responder a la solicitud de amistad.');
  }
  return data;
}

export async function apiGetFriends(token: string): Promise<{ friends: any[] }> {
  const res = await fetch(`${getServerUrl()}/api/friends`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al cargar lista de amigos.');
  }
  return data;
}

export async function apiRemoveFriend(token: string, friendId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${getServerUrl()}/api/friends/${friendId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al eliminar amigo.');
  }
  return data;
}

export async function apiSendWorkoutInvite(
  token: string,
  payload: {
    receiverId: string;
    workoutType: string;
    muscleDivision?: string;
    targetDate: string;
    targetTime: string;
    location?: string;
    note?: string;
  },
): Promise<{ success: boolean; invitation: any }> {
  const res = await fetch(`${getServerUrl()}/api/workouts/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al enviar invitación de entrenamiento.');
  }
  return data;
}

export async function apiRespondWorkoutInvite(
  token: string,
  inviteId: string,
  accept: boolean,
): Promise<{ success: boolean }> {
  const res = await fetch(`${getServerUrl()}/api/workouts/invite/${inviteId}/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ accept }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al responder invitación.');
  }
  return data;
}

export async function apiSendChallenge(
  token: string,
  payload: {
    receiverId: string;
    targetDate: string;
    variableType: string;
    variableLabel: string;
    muscleOrExercise?: string;
    message?: string;
  },
): Promise<{ success: boolean; challenge: any }> {
  const res = await fetch(`${getServerUrl()}/api/challenges`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al enviar reto de duelo.');
  }
  return data;
}

export async function apiRespondChallenge(
  token: string,
  challengeId: string,
  accept: boolean,
): Promise<{ success: boolean }> {
  const res = await fetch(`${getServerUrl()}/api/challenges/${challengeId}/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ accept }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al responder reto.');
  }
  return data;
}

export async function apiGetNotifications(token: string): Promise<{ notifications: any[] }> {
  const res = await fetch(`${getServerUrl()}/api/notifications`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al obtener notificaciones.');
  }
  return data;
}

export async function apiMarkNotificationsRead(
  token: string,
  notificationIds?: string[],
): Promise<{ success: boolean }> {
  const res = await fetch(`${getServerUrl()}/api/notifications/read`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ notificationIds }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al marcar notificaciones como leídas.');
  }
  return data;
}
