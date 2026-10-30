import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

export type AlarmSoundOption = {
  id: string;
  name: string;
  description: string;
  icon: string;
  emoji: string;
};

export const ALARM_SOUNDS: AlarmSoundOption[] = [
  {
    id: 'alarma-clasica',
    name: 'Alarma Clásica',
    description: 'Beeps digitales rítmicos y enérgicos',
    icon: 'alarm-outline',
    emoji: '⏰',
  },
  {
    id: 'campana-zen',
    name: 'Campana Zen',
    description: 'Armónicos suaves tipo cuenco tibetano',
    icon: 'notifications-outline',
    emoji: '🔔',
  },
  {
    id: 'melodia-suave',
    name: 'Melodía Suave',
    description: 'Arpegio cálido y melodioso',
    icon: 'musical-notes-outline',
    emoji: '🎵',
  },
  {
    id: 'pulso-activo',
    name: 'Pulso Activo',
    description: 'Tono dinámico y motivador',
    icon: 'flash-outline',
    emoji: '⚡',
  },
  {
    id: 'onda-cristal',
    name: 'Onda Cristalina',
    description: 'Timbre brillante y campanillas',
    icon: 'sparkles-outline',
    emoji: '✨',
  },
];

export function getAlarmSoundById(id?: string): AlarmSoundOption {
  return (
    ALARM_SOUNDS.find((s) => s.id === id) ||
    ALARM_SOUNDS[0]
  );
}

// Genera muestras de audio PCM mono de 22.05 kHz para cada tono de alarma
function synthesizeSoundSamples(soundId: string, sampleRate = 22050): Float32Array {
  let duration = 2.0;
  if (soundId === 'alarma-clasica') duration = 1.8;
  if (soundId === 'campana-zen') duration = 2.4;
  if (soundId === 'melodia-suave') duration = 2.0;
  if (soundId === 'pulso-activo') duration = 1.8;
  if (soundId === 'onda-cristal') duration = 2.2;

  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let s = 0;

    if (soundId === 'alarma-clasica') {
      // 4 beeps rápidos, pausa breve y 4 beeps
      const burst = t < 0.8 ? t : t >= 1.0 && t < 1.8 ? t - 1.0 : -1;
      if (burst >= 0) {
        const beepIdx = Math.floor(burst / 0.18);
        const beepTime = burst % 0.18;
        if (beepIdx < 4 && beepTime < 0.11) {
          const env = Math.sin((beepTime / 0.11) * Math.PI);
          s =
            (Math.sin(2 * Math.PI * 1046.5 * t) * 0.8 +
              Math.sin(2 * Math.PI * 2093 * t) * 0.2) *
            env;
        }
      }
    } else if (soundId === 'campana-zen') {
      // Cuenco tibetano / campana de meditación
      const env = Math.exp(-t * 1.7);
      const tremolo = 1 + 0.12 * Math.sin(2 * Math.PI * 2.5 * t);
      s =
        (Math.sin(2 * Math.PI * 528 * t) * 0.6 +
          Math.sin(2 * Math.PI * 1056 * t) * 0.25 +
          Math.sin(2 * Math.PI * 1584 * t) * 0.12 +
          Math.sin(2 * Math.PI * 2112 * t) * 0.05) *
        env *
        tremolo;
    } else if (soundId === 'melodia-suave') {
      // Arpegio ascendente suave
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5];
      for (let n = 0; n < notes.length; n++) {
        const noteStart = n * 0.2;
        if (t >= noteStart) {
          const dt = t - noteStart;
          const noteEnv = Math.exp(-dt * 2.5);
          s +=
            (Math.sin(2 * Math.PI * notes[n] * dt) * 0.4 +
              Math.sin(2 * Math.PI * notes[n] * 2 * dt) * 0.1) *
            noteEnv;
        }
      }
      s = s * 0.6;
    } else if (soundId === 'pulso-activo') {
      // Tono pulsante motivador
      const notes = [440, 554.37, 659.25, 880];
      const cycle = t % 0.45;
      const idx = Math.min(notes.length - 1, Math.floor(t / 0.45));
      if (cycle < 0.28) {
        const env = Math.sin((cycle / 0.28) * Math.PI);
        const freq = notes[idx];
        s =
          (Math.sin(2 * Math.PI * freq * t) * 0.7 +
            Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.2 +
            Math.sin(2 * Math.PI * freq * 2 * t) * 0.1) *
          env;
      }
    } else {
      // onda-cristal: timbre brillante con armónicos de cristal
      const env = Math.exp(-t * 2.0);
      const shimmer = Math.sin(2 * Math.PI * 6 * t) * 0.1;
      s =
        (Math.sin(2 * Math.PI * 880 * t) * 0.5 +
          Math.sin(2 * Math.PI * 1320 * t) * 0.3 +
          Math.sin(2 * Math.PI * 2640 * t) * 0.15 +
          Math.sin(2 * Math.PI * 3520 * t) * 0.08) *
        env *
        (1 + shimmer);
    }

    samples[i] = Math.max(-1, Math.min(1, s));
  }
  return samples;
}

// Convierte muestras Float32 a archivo WAV base64
function samplesToWavBase64(samples: Float32Array, sampleRate = 22050): string {
  const numSamples = samples.length;
  const byteRate = sampleRate * 2;
  const blockAlign = 2;
  const subChunk2Size = numSamples * 2;
  const chunkSize = 36 + subChunk2Size;

  const totalBytes = 44 + subChunk2Size;
  const uint8 = new Uint8Array(totalBytes);
  const view = new DataView(uint8.buffer);

  // RIFF chunk
  writeAscii(uint8, 0, 'RIFF');
  view.setUint32(4, chunkSize, true);
  writeAscii(uint8, 8, 'WAVE');

  // fmt chunk
  writeAscii(uint8, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM SubChunk1Size
  view.setUint16(20, 1, true); // PCM Format = 1
  view.setUint16(22, 1, true); // Mono = 1
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16 bits per sample

  // data chunk
  writeAscii(uint8, 36, 'data');
  view.setUint32(40, subChunk2Size, true);

  // PCM samples (signed 16-bit little endian)
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const int16 = s < 0 ? Math.floor(s * 32768) : Math.floor(s * 32767);
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return uint8ToBase64(uint8);
}

function writeAscii(target: Uint8Array, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    target[offset + i] = str.charCodeAt(i);
  }
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function uint8ToBase64(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.length;
  let i = 0;

  for (; i + 2 < len; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    result +=
      B64_CHARS[a >> 2] +
      B64_CHARS[((a & 3) << 4) | (b >> 4)] +
      B64_CHARS[((b & 15) << 2) | (c >> 6)] +
      B64_CHARS[c & 63];
  }

  if (i < len) {
    const a = bytes[i];
    if (i + 1 < len) {
      const b = bytes[i + 1];
      result +=
        B64_CHARS[a >> 2] +
        B64_CHARS[((a & 3) << 4) | (b >> 4)] +
        B64_CHARS[(b & 15) << 2] +
        '=';
    } else {
      result += B64_CHARS[a >> 2] + B64_CHARS[(a & 3) << 4] + '==';
    }
  }

  return result;
}

// Cache en memoria y en disco de los archivos WAV
const wavBase64Cache = new Map<string, string>();
const wavFilePathCache = new Map<string, string>();

export function getSoundWavBase64(soundId: string): string {
  const cached = wavBase64Cache.get(soundId);
  if (cached) return cached;
  const samples = synthesizeSoundSamples(soundId);
  const b64 = samplesToWavBase64(samples);
  wavBase64Cache.set(soundId, b64);
  return b64;
}

export async function ensureSoundWavFile(soundId: string): Promise<string> {
  const cached = wavFilePathCache.get(soundId);
  if (cached) return cached;

  if (Platform.OS === 'web') {
    const b64 = getSoundWavBase64(soundId);
    return `data:audio/wav;base64,${b64}`;
  }

  try {
    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    const filePath = `${baseDir}evolve_alarm_${soundId}.wav`;

    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) {
      const b64 = getSoundWavBase64(soundId);
      await FileSystem.writeAsStringAsync(filePath, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    wavFilePathCache.set(soundId, filePath);
    return filePath;
  } catch (err) {
    // Si falla el acceso a filesystem, regresamos URI de base64
    const b64 = getSoundWavBase64(soundId);
    return `data:audio/wav;base64,${b64}`;
  }
}

// Reproductor activo
let activeNativePlayer: AudioPlayer | null = null;
let activeHtmlAudio: any = null;
let currentPlayingSoundId: string | null = null;
let soundStopTimeout: any = null;

export function isAlarmSoundPlaying(): boolean {
  return Boolean(currentPlayingSoundId);
}

export function getCurrentPlayingSoundId(): string | null {
  return currentPlayingSoundId;
}

/** Detiene cualquier sonido de alarma que se esté reproduciendo actualmente */
export async function stopAlarmSound(): Promise<void> {
  if (soundStopTimeout) {
    clearTimeout(soundStopTimeout);
    soundStopTimeout = null;
  }

  if (activeHtmlAudio) {
    try {
      activeHtmlAudio.pause();
      activeHtmlAudio.currentTime = 0;
    } catch {}
    activeHtmlAudio = null;
  }

  if (activeNativePlayer) {
    try {
      activeNativePlayer.pause();
      await activeNativePlayer.seekTo(0);
    } catch {}
  }

  currentPlayingSoundId = null;
}

/** Reproduce el sonido de alarma seleccionado (con opción de bucle continuo) */
export async function playAlarmSound(
  soundId: string,
  loop = false,
  autoStopMs = 0,
): Promise<void> {
  await stopAlarmSound();
  currentPlayingSoundId = soundId;

  try {
    if (Platform.OS === 'web') {
      const b64 = getSoundWavBase64(soundId);
      if (typeof window !== 'undefined' && (window as any).Audio) {
        const audio = new (window as any).Audio(`data:audio/wav;base64,${b64}`);
        audio.loop = loop;
        activeHtmlAudio = audio;
        await audio.play();
        if (!loop && autoStopMs === 0) {
          audio.onended = () => {
            if (activeHtmlAudio === audio) {
              currentPlayingSoundId = null;
              activeHtmlAudio = null;
            }
          };
        }
      }
    } else {
      // Configurar modo de audio para que suene incluso con switch de silencio
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
        });
      } catch {}

      const fileUri = await ensureSoundWavFile(soundId);
      if (!activeNativePlayer) {
        activeNativePlayer = createAudioPlayer(fileUri);
      } else {
        activeNativePlayer.replace({ uri: fileUri });
      }

      activeNativePlayer.loop = loop;
      activeNativePlayer.volume = 1.0;
      await activeNativePlayer.seekTo(0);
      activeNativePlayer.play();
    }

    if (autoStopMs > 0) {
      soundStopTimeout = setTimeout(() => {
        void stopAlarmSound();
      }, autoStopMs);
    }
  } catch (err) {
    currentPlayingSoundId = null;
  }
}

/** Reproduce una vista previa del sonido de alarma (1 repetición sin bucle) */
export async function previewAlarmSound(soundId: string): Promise<void> {
  if (currentPlayingSoundId === soundId) {
    await stopAlarmSound();
  } else {
    await playAlarmSound(soundId, false, 3500);
  }
}
