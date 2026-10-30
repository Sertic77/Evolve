import { ColorPalette, TypographySettings, getFontFamily } from './store';

export const C = {
  // Fondos y Superficies Anime (Light Cream & Cloud Pastel)
  bg: '#F3F5FA',
  bgDark: '#FFFFFF',
  bgCard: 'rgba(255, 255, 255, 0.92)',
  bgCardLight: 'rgba(245, 247, 255, 0.95)',
  bgCardHover: 'rgba(238, 242, 255, 1)',
  
  // Bordes Suaves Glassmorphism Pastel Claro
  border: 'rgba(203, 213, 225, 0.6)',
  borderLight: 'rgba(226, 232, 240, 0.85)',
  borderPastelPurple: 'rgba(167, 139, 250, 0.45)',
  borderPastelPink: 'rgba(244, 114, 182, 0.45)',
  borderPastelMint: 'rgba(13, 148, 136, 0.35)',

  // Textos Nítidos
  text: '#1E1B4B',           // Índigo oscuro profundo
  textSub: '#334155',        // Gris pizarra oscuro
  sub: '#64748B',            // Gris medio nítido
  subMuted: '#94A3B8',       // Gris suave

  // Colores Pastel Anime
  pastelPurple: '#8B5CF6',   // Lavanda Mágico Anime
  pastelPink: '#F472B6',     // Sakura Blossom
  pastelBlue: '#60A5FA',     // Cielo Anime
  pastelMint: '#14B8A6',     // Menta Mágica
  pastelPeach: '#FB7185',    // Melocotón Suave
  pastelHoney: '#F59E0B',    // Sol Vainilla / Miel

  // Macros en Tonos Pastel Vivos para fondo claro
  kcal: '#10B981',          // Kcal Ganadas (Verde Esmeralda Pastel)
  carbs: '#D97706',         // Miel Ámbar Pastel
  protein: '#0D9488',       // Menta Esmeralda Pastel
  fat: '#8B5CF6',           // Lavanda Pastel

  // Estados
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.1)',
  success: '#10B981',
  
  // Acento principal
  accent: '#8B5CF6',
};

export const GRADIENTS = {
  // Acento Anime Suave
  primary: ['#A78BFA', '#F472B6'] as [string, string],
  pastelMintToBlue: ['#14B8A6', '#60A5FA'] as [string, string],
  pastelSunset: ['#FB7185', '#F59E0B'] as [string, string],
  
  // Tarjetas Glass Pastel
  cardGlass: ['rgba(255, 255, 255, 0.98)', 'rgba(248, 250, 255, 0.94)'] as [string, string],
  cardGlassSubtle: ['rgba(255, 255, 255, 0.85)', 'rgba(241, 245, 254, 0.85)'] as [string, string],
  
  // TabBar y Floating Home
  tabBar: ['rgba(255, 255, 255, 0.98)', 'rgba(248, 250, 255, 0.96)'] as [string, string],
  floatingHomeActive: ['#A78BFA', '#F472B6'] as [string, string],
  floatingHomeInactive: ['#E2E8F0', '#CBD5E1'] as [string, string],
  
  // Macros
  kcalGradient: ['#10B981', '#6EE7B7'] as [string, string],
  proteinGradient: ['#0D9488', '#5EEAD4'] as [string, string],
};

export const fmt = (n: number) => {
  if (isNaN(n) || n === 0) return '0';
  const rounded = Math.round(n * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
};

/* ==========================================================
   SINCRONIZADOR GLOBAL DE TEMA Y ESTILOS PARA TODA LA APP
========================================================== */
const registeredSheets: any[] = [];

export function registerThemeSheet(sheet: any) {
  if (sheet && typeof sheet === 'object' && !registeredSheets.includes(sheet)) {
    registeredSheets.push(sheet);
  }
}

export function applyGlobalTheme(palette: ColorPalette, typography?: TypographySettings) {
  if (!palette) return;

  // 1. Mutar colores globales de C
  C.bg = palette.bg;
  C.bgDark = palette.isDark ? '#0F172A' : '#FFFFFF';
  C.bgCard = palette.isDark ? 'rgba(30, 41, 59, 0.96)' : 'rgba(255, 255, 255, 0.92)';
  C.bgCardLight = palette.isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(245, 247, 255, 0.95)';
  C.bgCardHover = palette.isDark ? '#1E293B' : 'rgba(238, 242, 255, 1)';
  C.border = palette.border;
  C.borderLight = palette.border;
  C.borderPastelPurple = `${palette.primary}66`;
  C.borderPastelPink = `${palette.secondary}66`;
  C.text = palette.text;
  C.textSub = palette.textSub;
  C.sub = palette.textSub;
  C.subMuted = palette.isDark ? '#64748B' : '#94A3B8';
  C.pastelPurple = palette.primary;
  C.pastelPink = palette.secondary;
  C.accent = palette.accent || palette.primary;

  // 2. Mutar GRADIENTS para fondos y botones
  (GRADIENTS.primary as any)[0] = palette.primary;
  (GRADIENTS.primary as any)[1] = palette.secondary;
  (GRADIENTS.cardGlass as any)[0] = palette.isDark ? '#1E293B' : 'rgba(255, 255, 255, 0.98)';
  (GRADIENTS.cardGlass as any)[1] = palette.isDark ? '#0F172A' : 'rgba(248, 250, 255, 0.94)';
  (GRADIENTS.cardGlassSubtle as any)[0] = palette.isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.85)';
  (GRADIENTS.cardGlassSubtle as any)[1] = palette.isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(241, 245, 254, 0.85)';
  (GRADIENTS.tabBar as any)[0] = palette.isDark ? '#1E293B' : 'rgba(255, 255, 255, 0.98)';
  (GRADIENTS.tabBar as any)[1] = palette.isDark ? '#0F172A' : 'rgba(248, 250, 255, 0.96)';
  (GRADIENTS.floatingHomeActive as any)[0] = palette.primary;
  (GRADIENTS.floatingHomeActive as any)[1] = palette.secondary;

  // 3. Mutar tipografía en las hojas registradas
  const titleFont = typography ? getFontFamily(typography.titles) : undefined;
  const subtitleFont = typography ? getFontFamily(typography.subtitles) : undefined;
  const bodyFont = typography ? getFontFamily(typography.body) : undefined;
  const dataFont = typography ? getFontFamily(typography.data) : undefined;

  registeredSheets.forEach((sheet) => {
    Object.keys(sheet).forEach((key) => {
      const style = sheet[key];
      if (!style || typeof style !== 'object') return;

      // Actualizar fondos
      const k = key.toLowerCase();
      if (k.includes('root') || k.includes('container') || k.includes('screen') || k.includes('scroll')) {
        if (style.backgroundColor && style.backgroundColor !== 'transparent') {
          style.backgroundColor = palette.bg;
        }
      } else if (k.includes('card') || k.includes('modal') || k.includes('sheet') || k.includes('box')) {
        if (palette.isDark) {
          if (style.backgroundColor === '#FFFFFF' || (typeof style.backgroundColor === 'string' && style.backgroundColor.startsWith('rgba(255, 255, 255'))) {
            style.backgroundColor = palette.cardBg;
          }
        } else {
          if (style.backgroundColor === '#1E293B' || style.backgroundColor === '#0F172A') {
            style.backgroundColor = palette.cardBg;
          }
        }
      }

      // Actualizar bordes
      if (style.borderColor && style.borderColor !== '#CBD5E1') {
        style.borderColor = palette.border;
      }

      // Actualizar color de textos
      if (style.color) {
        if (k.includes('title') || k.includes('header') || k.includes('name')) {
          style.color = palette.text;
        } else if (k.includes('sub') || k.includes('label') || k.includes('desc') || k.includes('sec')) {
          style.color = palette.textSub;
        }
      }

      // Aplicar tipografía seleccionada
      if (titleFont && (k.includes('title') || k.includes('header') || k.includes('name'))) {
        style.fontFamily = titleFont;
      } else if (subtitleFont && (k.includes('sub') || k.includes('label') || k.includes('tag') || k.includes('pill'))) {
        style.fontFamily = subtitleFont;
      } else if (dataFont && (k.includes('val') || k.includes('num') || k.includes('count') || k.includes('stat') || k.includes('pct') || k.includes('macro'))) {
        style.fontFamily = dataFont;
      } else if (bodyFont && (k.includes('text') || k.includes('desc') || k.includes('body') || k.includes('item') || k.includes('empty'))) {
        style.fontFamily = bodyFont;
      }
    });
  });
}
