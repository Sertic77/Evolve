import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Animated,
  Easing,
  Platform,
  Alert,
} from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  G,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, GRADIENTS } from './theme';
import { DateSelector, PrimaryButton, s } from './components';
import {
  useStore,
  dateKey,
  uid,
  BodyPartKey,
  DayMeasurements,
  ProgressPhoto,
} from './store';

/* ==========================================================
   CONFIGURACIÓN Y METADATOS DE PARTES DEL CUERPO
========================================================== */
export interface BodyPartInfo {
  key: BodyPartKey;
  label: string;
  shortLabel: string;
  category: 'torso' | 'arms' | 'legs' | 'static';
  interactive: boolean;
  view: 'front' | 'back' | 'both';
  icon: any;
  defaultAvg: number; // Referencia estándar en cm
  unit: string;
}

export const BODY_PARTS_INFO: Record<BodyPartKey, BodyPartInfo> = {
  head: {
    key: 'head',
    label: 'Cabeza',
    shortLabel: 'Cabeza',
    category: 'static',
    interactive: false,
    view: 'both',
    icon: 'person-outline',
    defaultAvg: 56,
    unit: 'cm',
  },
  chest: {
    key: 'chest',
    label: 'Pecho',
    shortLabel: 'Pecho',
    category: 'torso',
    interactive: true,
    view: 'front',
    icon: 'shield-outline',
    defaultAvg: 100,
    unit: 'cm',
  },
  back: {
    key: 'back',
    label: 'Espalda',
    shortLabel: 'Espalda',
    category: 'torso',
    interactive: true,
    view: 'back',
    icon: 'fitness-outline',
    defaultAvg: 110,
    unit: 'cm',
  },
  right_arm: {
    key: 'right_arm',
    label: 'Brazo derecho',
    shortLabel: 'Brazo D',
    category: 'arms',
    interactive: true,
    view: 'both',
    icon: 'barbell-outline',
    defaultAvg: 36,
    unit: 'cm',
  },
  left_arm: {
    key: 'left_arm',
    label: 'Brazo izquierdo',
    shortLabel: 'Brazo I',
    category: 'arms',
    interactive: true,
    view: 'both',
    icon: 'barbell-outline',
    defaultAvg: 36,
    unit: 'cm',
  },
  right_forearm: {
    key: 'right_forearm',
    label: 'Antebrazo derecho',
    shortLabel: 'Antebrazo D',
    category: 'arms',
    interactive: true,
    view: 'both',
    icon: 'hand-left-outline',
    defaultAvg: 29,
    unit: 'cm',
  },
  left_forearm: {
    key: 'left_forearm',
    label: 'Antebrazo izquierdo',
    shortLabel: 'Antebrazo I',
    category: 'arms',
    interactive: true,
    view: 'both',
    icon: 'hand-right-outline',
    defaultAvg: 29,
    unit: 'cm',
  },
  waist: {
    key: 'waist',
    label: 'Cintura',
    shortLabel: 'Cintura',
    category: 'torso',
    interactive: true,
    view: 'front',
    icon: 'ellipse-outline',
    defaultAvg: 80,
    unit: 'cm',
  },
  glutes: {
    key: 'glutes',
    label: 'Nalgas',
    shortLabel: 'Nalgas',
    category: 'torso',
    interactive: true,
    view: 'back',
    icon: 'heart-outline',
    defaultAvg: 96,
    unit: 'cm',
  },
  right_thigh: {
    key: 'right_thigh',
    label: 'Muslo derecho',
    shortLabel: 'Muslo D',
    category: 'legs',
    interactive: true,
    view: 'both',
    icon: 'walk-outline',
    defaultAvg: 58,
    unit: 'cm',
  },
  left_thigh: {
    key: 'left_thigh',
    label: 'Muslo izquierdo',
    shortLabel: 'Muslo I',
    category: 'legs',
    interactive: true,
    view: 'both',
    icon: 'walk-outline',
    defaultAvg: 58,
    unit: 'cm',
  },
  right_calf: {
    key: 'right_calf',
    label: 'Pantorilla derecha',
    shortLabel: 'Pantorrilla D',
    category: 'legs',
    interactive: true,
    view: 'both',
    icon: 'footsteps-outline',
    defaultAvg: 37,
    unit: 'cm',
  },
  left_calf: {
    key: 'left_calf',
    label: 'Pantorilla izquierda',
    shortLabel: 'Pantorrilla I',
    category: 'legs',
    interactive: true,
    view: 'both',
    icon: 'footsteps-outline',
    defaultAvg: 37,
    unit: 'cm',
  },
  hands: {
    key: 'hands',
    label: 'Manos',
    shortLabel: 'Manos',
    category: 'static',
    interactive: false,
    view: 'both',
    icon: 'hand-left-outline',
    defaultAvg: 0,
    unit: 'cm',
  },
  feet: {
    key: 'feet',
    label: 'Pies',
    shortLabel: 'Pies',
    category: 'static',
    interactive: false,
    view: 'both',
    icon: 'footsteps-outline',
    defaultAvg: 0,
    unit: 'cm',
  },
};

/* ==========================================================
   PANTALLA PRINCIPAL: SECCIÓN MEDIDAS
========================================================== */
export default function MeasureScreen() {
  const [tab, setTab] = useState<number>(0); // 0: Medidas, 1: Fotos
  const [date, setDate] = useState<Date>(new Date());
  const key = dateKey(date);

  const { measurementLogs, photoLogs, setPartMeasurement, deletePartMeasurement } = useStore();
  const dayMeasurements = measurementLogs[key] || {};
  const dayPhotos = photoLogs[key] || [];

  // Vista anatómica: 'front' (Frente) o 'back' (Espalda)
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front');

  // Parte seleccionada para ingresar/editar medida
  const [selectedPart, setSelectedPart] = useState<BodyPartKey | null>(null);

  // Animación de transición entre pestañas
  const tabContentFade = useRef(new Animated.Value(1)).current;
  const tabContentSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    tabContentFade.setValue(0);
    tabContentSlide.setValue(8);
    Animated.parallel([
      Animated.timing(tabContentFade, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(tabContentSlide, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [tab]);

  // Manejo de clic en parte anatómica
  const handlePartPress = (partKey: BodyPartKey) => {
    const info = BODY_PARTS_INFO[partKey];
    if (!info || !info.interactive) {
      return; // Cabeza, manos, pies no interactúan
    }
    setSelectedPart(partKey);
  };

  return (
    <View style={measureStyles.rootContainer}>
      <ScrollView
        contentContainerStyle={measureStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cabecera Anime Pastel Claro */}
        <View style={measureStyles.topHeader}>
          <View>
            <View style={measureStyles.cyberTagRow}>
              <Ionicons name="sparkles" size={11} color={C.pastelPurple} />
              <Text style={measureStyles.cyberTagText}>✦ EVOLVE // ANTROPOMETRÍA ✦</Text>
            </View>
            <Text style={measureStyles.screenTitle}>Medidas</Text>
          </View>

          <View style={measureStyles.headerBadgeMini}>
            <Ionicons name="body-outline" size={14} color={C.pastelPurple} />
            <Text style={measureStyles.headerBadgeMiniText}>
              {tab === 0
                ? date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()
                : 'GALERÍA'}
            </Text>
          </View>
        </View>

        {/* SELECTOR DE MODO: MEDIDAS vs FOTOS (Píldora deslizante Anime) */}
        <MeasureModeSegmented value={tab} onChange={setTab} />

        {/* CONTENIDO SEGÚN PESTAÑA */}
        <Animated.View
          style={{
            opacity: tabContentFade,
            transform: [{ translateY: tabContentSlide }],
          }}
        >
          {tab === 0 ? (
            /* ==========================================================
               PESTAÑA 1: MEDIDAS (Calendario + Croquis + Lista)
            ========================================================== */
            <View style={{ marginTop: 2 }}>
              {/* Botón de Calendario (por defecto hoy) */}
              <DateSelector date={date} onChange={setDate} />

              {/* CROQUIS DEL CUERPO HUMANO TIPO ANIME */}
              <AnimeBodyMapCard
                bodyView={bodyView}
                onChangeView={setBodyView}
                measurements={dayMeasurements}
                onSelectPart={handlePartPress}
              />

              {/* LISTA DE MEDIDAS RÁPIDAS DEL DÍA */}
              <MeasurementsSummaryGrid
                measurements={dayMeasurements}
                onSelectPart={handlePartPress}
              />
            </View>
          ) : (
            /* ==========================================================
               PESTAÑA 2: FOTOS (Progreso visual fotográfico)
            ========================================================== */
            <ProgressPhotosSection
              date={date}
              setDate={setDate}
              photos={dayPhotos}
            />
          )}
        </Animated.View>
      </ScrollView>

      {/* MODAL PARA AGREGAR / EDITAR MEDIDA CORPORAL */}
      {selectedPart && (
        <MeasurementEditModal
          visible={!!selectedPart}
          partKey={selectedPart}
          currentValue={dayMeasurements[selectedPart]}
          dateKeyStr={key}
          onClose={() => setSelectedPart(null)}
          onSave={(val) => {
            setPartMeasurement(key, selectedPart, val);
            setSelectedPart(null);
          }}
          onDelete={() => {
            deletePartMeasurement(key, selectedPart);
            setSelectedPart(null);
          }}
        />
      )}
    </View>
  );
}

/* ==========================================================
   SELECTOR MAESTRO DE MODO (Medidas / Fotos)
========================================================== */
function MeasureModeSegmented({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const options = [
    { label: 'Medidas', icon: 'body-outline' },
    { label: 'Fotos', icon: 'camera-outline' },
  ];

  const [containerWidth, setContainerWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: value,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }).start();
  }, [value]);

  const pillWidth = containerWidth > 0 ? (containerWidth - 8) / 2 : 0;
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, pillWidth + 4],
  });

  return (
    <View
      style={s.mainSegmentedContainer}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {containerWidth > 0 && (
        <Animated.View style={[s.slidingPill, { width: pillWidth, transform: [{ translateX }] }]}>
          <LinearGradient
            colors={['#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.slidingPillGradient}
          />
        </Animated.View>
      )}

      {options.map((opt, i) => {
        const active = value === i;
        return (
          <Pressable
            key={opt.label}
            onPress={() => onChange(i)}
            style={s.mainSegmentedBtn}
          >
            <Ionicons
              name={opt.icon as any}
              size={16}
              color={active ? '#FFFFFF' : C.sub}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                s.mainSegmentedText,
                active ? s.mainSegmentedTextActive : s.mainSegmentedTextInactive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ==========================================================
   TARJETA DEL CROQUIS DEL CUERPO HUMANO ANIME
========================================================== */
function AnimeBodyMapCard({
  bodyView,
  onChangeView,
  measurements,
  onSelectPart,
}: {
  bodyView: 'front' | 'back';
  onChangeView: (v: 'front' | 'back') => void;
  measurements: DayMeasurements;
  onSelectPart: (p: BodyPartKey) => void;
}) {
  // Conteo de medidas registradas hoy
  const registeredCount = Object.keys(measurements).length;

  return (
    <View style={measureStyles.croquisGlassCard}>
      {/* Orbes de fondo decorativos Anime */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={measureStyles.cardOrb1} />
        <View style={measureStyles.cardOrb2} />
      </View>

      <LinearGradient
        colors={GRADIENTS.cardGlass}
        style={measureStyles.croquisCardGradient}
      >
        {/* Encabezado del Mapa Anatómico */}
        <View style={measureStyles.croquisHeaderRow}>
          <View>
            <View style={s.hudBadge}>
              <Ionicons name="sparkles" size={11} color={C.pastelPurple} />
              <Text style={s.hudBadgeText}>✦ CROQUIS ANATÓMICO ANIME ✦</Text>
            </View>
            <Text style={measureStyles.croquisSubTitle}>
              Toca una parte del cuerpo para ingresar tu medida
            </Text>
          </View>

          {/* Badge de progreso de medidas */}
          <View style={measureStyles.measureProgressBadge}>
            <Text style={measureStyles.measureProgressText}>
              {registeredCount} / 12
            </Text>
            <Text style={measureStyles.measureProgressSub}>REGISTRADAS</Text>
          </View>
        </View>

        {/* SELECTOR VISTA FRONTAL / POSTERIOR */}
        <View style={measureStyles.viewToggleContainer}>
          <Pressable
            onPress={() => onChangeView('front')}
            style={[
              measureStyles.viewToggleBtn,
              bodyView === 'front' && measureStyles.viewToggleBtnActive,
            ]}
          >
            <Ionicons
              name="person-outline"
              size={13}
              color={bodyView === 'front' ? '#FFFFFF' : C.sub}
            />
            <Text
              style={[
                measureStyles.viewToggleText,
                bodyView === 'front' && measureStyles.viewToggleTextActive,
              ]}
            >
              Vista Frontal
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onChangeView('back')}
            style={[
              measureStyles.viewToggleBtn,
              bodyView === 'back' && measureStyles.viewToggleBtnActive,
            ]}
          >
            <Ionicons
              name="refresh-outline"
              size={13}
              color={bodyView === 'back' ? '#FFFFFF' : C.sub}
            />
            <Text
              style={[
                measureStyles.viewToggleText,
                bodyView === 'back' && measureStyles.viewToggleTextActive,
              ]}
            >
              Vista Posterior
            </Text>
          </Pressable>
        </View>

        {/* LIENZO SVG: SILUETA ANIME DEL CUERPO HUMANO */}
        <View style={measureStyles.bodySvgCanvasWrapper}>
          <AnimeBodyVector
            view={bodyView}
            measurements={measurements}
            onSelectPart={onSelectPart}
          />
        </View>

        {/* Leyenda interactiva inferior */}
        <View style={measureStyles.croquisLegendRow}>
          <View style={measureStyles.legendItem}>
            <View style={[measureStyles.legendDot, { backgroundColor: '#8B5CF6' }]} />
            <Text style={measureStyles.legendLabel}>Medido</Text>
          </View>
          <View style={measureStyles.legendItem}>
            <View style={[measureStyles.legendDot, { backgroundColor: 'rgba(167, 139, 250, 0.25)', borderColor: '#A78BFA', borderWidth: 1 }]} />
            <Text style={measureStyles.legendLabel}>Sin medir (Interactivo)</Text>
          </View>
          <View style={measureStyles.legendItem}>
            <View style={[measureStyles.legendDot, { backgroundColor: 'rgba(203, 213, 225, 0.4)' }]} />
            <Text style={measureStyles.legendLabel}>No interactúa</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

/* ==========================================================
   VECTOR SVG: SILUETA ANIME CON PARTES CLICKEABLES
========================================================== */
function AnimeBodyVector({
  view,
  measurements,
  onSelectPart,
}: {
  view: 'front' | 'back';
  measurements: DayMeasurements;
  onSelectPart: (p: BodyPartKey) => void;
}) {
  const width = 290;
  const height = 410;

  // Renderizador de parte interactiva con estilo anime
  const renderMuscleSection = (
    partKey: BodyPartKey,
    d: string,
    centerLabelX: number,
    centerLabelY: number,
    tagAlign: 'left' | 'right' | 'center' = 'center',
    displayUnit: string = 'cm'
  ) => {
    const val = measurements[partKey];
    const isMeasured = val !== undefined && val > 0;
    const info = BODY_PARTS_INFO[partKey];

    // Colores dinámicos Anime
    const fillColor = isMeasured
      ? 'rgba(139, 92, 246, 0.35)'
      : 'rgba(238, 242, 255, 0.85)';
    const strokeColor = isMeasured ? '#8B5CF6' : 'rgba(167, 139, 250, 0.6)';
    const strokeWidth = isMeasured ? 2.2 : 1.4;

    return (
      <G key={partKey} onPress={() => onSelectPart(partKey)}>
        {/* Contorno anatómico con halo de brillo si está medido */}
        <Path
          d={d}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Chip visual de medida con valor flotante */}
        {isMeasured && (
          <G>
            <Circle
              cx={centerLabelX}
              cy={centerLabelY}
              r={3.5}
              fill="#8B5CF6"
            />
          </G>
        )}
      </G>
    );
  };

  return (
    <View style={measureStyles.svgContainer}>
      <Svg width={width} height={height} viewBox="0 0 290 410">
        <Defs>
          <SvgGradient id="animeGlowActive" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#A78BFA" stopOpacity="0.45" />
            <Stop offset="100%" stopColor="#F472B6" stopOpacity="0.3" />
          </SvgGradient>

          <SvgGradient id="animeHeadGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="rgba(241, 245, 249, 0.95)" />
            <Stop offset="100%" stopColor="rgba(226, 232, 240, 0.85)" />
          </SvgGradient>
        </Defs>

        {/* ========================================================
            PARTES COMUNES NO INTERACTIVAS: CABEZA, MANOS, PIES
        ======================================================== */}
        {/* 1. CABEZA (No interactúa) */}
        <G>
          {/* Sombra suave */}
          <Circle cx="145" cy="44" r="24" fill="rgba(203, 213, 225, 0.2)" />
          {/* Cabeza anatómica estilo Anime con peinado estilizado */}
          <Path
            d="M 145 16 C 130 16, 122 26, 122 42 C 122 55, 131 66, 140 70 L 142 77 L 148 77 L 150 70 C 159 66, 168 55, 168 42 C 168 26, 160 16, 145 16 Z"
            fill="url(#animeHeadGrad)"
            stroke="rgba(148, 163, 184, 0.6)"
            strokeWidth="1.4"
          />
          {/* Mechón sutil anime decorativo */}
          <Path
            d="M 134 26 C 142 30, 148 24, 156 28"
            stroke="rgba(167, 139, 250, 0.45)"
            strokeWidth="1.2"
            fill="none"
          />
          {/* Cuello */}
          <Path
            d="M 139 72 L 138 84 L 152 84 L 151 72 Z"
            fill="rgba(226, 232, 240, 0.85)"
            stroke="rgba(148, 163, 184, 0.5)"
            strokeWidth="1.2"
          />
        </G>

        {/* 2. MANOS (No interactúan) */}
        <G>
          {/* Mano derecha */}
          <Path
            d="M 46 220 C 44 225, 42 232, 45 237 C 47 241, 51 241, 53 236 L 55 220 Z"
            fill="rgba(226, 232, 240, 0.8)"
            stroke="rgba(148, 163, 184, 0.5)"
            strokeWidth="1.2"
          />
          {/* Mano izquierda */}
          <Path
            d="M 244 220 C 246 225, 248 232, 245 237 C 243 241, 239 241, 237 236 L 235 220 Z"
            fill="rgba(226, 232, 240, 0.8)"
            stroke="rgba(148, 163, 184, 0.5)"
            strokeWidth="1.2"
          />
        </G>

        {/* 3. PIES (No interactúan) */}
        <G>
          {/* Pie derecho */}
          <Path
            d="M 112 376 C 110 384, 106 392, 102 396 C 99 399, 105 401, 114 400 C 122 399, 124 394, 123 376 Z"
            fill="rgba(226, 232, 240, 0.8)"
            stroke="rgba(148, 163, 184, 0.5)"
            strokeWidth="1.2"
          />
          {/* Pie izquierdo */}
          <Path
            d="M 178 376 C 180 384, 184 392, 188 396 C 191 399, 185 401, 176 400 C 168 399, 166 394, 167 376 Z"
            fill="rgba(226, 232, 240, 0.8)"
            stroke="rgba(148, 163, 184, 0.5)"
            strokeWidth="1.2"
          />
        </G>

        {/* ========================================================
            VISTA FRONTAL (FRENTE)
        ======================================================== */}
        {view === 'front' && (
          <G>
            {/* PECHO (Interactivo) */}
            {renderMuscleSection(
              'chest',
              'M 136 84 C 114 84, 100 92, 92 104 C 88 116, 94 130, 116 132 C 132 134, 142 128, 145 116 C 148 128, 158 134, 174 132 C 196 130, 202 116, 198 104 C 190 92, 176 84, 154 84 Z',
              145,
              108
            )}

            {/* CINTURA (Interactivo) */}
            {renderMuscleSection(
              'waist',
              'M 116 133 C 132 134, 143 128, 145 118 C 147 128, 158 134, 174 133 L 170 174 C 158 178, 132 178, 120 174 Z',
              145,
              153
            )}

            {/* BRAZO DERECHO - Bíceps (Interactivo) */}
            {renderMuscleSection(
              'right_arm',
              'M 90 98 C 82 98, 72 108, 68 124 C 64 138, 62 152, 65 158 L 81 158 C 86 148, 91 132, 92 116 Z',
              77,
              128
            )}

            {/* BRAZO IZQUIERDO - Bíceps (Interactivo) */}
            {renderMuscleSection(
              'left_arm',
              'M 200 98 C 208 98, 218 108, 222 124 C 226 138, 228 152, 225 158 L 209 158 C 204 148, 199 132, 198 116 Z',
              213,
              128
            )}

            {/* ANTEBRAZO DERECHO (Interactivo) */}
            {renderMuscleSection(
              'right_forearm',
              'M 65 160 L 80 160 C 78 178, 73 198, 56 220 L 46 220 C 49 198, 57 176, 65 160 Z',
              64,
              188
            )}

            {/* ANTEBRAZO IZQUIERDO (Interactivo) */}
            {renderMuscleSection(
              'left_forearm',
              'M 225 160 L 210 160 C 212 178, 217 198, 234 220 L 244 220 C 241 198, 233 176, 225 160 Z',
              226,
              188
            )}

            {/* MUSLO DERECHO - Cuádriceps (Interactivo) */}
            {renderMuscleSection(
              'right_thigh',
              'M 120 175 L 143 176 L 140 240 C 138 262, 134 278, 126 284 L 110 284 C 104 274, 102 248, 105 218 C 108 194, 114 182, 120 175 Z',
              123,
              230
            )}

            {/* MUSLO IZQUIERDO - Cuádriceps (Interactivo) */}
            {renderMuscleSection(
              'left_thigh',
              'M 170 175 L 147 176 L 150 240 C 152 262, 156 278, 164 284 L 180 284 C 186 274, 188 248, 185 218 C 182 194, 176 182, 170 175 Z',
              167,
              230
            )}

            {/* PANTORRILLA DERECHA (Interactivo) */}
            {renderMuscleSection(
              'right_calf',
              'M 110 286 L 126 286 C 128 304, 130 334, 123 374 L 112 374 C 105 344, 104 314, 110 286 Z',
              117,
              330
            )}

            {/* PANTORRILLA IZQUIERDA (Interactivo) */}
            {renderMuscleSection(
              'left_calf',
              'M 180 286 L 164 286 C 162 304, 160 334, 167 374 L 178 374 C 185 344, 186 314, 180 286 Z',
              173,
              330
            )}
          </G>
        )}

        {/* ========================================================
            VISTA POSTERIOR (ESPALDA)
        ======================================================== */}
        {view === 'back' && (
          <G>
            {/* ESPALDA - Dorsales y Trapecios (Interactivo) */}
            {renderMuscleSection(
              'back',
              'M 138 84 L 152 84 C 172 86, 188 94, 196 106 C 202 118, 194 136, 178 144 C 168 148, 145 150, 145 150 C 145 150, 122 148, 112 144 C 96 136, 88 118, 94 106 C 102 94, 118 86, 138 84 Z',
              145,
              116
            )}

            {/* NALGAS / GLÚTEOS (Interactivo) */}
            {renderMuscleSection(
              'glutes',
              'M 118 152 C 132 154, 145 155, 145 160 C 145 155, 158 154, 172 152 C 186 160, 188 184, 174 198 C 162 208, 149 204, 145 198 C 141 204, 128 208, 116 198 C 102 184, 104 160, 118 152 Z',
              145,
              178
            )}

            {/* BRAZO DERECHO - Tríceps (Interactivo) */}
            {renderMuscleSection(
              'right_arm',
              'M 90 98 C 82 98, 72 108, 68 124 C 64 138, 62 152, 65 158 L 81 158 C 86 148, 91 132, 92 116 Z',
              77,
              128
            )}

            {/* BRAZO IZQUIERDO - Tríceps (Interactivo) */}
            {renderMuscleSection(
              'left_arm',
              'M 200 98 C 208 98, 218 108, 222 124 C 226 138, 228 152, 225 158 L 209 158 C 204 148, 199 132, 198 116 Z',
              213,
              128
            )}

            {/* ANTEBRAZO DERECHO (Interactivo) */}
            {renderMuscleSection(
              'right_forearm',
              'M 65 160 L 80 160 C 78 178, 73 198, 56 220 L 46 220 C 49 198, 57 176, 65 160 Z',
              64,
              188
            )}

            {/* ANTEBRAZO IZQUIERDO (Interactivo) */}
            {renderMuscleSection(
              'left_forearm',
              'M 225 160 L 210 160 C 212 178, 217 198, 234 220 L 244 220 C 241 198, 233 176, 225 160 Z',
              226,
              188
            )}

            {/* MUSLO DERECHO - Isquiotibiales (Interactivo) */}
            {renderMuscleSection(
              'right_thigh',
              'M 116 198 C 128 208, 141 204, 145 198 L 140 248 C 138 266, 134 278, 126 284 L 110 284 C 104 274, 102 248, 106 218 Z',
              123,
              244
            )}

            {/* MUSLO IZQUIERDO - Isquiotibiales (Interactivo) */}
            {renderMuscleSection(
              'left_thigh',
              'M 174 198 C 162 208, 149 204, 145 198 L 150 248 C 152 266, 156 278, 164 284 L 180 284 C 186 274, 188 248, 184 218 Z',
              167,
              244
            )}

            {/* PANTORRILLA DERECHA - Gemelos (Interactivo) */}
            {renderMuscleSection(
              'right_calf',
              'M 110 286 L 126 286 C 130 306, 132 334, 123 374 L 112 374 C 103 344, 102 314, 110 286 Z',
              117,
              330
            )}

            {/* PANTORRILLA IZQUIERDA - Gemelos (Interactivo) */}
            {renderMuscleSection(
              'left_calf',
              'M 180 286 L 164 286 C 160 306, 158 334, 167 374 L 178 374 C 187 344, 188 314, 180 286 Z',
              173,
              330
            )}
          </G>
        )}
      </Svg>

      {/* CHIPS FLOTANTES CLICKEABLES CON LAS MEDIDAS REGISTRADAS */}
      {view === 'front' ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Pecho Chip */}
          {measurements.chest !== undefined && (
            <FloatingMeasureChip
              label="Pecho"
              value={measurements.chest}
              top={92}
              left={170}
              onPress={() => onSelectPart('chest')}
            />
          )}

          {/* Cintura Chip */}
          {measurements.waist !== undefined && (
            <FloatingMeasureChip
              label="Cintura"
              value={measurements.waist}
              top={145}
              left={175}
              onPress={() => onSelectPart('waist')}
            />
          )}

          {/* Brazo Derecho */}
          {measurements.right_arm !== undefined && (
            <FloatingMeasureChip
              label="Bíceps D"
              value={measurements.right_arm}
              top={120}
              left={6}
              onPress={() => onSelectPart('right_arm')}
            />
          )}

          {/* Brazo Izquierdo */}
          {measurements.left_arm !== undefined && (
            <FloatingMeasureChip
              label="Bíceps I"
              value={measurements.left_arm}
              top={120}
              left={215}
              onPress={() => onSelectPart('left_arm')}
            />
          )}

          {/* Muslo Derecho */}
          {measurements.right_thigh !== undefined && (
            <FloatingMeasureChip
              label="Muslo D"
              value={measurements.right_thigh}
              top={222}
              left={38}
              onPress={() => onSelectPart('right_thigh')}
            />
          )}

          {/* Muslo Izquierdo */}
          {measurements.left_thigh !== undefined && (
            <FloatingMeasureChip
              label="Muslo I"
              value={measurements.left_thigh}
              top={222}
              left={188}
              onPress={() => onSelectPart('left_thigh')}
            />
          )}
        </View>
      ) : (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Espalda Chip */}
          {measurements.back !== undefined && (
            <FloatingMeasureChip
              label="Espalda"
              value={measurements.back}
              top={105}
              left={175}
              onPress={() => onSelectPart('back')}
            />
          )}

          {/* Nalgas Chip */}
          {measurements.glutes !== undefined && (
            <FloatingMeasureChip
              label="Nalgas"
              value={measurements.glutes}
              top={170}
              left={175}
              onPress={() => onSelectPart('glutes')}
            />
          )}

          {/* Pantorrilla Derecha */}
          {measurements.right_calf !== undefined && (
            <FloatingMeasureChip
              label="Gemelo D"
              value={measurements.right_calf}
              top={320}
              left={35}
              onPress={() => onSelectPart('right_calf')}
            />
          )}

          {/* Pantorrilla Izquierda */}
          {measurements.left_calf !== undefined && (
            <FloatingMeasureChip
              label="Gemelo I"
              value={measurements.left_calf}
              top={320}
              left={188}
              onPress={() => onSelectPart('left_calf')}
            />
          )}
        </View>
      )}
    </View>
  );
}

/* ==========================================================
   CHIP FLOTANTE DE MEDIDA SOBRE EL CROQUIS
========================================================== */
function FloatingMeasureChip({
  label,
  value,
  top,
  left,
  onPress,
}: {
  label: string;
  value: number;
  top: number;
  left: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[measureStyles.floatingChipContainer, { top, left }]}
    >
      <View style={measureStyles.floatingChipBadge}>
        <Text style={measureStyles.floatingChipLabel}>{label}</Text>
        <Text style={measureStyles.floatingChipValue}>{value} cm</Text>
      </View>
    </Pressable>
  );
}

/* ==========================================================
   RESUMEN EN GRID DE TODAS LAS MEDIDAS CORPORALES
========================================================== */
function MeasurementsSummaryGrid({
  measurements,
  onSelectPart,
}: {
  measurements: DayMeasurements;
  onSelectPart: (p: BodyPartKey) => void;
}) {
  const sections: {
    title: string;
    icon: any;
    color: string;
    keys: BodyPartKey[];
  }[] = [
    {
      title: 'Torso & Espalda',
      icon: 'shield-outline',
      color: C.pastelPurple,
      keys: ['chest', 'back', 'waist', 'glutes'],
    },
    {
      title: 'Brazos & Antebrazos',
      icon: 'barbell-outline',
      color: '#EC4899',
      keys: ['right_arm', 'left_arm', 'right_forearm', 'left_forearm'],
    },
    {
      title: 'Piernas & Pantorrillas',
      icon: 'walk-outline',
      color: '#10B981',
      keys: ['right_thigh', 'left_thigh', 'right_calf', 'left_calf'],
    },
  ];

  return (
    <View style={measureStyles.gridContainer}>
      <View style={measureStyles.gridHeaderRow}>
        <View style={measureStyles.gridHeaderTag}>
          <Ionicons name="list-outline" size={13} color={C.pastelPurple} />
          <Text style={measureStyles.gridHeaderTagText}>REGISTRO RÁPIDO</Text>
        </View>
        <Text style={measureStyles.gridHeaderTitle}>Todas las medidas</Text>
      </View>

      {sections.map((sec) => (
        <View key={sec.title} style={measureStyles.sectionBlock}>
          <View style={measureStyles.sectionHeaderRow}>
            <Ionicons name={sec.icon} size={15} color={sec.color} />
            <Text style={measureStyles.sectionTitle}>{sec.title}</Text>
          </View>

          <View style={measureStyles.cardsGrid}>
            {sec.keys.map((k) => {
              const info = BODY_PARTS_INFO[k];
              const val = measurements[k];
              const hasVal = val !== undefined && val > 0;

              return (
                <Pressable
                  key={k}
                  onPress={() => onSelectPart(k)}
                  style={({ pressed }) => [
                    measureStyles.itemCard,
                    hasVal && measureStyles.itemCardActive,
                    pressed && s.btnPressed,
                  ]}
                >
                  <View style={measureStyles.itemCardTop}>
                    <Text style={measureStyles.itemCardLabel} numberOfLines={1}>
                      {info.label}
                    </Text>
                    {hasVal ? (
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    ) : (
                      <Ionicons name="add-circle-outline" size={14} color={C.subMuted} />
                    )}
                  </View>

                  <View style={measureStyles.itemCardBottom}>
                    {hasVal ? (
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                        <Text style={measureStyles.itemCardValNum}>{val}</Text>
                        <Text style={measureStyles.itemCardValUnit}>cm</Text>
                      </View>
                    ) : (
                      <Text style={measureStyles.itemCardEmpty}>+ Medir</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

/* ==========================================================
   MODAL PARA AGREGAR O EDITAR LA MEDIDA
========================================================== */
function MeasurementEditModal({
  visible,
  partKey,
  currentValue,
  dateKeyStr,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  partKey: BodyPartKey;
  currentValue?: number;
  dateKeyStr: string;
  onClose: () => void;
  onSave: (val: number) => void;
  onDelete: () => void;
}) {
  const info = BODY_PARTS_INFO[partKey];
  const [valStr, setValStr] = useState<string>(
    currentValue !== undefined ? String(currentValue) : String(info.defaultAvg || 30)
  );

  const numVal = parseFloat(valStr) || 0;

  const adjustVal = (delta: number) => {
    const updated = Math.max(0, Math.round((numVal + delta) * 10) / 10);
    setValStr(String(updated));
  };

  const handleSave = () => {
    const parsed = parseFloat(valStr.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Valor inválido', 'Por favor ingresa un número de medida válido mayor a 0 cm.');
      return;
    }
    onSave(parsed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={measureStyles.modalDialogCard} onPress={(e) => e.stopPropagation()}>
          {/* Cabecera del Modal */}
          <View style={measureStyles.modalHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={measureStyles.modalIconCircle}>
                <Ionicons name={info.icon} size={20} color={C.pastelPurple} />
              </View>
              <View>
                <Text style={measureStyles.modalTitle}>{info.label}</Text>
                <Text style={measureStyles.modalSubtitle}>Fecha: {dateKeyStr}</Text>
              </View>
            </View>

            <Pressable onPress={onClose} style={measureStyles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={C.sub} />
            </Pressable>
          </View>

          {/* Campo Central Grande con Teclado Numérico y Ajustes */}
          <View style={measureStyles.numberInputBigContainer}>
            <Text style={measureStyles.numberInputHint}>Perímetro corporal</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
              <TextInput
                value={valStr}
                onChangeText={setValStr}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
                style={measureStyles.numberInputBig}
              />
              <Text style={measureStyles.numberUnitBig}>cm</Text>
            </View>

            {/* Steppers rápidos de ajuste (+/- 0.5, +/- 1.0) */}
            <View style={measureStyles.stepperRow}>
              {[-1.0, -0.5, +0.5, +1.0].map((step) => (
                <Pressable
                  key={step}
                  onPress={() => adjustVal(step)}
                  style={({ pressed }) => [
                    measureStyles.stepperBtn,
                    pressed && s.btnPressed,
                  ]}
                >
                  <Text style={measureStyles.stepperBtnText}>
                    {step > 0 ? `+${step}` : `${step}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Botones de Acción */}
          <View style={measureStyles.modalActionsRow}>
            {currentValue !== undefined && (
              <Pressable
                onPress={() => {
                  Alert.alert(
                    'Eliminar medida',
                    `¿Deseas eliminar la medida de ${info.label}?`,
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Eliminar', style: 'destructive', onPress: onDelete },
                    ]
                  );
                }}
                style={measureStyles.deleteActionBtn}
              >
                <Ionicons name="trash-outline" size={18} color={C.danger} />
              </Pressable>
            )}

            <View style={{ flex: 1 }}>
              <PrimaryButton
                icon="checkmark-circle"
                label="Guardar medida"
                onPress={handleSave}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ==========================================================
   PESTAÑA 2: SECCIÓN FOTOS DE PROGRESO
========================================================== */
function ProgressPhotosSection({
  date,
  setDate,
  photos,
}: {
  date: Date;
  setDate: (d: Date) => void;
  photos: ProgressPhoto[];
}) {
  const angles: { key: 'front' | 'side' | 'back'; label: string; icon: any }[] = [
    { key: 'front', label: 'Frente', icon: 'person-outline' },
    { key: 'side', label: 'Perfil', icon: 'body-outline' },
    { key: 'back', label: 'Espalda', icon: 'refresh-outline' },
  ];

  return (
    <View style={{ marginTop: 2 }}>
      {/* Selector de Fecha */}
      <DateSelector date={date} onChange={setDate} />

      {/* Tarjeta de Galería Fotográfica */}
      <View style={measureStyles.croquisGlassCard}>
        <LinearGradient colors={GRADIENTS.cardGlass} style={measureStyles.croquisCardGradient}>
          <View style={measureStyles.croquisHeaderRow}>
            <View>
              <View style={s.hudBadge}>
                <Ionicons name="camera-outline" size={11} color={C.pastelPurple} />
                <Text style={s.hudBadgeText}>✦ REGISTRO FOTOGRÁFICO ✦</Text>
              </View>
              <Text style={measureStyles.croquisSubTitle}>
                Compara tu transformación física día a día
              </Text>
            </View>
          </View>

          <View style={measureStyles.photosGrid}>
            {angles.map((ang) => {
              const photo = photos.find((p) => p.angle === ang.key);
              return (
                <View key={ang.key} style={measureStyles.photoSlotCard}>
                  <View style={measureStyles.photoSlotHeader}>
                    <Ionicons name={ang.icon} size={13} color={C.pastelPurple} />
                    <Text style={measureStyles.photoSlotTitle}>{ang.label}</Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        `Fotografía de ${ang.label}`,
                        'Elige una opción para registrar tu avance físico:',
                        [
                          { text: 'Tomar Foto con Cámara', onPress: () => {} },
                          { text: 'Seleccionar de Galería', onPress: () => {} },
                          { text: 'Cancelar', style: 'cancel' },
                        ]
                      );
                    }}
                    style={measureStyles.photoSlotEmptyBox}
                  >
                    <Ionicons name="camera" size={32} color={C.pastelPurple} />
                    <Text style={measureStyles.photoSlotUploadText}>+ Añadir foto</Text>
                    <Text style={measureStyles.photoSlotSubText}>Ángulo {ang.label.toLowerCase()}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

/* ==========================================================
   ESTILOS DE LA PANTALLA MEDIDAS
========================================================== */
const measureStyles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cyberTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  cyberTagText: {
    color: C.pastelPurple,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  screenTitle: {
    color: C.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerBadgeMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  headerBadgeMiniText: {
    color: C.pastelPurple,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Tarjeta de Croquis
  croquisGlassCard: {
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.borderLight,
    overflow: 'hidden',
    backgroundColor: C.bgCard,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  croquisCardGradient: {
    padding: 16,
  },
  cardOrb1: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
  },
  cardOrb2: {
    position: 'absolute',
    bottom: -30,
    right: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(244, 114, 182, 0.16)',
  },
  croquisHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  croquisSubTitle: {
    color: C.sub,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 3,
  },
  measureProgressBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  measureProgressText: {
    color: C.pastelPurple,
    fontSize: 14,
    fontWeight: '900',
  },
  measureProgressSub: {
    color: C.subMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Selector Vista Frontal / Posterior
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(238, 242, 255, 0.9)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  viewToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    gap: 6,
  },
  viewToggleBtnActive: {
    backgroundColor: C.pastelPurple,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  viewToggleText: {
    color: C.sub,
    fontSize: 12,
    fontWeight: '700',
  },
  viewToggleTextActive: {
    color: '#FFFFFF',
  },

  // Contenedor SVG
  bodySvgCanvasWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  svgContainer: {
    width: 290,
    height: 410,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Chips flotantes sobre la silueta
  floatingChipContainer: {
    position: 'absolute',
    zIndex: 10,
  },
  floatingChipBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
    alignItems: 'center',
  },
  floatingChipLabel: {
    color: C.sub,
    fontSize: 8.5,
    fontWeight: '700',
  },
  floatingChipValue: {
    color: '#8B5CF6',
    fontSize: 11,
    fontWeight: '900',
  },

  // Leyenda
  croquisLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.6)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: C.sub,
    fontSize: 10,
    fontWeight: '600',
  },

  // Grid de Medidas Resumen
  gridContainer: {
    marginTop: 4,
  },
  gridHeaderRow: {
    marginBottom: 10,
  },
  gridHeaderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  gridHeaderTagText: {
    color: C.pastelPurple,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  gridHeaderTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionBlock: {
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 13.5,
    fontWeight: '800',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemCard: {
    width: '48.6%',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  itemCardActive: {
    borderColor: 'rgba(139, 92, 246, 0.4)',
    backgroundColor: '#FAF5FF',
  },
  itemCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemCardLabel: {
    color: C.sub,
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
  itemCardBottom: {
    marginTop: 2,
  },
  itemCardValNum: {
    color: C.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  itemCardValUnit: {
    color: C.pastelPurple,
    fontSize: 11,
    fontWeight: '800',
  },
  itemCardEmpty: {
    color: C.pastelPurple,
    fontSize: 12,
    fontWeight: '700',
  },

  // Modal de Edición
  modalDialogCard: {
    width: '90%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: C.sub,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 6,
  },
  numberInputBigContainer: {
    backgroundColor: '#F8FAFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  numberInputHint: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  numberInputBig: {
    color: C.text,
    fontSize: 40,
    fontWeight: '900',
    textAlign: 'center',
    minWidth: 100,
    paddingVertical: 2,
  },
  numberUnitBig: {
    color: C.pastelPurple,
    fontSize: 22,
    fontWeight: '900',
    marginLeft: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  stepperBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  stepperBtnText: {
    color: C.pastelPurple,
    fontSize: 12,
    fontWeight: '800',
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.dangerBg,
    borderWidth: 1,
    borderColor: C.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Fotos de Progreso
  photosGrid: {
    gap: 12,
    marginTop: 4,
  },
  photoSlotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  photoSlotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  photoSlotTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '800',
  },
  photoSlotEmptyBox: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(167, 139, 250, 0.4)',
    backgroundColor: 'rgba(245, 247, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoSlotUploadText: {
    color: C.pastelPurple,
    fontSize: 13,
    fontWeight: '800',
  },
  photoSlotSubText: {
    color: C.subMuted,
    fontSize: 10,
    fontWeight: '600',
  },
});
