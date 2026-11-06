import { Image, ImageSourcePropType } from 'react-native';

export const LOCAL_AVATAR_PRESETS: { id: string; asset: ImageSourcePropType }[] = [
  { id: 'pixel_m_bench', asset: require('../assets/avatars/pixel_bench_press.png') },
  { id: 'pixel_m_deadlift', asset: require('../assets/avatars/pixel_boy_deadlift.jpg') },
  { id: 'pixel_m_dumbbell', asset: require('../assets/avatars/pixel_boy_dumbbell.jpg') },
  { id: 'pixel_m_pullups', asset: require('../assets/avatars/pixel_boy_pullups.jpg') },
  { id: 'pixel_m_mostmuscular', asset: require('../assets/avatars/pixel_boy_mostmuscular.jpg') },
  { id: 'pixel_m_squat', asset: require('../assets/avatars/pixel_boy_squat.jpg') },
  { id: 'pixel_m_dips', asset: require('../assets/avatars/pixel_boy_dips.jpg') },
  { id: 'pixel_m_boxing', asset: require('../assets/avatars/pixel_boy_boxing.jpg') },
  { id: 'pixel_m_ropes', asset: require('../assets/avatars/pixel_boy_battle_ropes.jpg') },
  { id: 'pixel_w_squat', asset: require('../assets/avatars/pixel_girl_squat.jpg') },
  { id: 'pixel_w_shaker', asset: require('../assets/avatars/pixel_girl_shaker.jpg') },
  { id: 'pixel_w_deadlift', asset: require('../assets/avatars/pixel_girl_deadlift.jpg') },
  { id: 'pixel_w_dumbbells', asset: require('../assets/avatars/pixel_girl_dumbbells.jpg') },
  { id: 'pixel_w_running', asset: require('../assets/avatars/pixel_girl_running.jpg') },
  { id: 'pixel_w_stretching', asset: require('../assets/avatars/pixel_girl_stretching.jpg') },
  { id: 'pixel_w_hipthrust', asset: require('../assets/avatars/pixel_girl_hipthrust.jpg') },
];

/**
 * Resuelve una fuente de imagen óptima a partir de un ID de preset o URI.
 * Si coincide con uno de nuestros avatares locales, retorna el asset empaquetado directamente
 * sin peticiones de red ni latencia.
 */
export function resolveAvatarSource(uriOrId?: string | null): ImageSourcePropType | null {
  if (!uriOrId || typeof uriOrId !== 'string') return null;

  const clean = uriOrId.trim();
  if (!clean) return null;

  // 1. Coincidencia directa por id o prefijo 'preset:'
  for (const p of LOCAL_AVATAR_PRESETS) {
    if (p.id === clean || `preset:${p.id}` === clean) {
      return p.asset;
    }
  }

  // 2. Coincidencia por nombre de archivo dentro de la URL/URI
  if (clean.includes('pixel_bench_press')) return require('../assets/avatars/pixel_bench_press.png');
  if (clean.includes('pixel_boy_deadlift')) return require('../assets/avatars/pixel_boy_deadlift.jpg');
  if (clean.includes('pixel_boy_dumbbell')) return require('../assets/avatars/pixel_boy_dumbbell.jpg');
  if (clean.includes('pixel_boy_pullups')) return require('../assets/avatars/pixel_boy_pullups.jpg');
  if (clean.includes('pixel_boy_mostmuscular')) return require('../assets/avatars/pixel_boy_mostmuscular.jpg');
  if (clean.includes('pixel_boy_squat')) return require('../assets/avatars/pixel_boy_squat.jpg');
  if (clean.includes('pixel_boy_dips')) return require('../assets/avatars/pixel_boy_dips.jpg');
  if (clean.includes('pixel_boy_boxing')) return require('../assets/avatars/pixel_boy_boxing.jpg');
  if (clean.includes('pixel_boy_battle_ropes')) return require('../assets/avatars/pixel_boy_battle_ropes.jpg');
  if (clean.includes('pixel_girl_squat')) return require('../assets/avatars/pixel_girl_squat.jpg');
  if (clean.includes('pixel_girl_shaker')) return require('../assets/avatars/pixel_girl_shaker.jpg');
  if (clean.includes('pixel_girl_deadlift')) return require('../assets/avatars/pixel_girl_deadlift.jpg');
  if (clean.includes('pixel_girl_dumbbells')) return require('../assets/avatars/pixel_girl_dumbbells.jpg');
  if (clean.includes('pixel_girl_running')) return require('../assets/avatars/pixel_girl_running.jpg');
  if (clean.includes('pixel_girl_stretching')) return require('../assets/avatars/pixel_girl_stretching.jpg');
  if (clean.includes('pixel_girl_hipthrust')) return require('../assets/avatars/pixel_girl_hipthrust.jpg');

  // 3. URI remota o local estándar
  return { uri: clean };
}

/**
 * Pre-cachea en segundo plano URIs remotas de imágenes para que se muestren instantáneamente
 */
const prefetchedUrls = new Set<string>();

export function prefetchImageUrls(urls: (string | undefined | null)[]) {
  for (const url of urls) {
    if (!url || typeof url !== 'string') continue;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (!prefetchedUrls.has(url)) {
        prefetchedUrls.add(url);
        Image.prefetch(url).catch(() => {});
      }
    }
  }
}
