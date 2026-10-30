import { ColorPalette, TypographySettings } from './store';

export const C = {
  // Fondos y Superficies
  bg: '#F3F5FA',
  bgDark: '#FFFFFF',
  bgCard: 'rgba(255, 255, 255, 0.92)',
  bgCardLight: 'rgba(245, 247, 255, 0.95)',
  bgCardHover: 'rgba(238, 242, 255, 1)',
  
  // Bordes
  border: 'rgba(203, 213, 225, 0.6)',
  borderLight: 'rgba(226, 232, 240, 0.85)',
  borderPastelPurple: 'rgba(167, 139, 250, 0.45)',
  borderPastelPink: 'rgba(244, 114, 182, 0.45)',
  borderPastelMint: 'rgba(13, 148, 136, 0.35)',

  // Textos Nítidos
  text: '#1E1B4B',
  textSub: '#334155',
  sub: '#64748B',
  subMuted: '#94A3B8',

  // Colores de la Paleta
  pastelPurple: '#8B5CF6',
  pastelPink: '#F472B6',
  pastelBlue: '#8B5CF6',
  pastelMint: '#F472B6',
  pastelPeach: '#F472B6',
  pastelHoney: '#8B5CF6',

  // Macros alineados con la paleta de colores
  kcal: '#8B5CF6',
  carbs: '#F472B6',
  protein: '#8B5CF6',
  fat: '#F472B6',

  // Estados
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.1)',
  success: '#8B5CF6',
  
  // Acento principal
  accent: '#8B5CF6',
};

export const GRADIENTS = {
  // Acentos de la paleta
  primary: ['#8B5CF6', '#F472B6'] as [string, string],
  pastelMintToBlue: ['#8B5CF6', '#F472B6'] as [string, string],
  pastelSunset: ['#8B5CF6', '#F472B6'] as [string, string],
  
  // Tarjetas Glass Pastel
  cardGlass: ['rgba(255, 255, 255, 0.98)', 'rgba(248, 250, 255, 0.94)'] as [string, string],
  cardGlassSubtle: ['rgba(255, 255, 255, 0.85)', 'rgba(241, 245, 254, 0.85)'] as [string, string],
  
  // TabBar y Floating Home
  tabBar: ['rgba(255, 255, 255, 0.98)', 'rgba(248, 250, 255, 0.96)'] as [string, string],
  floatingHomeActive: ['#8B5CF6', '#F472B6'] as [string, string],
  floatingHomeInactive: ['#E2E8F0', '#CBD5E1'] as [string, string],
  
  // Macros con la paleta
  kcalGradient: ['#8B5CF6', '#A78BFA'] as [string, string],
  proteinGradient: ['#F472B6', '#FB7185'] as [string, string],
};

export const fmt = (n: number) => {
  if (isNaN(n) || n === 0) return '0';
  const rounded = Math.round(n * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
};

/* ==========================================================
   SINCRONIZADOR GLOBAL DE TEMA Y ESTILOS PARA TODA LA APP
========================================================== */
export function registerThemeSheet(_sheet: any) {
  // No-op seguro para Hermes
}

export function applyGlobalTheme(palette: ColorPalette, _typography?: TypographySettings) {
  if (!palette) return;

  // 1. Mutar de forma segura las variables globales de C usando EXCLUSIVAMENTE colores de la paleta
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

  // Macros y acentos remapeados a la paleta activa (sin colores ajenos)
  C.kcal = palette.primary;
  C.protein = palette.primary;
  C.carbs = palette.secondary;
  C.fat = palette.secondary;
  C.pastelBlue = palette.primary;
  C.pastelMint = palette.secondary;
  C.pastelPeach = palette.secondary;
  C.pastelHoney = palette.primary;
  C.success = palette.primary;

  // 2. Mutar GRADIENTS para fondos y botones con los colores de la paleta activa
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
  (GRADIENTS.kcalGradient as any)[0] = palette.primary;
  (GRADIENTS.kcalGradient as any)[1] = palette.secondary;
  (GRADIENTS.proteinGradient as any)[0] = palette.secondary;
  (GRADIENTS.proteinGradient as any)[1] = palette.primary;
}
