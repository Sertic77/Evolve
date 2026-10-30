export const C = {
  // Fondos y Superficies
  bg: '#080B14',
  bgDark: '#04060A',
  card: 'rgba(18, 24, 41, 0.75)',
  cardSolid: '#121829',
  card2: 'rgba(28, 36, 62, 0.65)',
  cardHover: 'rgba(38, 48, 80, 0.75)',
  
  // Bordes y Glassmorphism
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.14)',
  borderGlow: 'rgba(124, 92, 255, 0.45)',
  borderCyan: 'rgba(0, 242, 254, 0.4)',
  borderPink: 'rgba(255, 42, 133, 0.4)',

  // Textos
  text: '#F8FAFC',
  textDim: '#CBD5E1',
  sub: '#8E99B7',
  subMuted: '#5F6986',

  // Colores de Acento Anime
  accent: '#7C5CFF',
  accentPurple: '#8B5CF6',
  accentCyan: '#00F2FE',
  accentPink: '#FF2A85',
  accentBlue: '#3B82F6',
  
  // Macros (Stats de Energía Anime)
  kcal: '#FF4D6D',       // Solar Flame
  carbs: '#FFB703',      // Spark Gold
  protein: '#00F2FE',    // Cyan Plasma
  fat: '#A855F7',        // Cosmic Violet

  // Utilidades
  danger: '#FF3366',
  dangerBg: 'rgba(255, 51, 102, 0.15)',
  success: '#10B981',
};

export const GRADIENTS = {
  primary: ['#7C5CFF', '#00F2FE'] as const,
  fire: ['#FF4D6D', '#FF8A00'] as const,
  cyan: ['#00F2FE', '#4FACFE'] as const,
  purple: ['#A855F7', '#6366F1'] as const,
  gold: ['#FFB703', '#F72585'] as const,
  cardGlass: ['rgba(22, 28, 48, 0.82)', 'rgba(14, 18, 32, 0.88)'] as const,
  tabBar: ['rgba(15, 20, 36, 0.94)', 'rgba(8, 11, 20, 0.98)'] as const,
  homeButton: ['#7C5CFF', '#00F2FE'] as const,
};

export const fmt = (n: number) => {
  if (isNaN(n) || n === 0) return '0';
  const rounded = Math.round(n * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
};
