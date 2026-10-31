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
    createdAt?: string;
  };
}

export async function apiRegister(payload: {
  email: string;
  password: string;
  name: string;
  nickname?: string;
}): Promise<AuthResponse> {
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

export async function apiSocialLogin(payload: {
  provider: 'google' | 'apple';
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}): Promise<AuthResponse> {
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
  data: { name?: string; nickname?: string; avatarUrl?: string },
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
