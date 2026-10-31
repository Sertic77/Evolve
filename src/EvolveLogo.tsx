import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, {
  Path,
  Circle,
  Rect,
  G,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useStore, getActivePalette, ColorPalette } from './store';

interface EvolveLogoProps {
  width?: number;
  height?: number;
  style?: ViewStyle;
  palette?: ColorPalette;
}

export default function EvolveLogo({
  width = 320,
  height,
  style,
  palette: customPalette,
}: EvolveLogoProps) {
  const activePaletteId = useStore((s) => s.activePaletteId);
  const customPalettes = useStore((s) => s.customPalettes);
  const deletedPaletteIds = useStore((s) => s.deletedPaletteIds);

  const palette =
    customPalette ||
    getActivePalette({ activePaletteId, customPalettes, deletedPaletteIds });

  // Proporción original del SVG: 1950 ancho x 640 alto
  const computedHeight = height || Math.round(width * (640 / 1950));

  const pColors =
    palette.colors && palette.colors.length >= 2
      ? palette.colors
      : [palette.primary, palette.secondary];

  const c1 = pColors[0] || palette.primary;
  const c2 = pColors[1] || palette.secondary;
  const c3 = pColors[2] || pColors[0] || palette.primary;
  const c4 = pColors[3] || pColors[1] || palette.secondary;

  // Tonos para el texto EVOLVE según modo claro/oscuro
  const textGradStart = palette.isDark ? '#FFFFFF' : '#0F172A';
  const textGradMid = palette.isDark ? '#E2E8F0' : '#1E293B';
  const textGradEnd = palette.isDark ? '#94A3B8' : '#334155';

  return (
    <View style={[{ width, height: computedHeight, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg
        viewBox="0 0 1950 640"
        width={width}
        height={computedHeight}
      >
        <Defs>
          {/* Degradado principal de la flecha ascendente */}
          <SvgGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={c1} />
            <Stop offset="50%" stopColor={c2} />
            <Stop offset="100%" stopColor={c3} />
          </SvgGradient>

          {/* Degradado de la silueta atlética y cadenas */}
          <SvgGradient id="bodyGrad" x1="15%" y1="90%" x2="85%" y2="10%">
            <Stop offset="0%" stopColor={c1} />
            <Stop offset="55%" stopColor={c2} />
            <Stop offset="100%" stopColor={c3} />
          </SvgGradient>

          {/* Degradado de profundidad para las espirales inferiores */}
          <SvgGradient id="coilDarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={c1} stopOpacity={0.7} />
            <Stop offset="50%" stopColor={c2} stopOpacity={0.85} />
            <Stop offset="100%" stopColor={c1} stopOpacity={1} />
          </SvgGradient>

          {/* Degradado de cinta secundaria brillante */}
          <SvgGradient id="ribbonPinkGrad" x1="0%" y1="50%" x2="100%" y2="20%">
            <Stop offset="0%" stopColor={c2} />
            <Stop offset="50%" stopColor={c3} />
            <Stop offset="100%" stopColor={c4} />
          </SvgGradient>

          {/* Degradado para el texto principal EVOLVE */}
          <SvgGradient id="evolveTextGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={textGradStart} />
            <Stop offset="65%" stopColor={textGradMid} />
            <Stop offset="100%" stopColor={textGradEnd} />
          </SvgGradient>
        </Defs>

        {/* ==================== ISOTIPO (ICONO) ==================== */}
        <G transform="translate(20, 10)">
          {/* Espirales posteriores oscuras (profundidad) */}
          <Path
            d="M 120 420 C 90 510, 210 595, 315 555 C 385 528, 415 445, 365 395 C 330 360, 250 375, 220 425 C 195 468, 245 510, 295 495 C 260 520, 175 495, 185 430 Z"
            fill="url(#coilDarkGrad)"
          />

          <Path
            d="M 95 290 C 60 390, 165 495, 295 475 C 395 460, 445 365, 390 295 C 365 355, 305 415, 215 405 C 145 395, 115 340, 125 280 Z"
            fill="url(#coilDarkGrad)"
          />

          {/* Eslabones de cadena rompiéndose (izquierda superior) */}
          <G fill="none" stroke="url(#bodyGrad)" strokeWidth={16} strokeLinecap="round">
            <Rect
              x={135}
              y={135}
              width={56}
              height={30}
              rx={15}
              transform="rotate(-32 163 150)"
            />
            <Rect
              x={180}
              y={110}
              width={56}
              height={30}
              rx={15}
              transform="rotate(-18 208 125)"
            />
            <Path d="M 105 185 C 120 155, 145 145, 165 150" strokeWidth={14} />
          </G>

          {/* Silueta atlética emergiendo (cabeza, torso y brazo tirando de la cadena) */}
          <Circle cx={348} cy={94} r={34} fill="url(#bodyGrad)" />
          <Path
            d="M 225 112 C 255 98, 285 118, 308 134 C 332 150, 368 158, 385 185 C 398 206, 372 248, 335 278 C 285 318, 215 348, 170 395 C 155 340, 195 280, 252 242 C 275 226, 282 195, 255 178 C 232 164, 195 175, 168 195 C 180 155, 200 124, 225 112 Z"
            fill="url(#bodyGrad)"
          />

          {/* Arco envolvente izquierdo (cinta) */}
          <Path
            d="M 155 145 C 55 225, 65 375, 185 415 C 265 442, 355 410, 405 335 C 355 375, 265 390, 195 360 C 115 325, 105 220, 155 145 Z"
            fill="url(#bodyGrad)"
          />

          {/* Cinta inferior que cruza sobre la espiral */}
          <Path
            d="M 135 425 C 175 515, 315 535, 395 455 C 445 405, 452 325, 402 275 C 418 335, 395 405, 335 438 C 265 475, 180 465, 135 425 Z"
            fill="url(#ribbonPinkGrad)"
          />

          {/* Base inferior del torbellino */}
          <Path
            d="M 185 525 C 230 590, 335 585, 378 520 C 335 552, 245 558, 185 525 Z"
            fill="url(#coilDarkGrad)"
          />

          {/* Flecha ascendente principal (Swoosh dinámico hacia la meta) */}
          <Path
            d="M 185 495 C 165 425, 215 345, 295 265 C 355 205, 415 150, 462 95 L 428 72 L 558 18 L 538 158 L 502 132 C 445 198, 380 262, 315 328 C 245 398, 205 450, 185 495 Z"
            fill="url(#arrowGrad)"
          />
        </G>

        {/* ==================== LOGOTIPO (TEXTO) ==================== */}
        <G>
          {/* Texto principal: EVOLVE */}
          <SvgText
            x={615}
            y={392}
            fontSize={188}
            fontWeight="900"
            fontStyle="italic"
            letterSpacing={6}
            fill="url(#evolveTextGrad)"
          >
            EVOLVE
          </SvgText>

          {/* Subtítulo: FITNESS & HEALTH siguiendo la paleta */}
          <SvgText
            x={692}
            y={488}
            fontSize={60}
            fontWeight="700"
            letterSpacing={18}
            fill={c2}
          >
            FITNESS & HEALTH
          </SvgText>
        </G>
      </Svg>
    </View>
  );
}
