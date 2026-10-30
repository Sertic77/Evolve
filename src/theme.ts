export const C = {
  // Fondos y Superficies Anime (Soft Night / Twilight Dusk)
  bg: '#0E1324',
  bgDark: '#090D1A',
  bgCard: 'rgba(25, 33, 58, 0.72)',
  bgCardLight: 'rgba(35, 46, 78, 0.65)',
  bgCardHover: 'rgba(45, 58, 96, 0.75)',
  
  // Bordes Suaves Glassmorphism Pastel
  border: 'rgba(255, 255, 255, 0.1)',
  borderLight: 'rgba(255, 255, 255, 0.16)',
  borderPastelPurple: 'rgba(184, 161, 255, 0.35)',
  borderPastelPink: 'rgba(255, 183, 197, 0.35)',
  borderPastelMint: 'rgba(112, 228, 208, 0.35)',

  // Textos Nítidos
  text: '#F8FAFC',
  textSub: '#C5CEE0',
  sub: '#94A3B8',
  subMuted: '#64748B',

  // Colores Pastel Anime
  pastelPurple: '#B8A1FF',   // Lavanda Mágico Anime
  pastelPink: '#FFB7C5',     // Sakura Blossom
  pastelBlue: '#A0C4FF',     // Cielo Anime
  pastelMint: '#70E4D0',     // Menta Mágica
  pastelPeach: '#FFB4A2',    // Melocotón Suave
  pastelHoney: '#FDE28A',    // Sol Vainilla

  // Macros en Tonos Pastel
  kcal: '#FF9AA2',          // Peach / Salmon Pastel
  carbs: '#FDE28A',         // Vanilla / Honey Pastel
  protein: '#70E4D0',       // Mint Pastel
  fat: '#CDB4DB',           // Lavender Pastel

  // Estados
  danger: '#FF8FAB',
  dangerBg: 'rgba(255, 143, 171, 0.15)',
  success: '#80ED99',
  
  // Acento principal
  accent: '#B8A1FF',
};

export const GRADIENTS = {
  // Acento Anime Suave
  primary: ['#B8A1FF', '#FFB7C5'] as const,
  pastelMintToBlue: ['#70E4D0', '#A0C4FF'] as const,
  pastelSunset: ['#FFB7C5', '#FFB4A2'] as const,
  
  // Tarjetas Glass Pastel
  cardGlass: ['rgba(28, 38, 66, 0.78)', 'rgba(18, 24, 46, 0.84)'] as const,
  cardGlassSubtle: ['rgba(32, 42, 72, 0.55)', 'rgba(22, 30, 54, 0.65)'] as const,
  
  // TabBar y Floating Home
  tabBar: ['rgba(20, 27, 48, 0.95)', 'rgba(12, 16, 32, 0.98)'] as const,
  floatingHomeActive: ['#B8A1FF', '#FFB7C5'] as const,
  floatingHomeInactive: ['#2A3558', '#1C243E'] as const,
  
  // Macros
  kcalGradient: ['#FF9AA2', '#FFB4A2'] as const,
  proteinGradient: ['#70E4D0', '#A0C4FF'] as const,
};

export const fmt = (n: number) => {
  if (isNaN(n) || n === 0) return '0';
  const rounded = Math.round(n * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
};
