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

  // Textos Nítidos para Fondo Claro
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
  kcal: '#FF5E7E',          // Fuego Coral Pastel
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
  primary: ['#A78BFA', '#F472B6'] as const,
  pastelMintToBlue: ['#14B8A6', '#60A5FA'] as const,
  pastelSunset: ['#FB7185', '#F59E0B'] as const,
  
  // Tarjetas Glass Pastel en fondo claro
  cardGlass: ['rgba(255, 255, 255, 0.98)', 'rgba(248, 250, 255, 0.94)'] as const,
  cardGlassSubtle: ['rgba(255, 255, 255, 0.85)', 'rgba(241, 245, 254, 0.85)'] as const,
  
  // TabBar y Floating Home
  tabBar: ['rgba(255, 255, 255, 0.98)', 'rgba(248, 250, 255, 0.96)'] as const,
  floatingHomeActive: ['#A78BFA', '#F472B6'] as const,
  floatingHomeInactive: ['#E2E8F0', '#CBD5E1'] as const,
  
  // Macros
  kcalGradient: ['#FF5E7E', '#FDA4AF'] as const,
  proteinGradient: ['#0D9488', '#5EEAD4'] as const,
};

export const fmt = (n: number) => {
  if (isNaN(n) || n === 0) return '0';
  const rounded = Math.round(n * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
};
