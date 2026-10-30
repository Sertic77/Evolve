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
  KeyboardAvoidingView,
  Keyboard,
  Image,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  G,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Line,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, GRADIENTS } from './theme';
import { DateSelector, PrimaryButton, s } from './components';
import {
  useStore,
  dateKey,
  BodyPartKey,
  DayMeasurements,
  ProgressPhoto,
} from './store';

/* ==========================================================
   CONFIGURACIÓN Y METADATOS DE PARTES DEL CUERPO
========================================================== */
export type GenderModel = 'male' | 'female';

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
    shortLabel: 'Bíceps D',
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
    shortLabel: 'Bíceps I',
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
    shortLabel: 'Gemelo D',
    category: 'legs',
    interactive: true,
    view: 'back',
    icon: 'footsteps-outline',
    defaultAvg: 37,
    unit: 'cm',
  },
  left_calf: {
    key: 'left_calf',
    label: 'Pantorilla izquierda',
    shortLabel: 'Gemelo I',
    category: 'legs',
    interactive: true,
    view: 'back',
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

  const {
    measurementLogs,
    weightLogs,
    photoLogs,
    setPartMeasurement,
    deletePartMeasurement,
    setDayWeight,
    deleteDayWeight,
  } = useStore();

  const dayMeasurements = measurementLogs[key] || {};
  const dayWeight = weightLogs[key];
  const dayPhotos = photoLogs[key] || [];

  // Modelo del croquis: 'male' (Hombre musculoso) vs 'female' (Mujer esbelta/fit)
  const [genderModel, setGenderModel] = useState<GenderModel>('male');
  const [genderModalOpen, setGenderModalOpen] = useState(false);

  // Vista anatómica: 'front' (Frente) o 'back' (Espalda)
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front');

  // Modal de peso corporal
  const [weightModalOpen, setWeightModalOpen] = useState(false);

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

  // Músculo enfocado en la gráfica de crecimiento (por defecto 'chest')
  const [selectedChartPart, setSelectedChartPart] = useState<BodyPartKey>('chest');

  // Manejo de clic en parte anatómica
  const handlePartPress = (partKey: BodyPartKey) => {
    const info = BODY_PARTS_INFO[partKey];
    if (!info || !info.interactive) {
      return; // Cabeza, manos, pies no interactúan
    }
    setSelectedPart(partKey);
    // Sincronizar gráfica al músculo tocado
    setSelectedChartPart(partKey);
  };

  return (
    <View style={measureStyles.rootContainer}>
      <ScrollView
        contentContainerStyle={measureStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[1]}
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

        {/* SELECTOR DE MODO: MEDIDAS vs FOTOS (Sticky al hacer scroll down) */}
        <View style={measureStyles.stickyTabsContainer}>
          <MeasureModeSegmented value={tab} onChange={setTab} />
        </View>

        {/* CONTENIDO SEGÚN PESTAÑA */}
        <Animated.View
          style={{
            opacity: tabContentFade,
            transform: [{ translateY: tabContentSlide }],
          }}
        >
          {tab === 0 ? (
            /* ==========================================================
               PESTAÑA 1: MEDIDAS (Calendario + Croquis con Peso integrado + Lista)
            ========================================================== */
            <View style={{ marginTop: 2 }}>
              {/* Botón de Calendario (por defecto hoy) */}
              <DateSelector date={date} onChange={setDate} />

              {/* CROQUIS DEL CUERPO HUMANO TIPO ANIME (Con peso integrado en esquina inferior izquierda) */}
              <AnimeBodyMapCard
                genderModel={genderModel}
                onOpenModelSelect={() => setGenderModalOpen(true)}
                bodyView={bodyView}
                onChangeView={setBodyView}
                measurements={dayMeasurements}
                weight={dayWeight}
                onOpenWeightModal={() => setWeightModalOpen(true)}
                onSelectPart={handlePartPress}
              />

              {/* GRÁFICA INTERACTIVA DE CRECIMIENTO MUSCULAR (7D, 30D, 90D, Todo el historial) */}
              <BodyPartGrowthChartCard
                measurementLogs={measurementLogs}
                selectedPart={selectedChartPart}
                onSelectPart={setSelectedChartPart}
                onOpenEditModal={handlePartPress}
              />

              {/* LISTA DE MEDIDAS RÁPIDAS DEL DÍA (Registro Rápido) */}
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

      {/* SELECTOR MODAL DE MODELO DE CROQUIS (Hombre / Mujer) */}
      <GenderModelSelectModal
        visible={genderModalOpen}
        currentModel={genderModel}
        onSelect={(m) => {
          setGenderModel(m);
          setGenderModalOpen(false);
        }}
        onClose={() => setGenderModalOpen(false)}
      />

      {/* MODAL PARA AGREGAR / EDITAR PESO CORPORAL */}
      <WeightEditModal
        visible={weightModalOpen}
        currentWeight={dayWeight}
        dateKeyStr={key}
        onClose={() => setWeightModalOpen(false)}
        onSave={(w) => {
          setDayWeight(key, w);
          setWeightModalOpen(false);
        }}
        onDelete={() => {
          deleteDayWeight(key);
          setWeightModalOpen(false);
        }}
      />

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
  genderModel,
  onOpenModelSelect,
  bodyView,
  onChangeView,
  measurements,
  weight,
  onOpenWeightModal,
  onSelectPart,
}: {
  genderModel: GenderModel;
  onOpenModelSelect: () => void;
  bodyView: 'front' | 'back';
  onChangeView: (v: 'front' | 'back') => void;
  measurements: DayMeasurements;
  weight?: number;
  onOpenWeightModal: () => void;
  onSelectPart: (p: BodyPartKey) => void;
}) {
  const registeredCount = Object.keys(measurements).length;
  const { width: windowWidth } = useWindowDimensions();
  // Escala proporcional exacta al lienzo nativo 516x1024 de las ilustraciones
  const canvasWidth = Math.round(Math.min(308, Math.max(252, windowWidth - 64)));
  const canvasHeight = Math.round(canvasWidth * (1024 / 516));

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
        {/* Encabezado: BOTÓN DE SELECT OPTION PARA ESCOGER MODELO DE CROQUIS */}
        <View style={measureStyles.croquisHeaderRow}>
          <View style={{ flex: 1, marginRight: 10 }}>
            {/* BOTÓN SELECTOR DE CROQUIS */}
            <Pressable
              onPress={onOpenModelSelect}
              style={({ pressed }) => [
                measureStyles.croquisSelectorBtn,
                pressed && s.btnPressed,
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <LinearGradient
                  colors={genderModel === 'male' ? ['#8B5CF6', '#60A5FA'] : ['#EC4899', '#F472B6']}
                  style={measureStyles.modelIconBadge}
                >
                  <Ionicons
                    name={genderModel === 'male' ? 'barbell' : 'sparkles'}
                    size={11}
                    color="#FFFFFF"
                  />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={measureStyles.croquisSelectorTitle} numberOfLines={1}>
                    {genderModel === 'male' ? 'Hombre (Musculoso)' : 'Mujer (Esbelta / Fit)'}
                  </Text>
                  <Text style={measureStyles.croquisSelectorHint}>
                    Cambiar silueta anime ▾
                  </Text>
                </View>
              </View>
              <Ionicons name="swap-horizontal" size={16} color={C.pastelPurple} />
            </Pressable>
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

        {/* LIENZO SVG: SILUETA ANIME DEL CUERPO HUMANO CON BURBUJAS Y PESO INTEGRADO */}
        <View style={measureStyles.bodySvgCanvasWrapper}>
          <View style={[measureStyles.svgStageBox, { width: canvasWidth, height: canvasHeight }]}>
            <AnimeBodyVector
              genderModel={genderModel}
              view={bodyView}
              measurements={measurements}
              onSelectPart={onSelectPart}
              width={canvasWidth}
              height={canvasHeight}
            />

            {/* BURBUJAS FLOTANTES DE MEDIDA (Alineadas proporcionalmente sin tapar músculos) */}
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {bodyView === 'front' ? (
                <>
                  {/* 1. Pecho */}
                  <BodyMeasureBubble
                    label="Pecho"
                    value={measurements.chest}
                    top={Math.round(canvasHeight * 0.092)}
                    left={7}
                    onPress={() => onSelectPart('chest')}
                  />

                  {/* 2. Bíceps Derecho */}
                  <BodyMeasureBubble
                    label="Bíceps D"
                    value={measurements.right_arm}
                    top={Math.round(canvasHeight * 0.190)}
                    left={6}
                    onPress={() => onSelectPart('right_arm')}
                  />

                  {/* 3. Bíceps Izquierdo */}
                  <BodyMeasureBubble
                    label="Bíceps I"
                    value={measurements.left_arm}
                    top={Math.round(canvasHeight * 0.190)}
                    right={6}
                    onPress={() => onSelectPart('left_arm')}
                  />

                  {/* 4. Cintura */}
                  <BodyMeasureBubble
                    label="Cintura"
                    value={measurements.waist}
                    top={Math.round(canvasHeight * 0.355)}
                    right={6}
                    onPress={() => onSelectPart('waist')}
                  />

                  {/* 5. Muslo Derecho */}
                  <BodyMeasureBubble
                    label="Muslo D"
                    value={measurements.right_thigh}
                    top={Math.round(canvasHeight * 0.588)}
                    left={6}
                    onPress={() => onSelectPart('right_thigh')}
                  />

                  {/* 6. Muslo Izquierdo */}
                  <BodyMeasureBubble
                    label="Muslo I"
                    value={measurements.left_thigh}
                    top={Math.round(canvasHeight * 0.588)}
                    right={6}
                    onPress={() => onSelectPart('left_thigh')}
                  />
                </>
              ) : (
                <>
                  {/* 1. Espalda */}
                  <BodyMeasureBubble
                    label="Espalda"
                    value={measurements.back}
                    top={Math.round(canvasHeight * 0.092)}
                    left={7}
                    onPress={() => onSelectPart('back')}
                  />

                  {/* 2. Antebrazo Derecho */}
                  <BodyMeasureBubble
                    label="Antebrazo D"
                    value={measurements.right_forearm}
                    top={Math.round(canvasHeight * 0.215)}
                    left={6}
                    onPress={() => onSelectPart('right_forearm')}
                  />

                  {/* 3. Antebrazo Izquierdo */}
                  <BodyMeasureBubble
                    label="Antebrazo I"
                    value={measurements.left_forearm}
                    top={Math.round(canvasHeight * 0.215)}
                    right={6}
                    onPress={() => onSelectPart('left_forearm')}
                  />

                  {/* 4. Nalgas (Glúteos) */}
                  <BodyMeasureBubble
                    label="Nalgas"
                    value={measurements.glutes}
                    top={Math.round(canvasHeight * 0.578)}
                    right={6}
                    onPress={() => onSelectPart('glutes')}
                  />

                  {/* 5. Gemelo Derecho (Pantorrilla D) */}
                  <BodyMeasureBubble
                    label="Gemelo D"
                    value={measurements.right_calf}
                    top={Math.round(canvasHeight * 0.742)}
                    left={6}
                    onPress={() => onSelectPart('right_calf')}
                  />

                  {/* 6. Gemelo Izquierdo (Pantorrilla I) */}
                  <BodyMeasureBubble
                    label="Gemelo I"
                    value={measurements.left_calf}
                    top={Math.round(canvasHeight * 0.742)}
                    right={6}
                    onPress={() => onSelectPart('left_calf')}
                  />
                </>
              )}

              {/* WIDGET DE PESO INTEGRADO EN LA ESQUINA INFERIOR IZQUIERDA DEL CROQUIS */}
              <Pressable
                onPress={onOpenWeightModal}
                style={({ pressed }) => [
                  measureStyles.integratedWeightWidget,
                  pressed && s.btnPressed,
                ]}
              >
                <View style={measureStyles.integratedWeightIconCircle}>
                  <Ionicons name="scale-outline" size={14} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={measureStyles.integratedWeightTag}>PESO</Text>
                  <Text style={measureStyles.integratedWeightValue}>
                    {weight !== undefined && weight > 0 ? `${weight} kg` : '+ Añadir'}
                  </Text>
                </View>
                <Ionicons name="pencil-outline" size={11} color="#F0ABFC" style={{ marginLeft: 3 }} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Leyenda interactiva inferior */}
        <View style={measureStyles.croquisLegendRow}>
          <View style={measureStyles.legendItem}>
            <View style={[measureStyles.legendDot, { backgroundColor: '#8B5CF6' }]} />
            <Text style={measureStyles.legendLabel}>Medido</Text>
          </View>
          <View style={measureStyles.legendItem}>
            <View style={[measureStyles.legendDot, { backgroundColor: 'rgba(167, 139, 250, 0.25)', borderColor: '#A78BFA', borderWidth: 1 }]} />
            <Text style={measureStyles.legendLabel}>Por medir (Toca músculo o burbuja)</Text>
          </View>
          <View style={measureStyles.legendItem}>
            <View style={[measureStyles.legendDot, { backgroundColor: 'rgba(203, 213, 225, 0.4)' }]} />
            <Text style={measureStyles.legendLabel}>Fijo</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

/* ==========================================================
   BURBUJA FLOTANTE INTERACTIVA DE MEDIDA (SIEMPRE VISIBLE)
========================================================== */
function BodyMeasureBubble({
  label,
  value,
  top,
  left,
  right,
  onPress,
}: {
  label: string;
  value?: number;
  top: number;
  left?: number;
  right?: number;
  onPress: () => void;
}) {
  const hasVal = value !== undefined && value > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        measureStyles.floatingBubbleContainer,
        { top },
        left !== undefined && { left },
        right !== undefined && { right },
        pressed && s.btnPressed,
      ]}
    >
      <View
        style={[
          measureStyles.floatingBubbleBadge,
          hasVal
            ? measureStyles.floatingBubbleBadgeActive
            : measureStyles.floatingBubbleBadgeEmpty,
        ]}
      >
        <Text
          style={[
            measureStyles.floatingBubbleLabel,
            hasVal && measureStyles.floatingBubbleLabelActive,
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            measureStyles.floatingBubbleValue,
            hasVal && measureStyles.floatingBubbleValueActive,
          ]}
        >
          {hasVal ? `${value} cm` : '+'}
        </Text>
      </View>
    </Pressable>
  );
}

/* ==========================================================
   MODAL DE SELECCIÓN DE MODELO DE CROQUIS
========================================================== */
function GenderModelSelectModal({
  visible,
  currentModel,
  onSelect,
  onClose,
}: {
  visible: boolean;
  currentModel: GenderModel;
  onSelect: (m: GenderModel) => void;
  onClose: () => void;
}) {
  const models: {
    key: GenderModel;
    title: string;
    subtitle: string;
    badge: string;
    icon: any;
    colors: readonly [string, string];
  }[] = [
    {
      key: 'male',
      title: 'Hombre (Musculoso / V-Taper)',
      subtitle: 'Proporciones atléticas masculinas: hombros amplios, espalda V, pecho firme y piernas definidas.',
      badge: 'ESTILO SHONEN',
      icon: 'barbell-outline',
      colors: ['#8B5CF6', '#60A5FA'] as const,
    },
    {
      key: 'female',
      title: 'Mujer (Esbelta / Fit Hourglass)',
      subtitle: 'Proporciones atléticas femeninas: cintura esbelta, glúteos torneados y silueta tonificada.',
      badge: 'ESTILO FITNESS FIT',
      icon: 'sparkles-outline',
      colors: ['#EC4899', '#F472B6'] as const,
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={measureStyles.modalBackdropOverlay} onPress={onClose}>
        <Pressable style={measureStyles.selectModelCard} onPress={(e) => e.stopPropagation()}>
          <View style={measureStyles.selectModelHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="body" size={18} color={C.pastelPurple} />
              <Text style={measureStyles.selectModelTitle}>Escoge tu Croquis Anime</Text>
            </View>
            <Pressable onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={20} color={C.sub} />
            </Pressable>
          </View>

          <Text style={measureStyles.selectModelDescription}>
            Selecciona el modelo anatómico estilizado que mejor represente tus objetivos físicos:
          </Text>

          <View style={{ gap: 10, marginTop: 14 }}>
            {models.map((m) => {
              const active = currentModel === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => onSelect(m.key)}
                  style={({ pressed }) => [
                    measureStyles.modelOptionBtn,
                    active && measureStyles.modelOptionBtnActive,
                    pressed && s.btnPressed,
                  ]}
                >
                  <LinearGradient
                    colors={m.colors}
                    style={measureStyles.modelOptionIconGradient}
                  >
                    <Ionicons name={m.icon} size={22} color="#FFFFFF" />
                  </LinearGradient>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={measureStyles.modelOptionTitle}>{m.title}</Text>
                      {active && (
                        <View style={measureStyles.activeModelTag}>
                          <Text style={measureStyles.activeModelTagText}>ACTIVO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={measureStyles.modelOptionSubtitle}>{m.subtitle}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ==========================================================
   CROQUIS ANIME CYBER-HUD: ILUSTRACIONES 516x1024 CON ZONAS
   CLICABLES PROPORCIONALES AL CUERPO Y LÍNEAS GUÍA HUD
========================================================== */
function AnimeBodyVector({
  genderModel,
  view,
  measurements,
  onSelectPart,
  width,
  height,
}: {
  genderModel: GenderModel;
  view: 'front' | 'back';
  measurements: DayMeasurements;
  onSelectPart: (p: BodyPartKey) => void;
  width: number;
  height: number;
}) {
  const imageSource =
    genderModel === 'male'
      ? view === 'front'
        ? require('../assets/croquis/male_front.png')
        : require('../assets/croquis/male_back.png')
      : view === 'front'
      ? require('../assets/croquis/female_front.png')
      : require('../assets/croquis/female_back.png');

  const isMale = genderModel === 'male';

  // Renderiza área anatómica proporcional (516x1024) con hit-test directo en Path
  const renderMuscleTarget = (
    partKey: BodyPartKey,
    d: string,
    centerX: number,
    centerY: number,
    isPrimaryForView: boolean
  ) => {
    const val = measurements[partKey];
    const isMeasured = val !== undefined && val > 0;
    const showHighlight = isMeasured && isPrimaryForView;

    return (
      <G key={`${view}_${partKey}`}>
        {showHighlight && (
          <Path
            d={d}
            fill="none"
            stroke="rgba(217, 70, 239, 0.35)"
            strokeWidth={7}
            strokeLinejoin="round"
            strokeLinecap="round"
            pointerEvents="none"
          />
        )}
        <Path
          d={d}
          onPress={() => onSelectPart(partKey)}
          fill={showHighlight ? 'rgba(232, 121, 249, 0.28)' : 'rgba(255, 255, 255, 0.008)'}
          stroke={showHighlight ? '#F0ABFC' : 'transparent'}
          strokeWidth={showHighlight ? 2.6 : 0}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {isPrimaryForView && (
          <G pointerEvents="none">
            {showHighlight && (
              <Circle
                cx={centerX}
                cy={centerY}
                r={11}
                fill="rgba(232, 121, 249, 0.32)"
              />
            )}
            <Circle
              cx={centerX}
              cy={centerY}
              r={showHighlight ? 5.5 : 3.8}
              fill={showHighlight ? '#E879F9' : 'rgba(248, 250, 252, 0.75)'}
              stroke={showHighlight ? '#FFFFFF' : 'rgba(196, 181, 253, 0.7)'}
              strokeWidth={1.6}
            />
          </G>
        )}
      </G>
    );
  };

  // Línea guía estilo escáner HUD desde la burbuja hasta el músculo (no intercepta toques)
  const renderHudCallout = (partKey: BodyPartKey, d: string) => {
    const val = measurements[partKey];
    const active = val !== undefined && val > 0;
    return (
      <Path
        key={`hud_${partKey}`}
        d={d}
        fill="none"
        stroke={active ? 'rgba(240, 171, 252, 0.85)' : 'rgba(226, 232, 240, 0.42)'}
        strokeWidth={active ? 2 : 1.4}
        strokeDasharray={active ? undefined : '4,4'}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />
    );
  };

  return (
    <View style={[measureStyles.svgContainer, { width, height }]}>
      {/* 1. Ilustración Anime Cyber-HUD 516x1024 en proporción 1:1 exacta */}
      <Image
        source={imageSource}
        style={[measureStyles.croquisIllustrationImage, { width, height }]}
        resizeMode="cover"
      />

      {/* 2. Capa Interactiva SVG 516x1024 perfectamente sincronizada con la imagen */}
      <Svg
        width={width}
        height={height}
        viewBox="0 0 516 1024"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        {/* Marco HUD sutil para unificar estética sci-fi en modelo femenino */}
        {!isMale && (
          <G pointerEvents="none">
            <Path
              d="M 16 150 L 16 32 L 34 14 L 180 14 M 336 14 L 482 14 L 500 32 L 500 150 M 16 874 L 16 992 L 34 1010 L 180 1010 M 336 1010 L 482 1010 L 500 992 L 500 874"
              fill="none"
              stroke="rgba(226, 232, 240, 0.38)"
              strokeWidth={1.6}
            />
          </G>
        )}

        {/* ========================================================
            VISTA FRONTAL (FRENTE)
        ======================================================== */}
        {view === 'front' && (
          <G>
            {isMale ? (
              <>
                {renderMuscleTarget('chest', 'M 170.0 215.2 Q 174 206 184.1 206.9 L 209.9 209.1 Q 220 210 228.4 211.8 L 249.6 216.2 Q 258 218 266.4 216.2 L 287.6 211.8 Q 296 210 306.1 209.1 L 331.9 206.9 Q 342 206 346.0 215.2 L 356.0 238.8 Q 360 248 357.8 258.3 L 352.2 284.7 Q 350 295 339.4 297.4 L 312.6 303.6 Q 302 306 292.3 302.9 L 267.7 295.1 Q 258 292 248.3 295.1 L 223.7 302.9 Q 214 306 203.4 303.6 L 176.6 297.4 Q 166 295 163.8 284.7 L 158.2 258.3 Q 156 248 160.0 238.8 Z', 234, 254, true)}
                {renderMuscleTarget('waist', 'M 166.0 302.1 Q 166 297 176.6 299.4 L 203.4 305.6 Q 214 308 223.7 305.1 L 248.3 297.9 Q 258 295 267.7 297.9 L 292.3 305.1 Q 302 308 312.6 305.6 L 339.4 299.4 Q 350 297 350.0 302.1 L 350.0 314.9 Q 350 320 346.9 334.3 L 339.1 370.7 Q 336 385 335.6 399.3 L 334.4 435.7 Q 334 450 317.3 454.0 L 274.7 464.0 Q 258 468 241.3 464.0 L 198.7 454.0 Q 182 450 181.6 435.7 L 180.4 399.3 Q 180 385 176.9 370.7 L 169.1 334.3 Q 166 320 166.0 314.9 Z', 258, 382, true)}
                {renderMuscleTarget('right_arm', 'M 165.1 213.7 Q 168 204 160.1 205.3 L 139.9 208.7 Q 132 210 127.2 215.7 L 114.8 230.3 Q 110 236 107.4 244.6 L 100.6 266.4 Q 98 275 95.4 283.8 L 88.6 306.2 Q 86 315 84.7 323.1 L 81.3 343.9 Q 80 352 87.5 354.2 L 106.5 359.8 Q 114 362 119.7 360.5 L 134.3 356.5 Q 140 355 143.5 347.3 L 152.5 327.7 Q 156 320 157.5 313.8 L 161.5 298.2 Q 163 292 161.2 282.3 L 156.8 257.7 Q 155 248 157.9 238.3 Z', 124, 296, true)}
                {renderMuscleTarget('left_arm', 'M 350.9 213.7 Q 348 204 355.9 205.3 L 376.1 208.7 Q 384 210 388.8 215.7 L 401.2 230.3 Q 406 236 408.6 244.6 L 415.4 266.4 Q 418 275 420.6 283.8 L 427.4 306.2 Q 430 315 431.3 323.1 L 434.7 343.9 Q 436 352 428.5 354.2 L 409.5 359.8 Q 402 362 396.3 360.5 L 381.7 356.5 Q 376 355 372.5 347.3 L 363.5 327.7 Q 360 320 358.5 313.8 L 354.5 298.2 Q 353 292 354.8 282.3 L 359.2 257.7 Q 361 248 358.1 238.3 Z', 392, 296, true)}
                {renderMuscleTarget('right_thigh', 'M 172.3 467.3 Q 178 453 186.8 462.2 L 209.2 485.8 Q 218 495 225.5 505.3 L 244.5 531.7 Q 252 542 250.2 550.4 L 245.8 571.6 Q 244 580 240.0 593.2 L 230.0 626.8 Q 226 640 222.9 652.1 L 215.1 682.9 Q 212 695 205.8 697.0 L 190.2 702.0 Q 184 704 177.2 702.0 L 159.8 697.0 Q 153 695 150.6 685.1 L 144.4 659.9 Q 142 650 141.3 636.8 L 139.7 603.2 Q 139 590 141.9 574.2 L 149.1 533.8 Q 152 518 157.7 503.7 Z', 190, 585, true)}
                {renderMuscleTarget('left_thigh', 'M 343.7 467.3 Q 338 453 329.2 462.2 L 306.8 485.8 Q 298 495 290.5 505.3 L 271.5 531.7 Q 264 542 265.8 550.4 L 270.2 571.6 Q 272 580 276.0 593.2 L 286.0 626.8 Q 290 640 293.1 652.1 L 300.9 682.9 Q 304 695 310.2 697.0 L 325.8 702.0 Q 332 704 338.8 702.0 L 356.2 697.0 Q 363 695 365.4 685.1 L 371.6 659.9 Q 374 650 374.7 636.8 L 376.3 603.2 Q 377 590 374.1 574.2 L 366.9 533.8 Q 364 518 358.3 503.7 Z', 326, 585, true)}
                {renderMuscleTarget('right_forearm', 'M 87.5 356.2 Q 80 354 77.4 360.2 L 70.6 375.8 Q 68 382 66.7 390.4 L 63.3 411.6 Q 62 420 61.1 427.7 L 58.9 447.3 Q 58 455 58.4 461.6 L 59.6 478.4 Q 60 485 66.6 485.4 L 83.4 486.6 Q 90 487 94.8 477.8 L 107.2 454.2 Q 112 445 116.6 434.0 L 128.4 406.0 Q 133 395 134.5 386.6 L 138.5 365.4 Q 140 357 134.3 358.5 L 119.7 362.5 Q 114 364 106.5 361.8 Z', 96, 420, false)}
                {renderMuscleTarget('left_forearm', 'M 428.5 356.2 Q 436 354 438.6 360.2 L 445.4 375.8 Q 448 382 449.3 390.4 L 452.7 411.6 Q 454 420 454.9 427.7 L 457.1 447.3 Q 458 455 457.6 461.6 L 456.4 478.4 Q 456 485 449.4 485.4 L 432.6 486.6 Q 426 487 421.2 477.8 L 408.8 454.2 Q 404 445 399.4 434.0 L 387.6 406.0 Q 383 395 381.5 386.6 L 377.5 365.4 Q 376 357 381.7 358.5 L 396.3 362.5 Q 402 364 409.5 361.8 Z', 420, 420, false)}
                {renderMuscleTarget('right_calf', 'M 151.4 715.0 Q 154 708 166.3 708.0 L 197.7 708.0 Q 210 708 210.4 720.5 L 211.6 752.5 Q 212 765 210.2 777.1 L 205.8 807.9 Q 204 820 200.0 830.6 L 190.0 857.4 Q 186 868 183.6 874.6 L 177.4 891.4 Q 175 898 168.8 898.0 L 153.2 898.0 Q 147 898 145.5 887.4 L 141.5 860.6 Q 140 850 138.2 835.7 L 133.8 799.3 Q 132 785 134.2 775.1 L 139.8 749.9 Q 142 740 144.6 733.0 Z', 173, 795, false)}
                {renderMuscleTarget('left_calf', 'M 364.6 715.0 Q 362 708 349.7 708.0 L 318.3 708.0 Q 306 708 305.6 720.5 L 304.4 752.5 Q 304 765 305.8 777.1 L 310.2 807.9 Q 312 820 316.0 830.6 L 326.0 857.4 Q 330 868 332.4 874.6 L 338.6 891.4 Q 341 898 347.2 898.0 L 362.8 898.0 Q 369 898 370.5 887.4 L 374.5 860.6 Q 376 850 377.8 835.7 L 382.2 799.3 Q 384 785 381.8 775.1 L 376.2 749.9 Q 374 740 371.4 733.0 Z', 343, 795, false)}
                {/* Líneas guía HUD (Hombre Frontal) */}
                {renderHudCallout('chest', 'M 102 120 L 152 120 L 234 254')}
                {renderHudCallout('right_arm', 'M 100 228 L 124 296')}
                {renderHudCallout('left_arm', 'M 416 228 L 392 296')}
                {renderHudCallout('waist', 'M 412 390 L 258 382')}
                {renderHudCallout('right_thigh', 'M 104 628 L 190 585')}
                {renderHudCallout('left_thigh', 'M 412 628 L 326 585')}
              </>
            ) : (
              <>
                {renderMuscleTarget('chest', 'M 197.4 206.8 Q 202 196 206.4 209.0 L 217.6 242.0 Q 222 255 229.9 257.2 L 250.1 262.8 Q 258 265 265.9 262.8 L 286.1 257.2 Q 294 255 298.4 242.0 L 309.6 209.0 Q 314 196 318.6 206.8 L 330.4 234.2 Q 335 245 338.7 253.8 L 348.3 276.2 Q 352 285 350.7 293.8 L 347.3 316.2 Q 346 325 343.4 331.4 L 336.6 347.6 Q 334 354 325.4 351.8 L 303.6 346.2 Q 295 344 286.9 343.6 L 266.1 342.4 Q 258 342 249.9 342.4 L 229.1 343.6 Q 221 344 212.4 346.2 L 190.6 351.8 Q 182 354 179.4 347.6 L 172.6 331.4 Q 170 325 168.7 316.2 L 165.3 293.8 Q 164 285 167.7 276.2 L 177.3 253.8 Q 181 245 185.6 234.2 Z', 236, 290, true)}
                {renderMuscleTarget('waist', 'M 184.2 363.1 Q 182 355 198.7 352.6 L 241.3 346.4 Q 258 344 274.7 346.4 L 317.3 352.6 Q 334 355 331.8 363.1 L 326.2 383.9 Q 324 392 326.6 399.5 L 333.4 418.5 Q 336 426 327.0 436.1 L 304.0 461.9 Q 295 472 286.9 472.9 L 266.1 475.1 Q 258 476 249.9 475.1 L 229.1 472.9 Q 221 472 212.0 461.9 L 189.0 436.1 Q 180 426 182.6 418.5 L 189.4 399.5 Q 192 392 189.8 383.9 Z', 258, 405, true)}
                {renderMuscleTarget('right_arm', 'M 178.5 223.4 Q 182 204 173.2 205.8 L 150.8 210.2 Q 142 212 136.7 218.6 L 123.3 235.4 Q 118 242 116.2 251.5 L 111.8 275.5 Q 110 285 106.9 294.5 L 99.1 318.5 Q 96 328 93.8 336.1 L 88.2 356.9 Q 86 365 96.1 367.0 L 121.9 372.0 Q 132 374 136.4 364.3 L 147.6 339.7 Q 152 330 155.1 321.6 L 162.9 300.4 Q 166 292 169.5 272.6 Z', 130, 296, true)}
                {renderMuscleTarget('left_arm', 'M 337.5 223.4 Q 334 204 342.8 205.8 L 365.2 210.2 Q 374 212 379.3 218.6 L 392.7 235.4 Q 398 242 399.8 251.5 L 404.2 275.5 Q 406 285 409.1 294.5 L 416.9 318.5 Q 420 328 422.2 336.1 L 427.8 356.9 Q 430 365 419.9 367.0 L 394.1 372.0 Q 384 374 379.6 364.3 L 368.4 339.7 Q 364 330 360.9 321.6 L 353.1 300.4 Q 350 292 346.5 272.6 Z', 386, 296, true)}
                {renderMuscleTarget('right_thigh', 'M 169.8 443.6 Q 176 430 185.7 439.7 L 210.3 464.3 Q 220 474 226.2 489.6 L 241.8 529.4 Q 248 545 243.2 564.8 L 230.8 615.2 Q 226 635 222.5 648.2 L 213.5 681.8 Q 210 695 197.2 695.0 L 164.8 695.0 Q 152 695 148.9 681.8 L 141.1 648.2 Q 138 635 136.9 619.6 L 134.1 580.4 Q 133 565 136.3 548.9 L 144.7 508.1 Q 148 492 154.2 478.4 Z', 186, 578, true)}
                {renderMuscleTarget('left_thigh', 'M 346.2 443.6 Q 340 430 330.3 439.7 L 305.7 464.3 Q 296 474 289.8 489.6 L 274.2 529.4 Q 268 545 272.8 564.8 L 285.2 615.2 Q 290 635 293.5 648.2 L 302.5 681.8 Q 306 695 318.8 695.0 L 351.2 695.0 Q 364 695 367.1 681.8 L 374.9 648.2 Q 378 635 379.1 619.6 L 381.9 580.4 Q 383 565 379.7 548.9 L 371.3 508.1 Q 368 492 361.8 478.4 Z', 330, 578, true)}
                {renderMuscleTarget('right_forearm', 'M 96.1 368.0 Q 86 366 82.0 376.1 L 72.0 401.9 Q 68 412 66.2 422.6 L 61.8 449.4 Q 60 460 60.0 467.3 L 60.0 485.7 Q 60 493 66.2 493.4 L 81.8 494.6 Q 88 495 92.8 484.0 L 105.2 456.0 Q 110 445 114.8 429.6 L 127.2 390.4 Q 132 375 121.9 373.0 Z', 94, 430, false)}
                {renderMuscleTarget('left_forearm', 'M 419.9 368.0 Q 430 366 434.0 376.1 L 444.0 401.9 Q 448 412 449.8 422.6 L 454.2 449.4 Q 456 460 456.0 467.3 L 456.0 485.7 Q 456 493 449.8 493.4 L 434.2 494.6 Q 428 495 423.2 484.0 L 410.8 456.0 Q 406 445 401.2 429.6 L 388.8 390.4 Q 384 375 394.1 373.0 Z', 422, 430, false)}
                {renderMuscleTarget('right_calf', 'M 149.6 712.7 Q 152 705 164.8 705.0 L 197.2 705.0 Q 210 705 210.4 718.2 L 211.6 751.8 Q 212 765 210.2 777.1 L 205.8 807.9 Q 204 820 200.5 830.6 L 191.5 857.4 Q 188 868 185.4 875.3 L 178.6 893.7 Q 176 901 169.6 901.0 L 153.4 901.0 Q 147 901 145.0 889.8 L 140.0 861.2 Q 138 850 136.2 835.7 L 131.8 799.3 Q 130 785 132.4 775.1 L 138.6 749.9 Q 141 740 143.4 732.3 Z', 173, 795, false)}
                {renderMuscleTarget('left_calf', 'M 366.4 712.7 Q 364 705 351.2 705.0 L 318.8 705.0 Q 306 705 305.6 718.2 L 304.4 751.8 Q 304 765 305.8 777.1 L 310.2 807.9 Q 312 820 315.5 830.6 L 324.5 857.4 Q 328 868 330.6 875.3 L 337.4 893.7 Q 340 901 346.4 901.0 L 362.6 901.0 Q 369 901 371.0 889.8 L 376.0 861.2 Q 378 850 379.8 835.7 L 384.2 799.3 Q 386 785 383.6 775.1 L 377.4 749.9 Q 375 740 372.6 732.3 Z', 343, 795, false)}
                {/* Líneas guía HUD (Mujer Frontal) */}
                {renderHudCallout('chest', 'M 102 120 L 152 120 L 236 290')}
                {renderHudCallout('right_arm', 'M 100 228 L 130 296')}
                {renderHudCallout('left_arm', 'M 416 228 L 386 296')}
                {renderHudCallout('waist', 'M 412 390 L 258 405')}
                {renderHudCallout('right_thigh', 'M 104 628 L 186 578')}
                {renderHudCallout('left_thigh', 'M 412 628 L 330 578')}
              </>
            )}
          </G>
        )}

        {/* ========================================================
            VISTA POSTERIOR (ESPALDA)
        ======================================================== */}
        {view === 'back' && (
          <G>
            {isMale ? (
              <>
                {renderMuscleTarget('back', 'M 211.7 173.1 Q 224 165 231.5 163.9 L 250.5 161.1 Q 258 160 265.5 161.1 L 284.5 163.9 Q 292 165 304.3 173.1 L 335.7 193.9 Q 348 202 351.5 212.6 L 360.5 239.4 Q 364 250 363.6 261.0 L 362.4 289.0 Q 362 300 357.6 314.3 L 346.4 350.7 Q 342 365 340.0 375.3 L 335.0 401.7 Q 333 412 333.4 417.7 L 334.6 432.3 Q 335 438 318.1 437.6 L 274.9 436.4 Q 258 436 241.1 436.4 L 197.9 437.6 Q 181 438 181.4 432.3 L 182.6 417.7 Q 183 412 181.0 401.7 L 176.0 375.3 Q 174 365 169.6 350.7 L 158.4 314.3 Q 154 300 153.6 289.0 L 152.4 261.0 Q 152 250 155.5 239.4 L 164.5 212.6 Q 168 202 180.3 193.9 Z', 258, 292, true)}
                {renderMuscleTarget('glutes', 'M 174.5 448.4 Q 178 440 195.6 439.6 L 240.4 438.4 Q 258 438 275.6 438.4 L 320.4 439.6 Q 338 440 341.5 448.4 L 350.5 469.6 Q 354 478 354.0 487.7 L 354.0 512.3 Q 354 522 349.6 529.0 L 338.4 547.0 Q 334 554 325.6 555.3 L 304.4 558.7 Q 296 560 287.6 556.5 L 266.4 547.5 Q 258 544 249.6 547.5 L 228.4 556.5 Q 220 560 211.6 558.7 L 190.4 555.3 Q 182 554 177.6 547.0 L 166.4 529.0 Q 162 522 162.0 512.3 L 162.0 487.7 Q 162 478 165.5 469.6 Z', 288, 502, true)}
                {renderMuscleTarget('right_forearm', 'M 100.3 357.8 Q 90 356 86.5 364.6 L 77.5 386.4 Q 74 395 72.2 406.0 L 67.8 434.0 Q 66 445 65.8 455.3 L 65.2 481.7 Q 65 492 71.2 492.7 L 86.8 494.3 Q 93 495 98.1 484.7 L 110.9 458.3 Q 116 448 119.7 438.3 L 129.3 413.7 Q 133 404 133.9 395.2 L 136.1 372.8 Q 137 364 126.7 362.2 Z', 99, 426, true)}
                {renderMuscleTarget('left_forearm', 'M 415.7 357.8 Q 426 356 429.5 364.6 L 438.5 386.4 Q 442 395 443.8 406.0 L 448.2 434.0 Q 450 445 450.2 455.3 L 450.8 481.7 Q 451 492 444.8 492.7 L 429.2 494.3 Q 423 495 417.9 484.7 L 405.1 458.3 Q 400 448 396.3 438.3 L 386.7 413.7 Q 383 404 382.1 395.2 L 379.9 372.8 Q 379 364 389.3 362.2 Z', 417, 426, true)}
                {renderMuscleTarget('right_calf', 'M 154.5 716.1 Q 158 708 169.9 708.0 L 200.1 708.0 Q 212 708 212.9 720.5 L 215.1 752.5 Q 216 765 214.7 776.0 L 211.3 804.0 Q 210 815 205.6 826.0 L 194.4 854.0 Q 190 865 186.7 873.1 L 178.3 893.9 Q 175 902 169.1 902.0 L 153.9 902.0 Q 148 902 146.5 891.7 L 142.5 865.3 Q 141 855 139.2 841.8 L 134.8 808.2 Q 133 795 135.0 784.0 L 140.0 756.0 Q 142 745 145.5 736.9 Z', 175, 795, true)}
                {renderMuscleTarget('left_calf', 'M 361.5 716.1 Q 358 708 346.1 708.0 L 315.9 708.0 Q 304 708 303.1 720.5 L 300.9 752.5 Q 300 765 301.3 776.0 L 304.7 804.0 Q 306 815 310.4 826.0 L 321.6 854.0 Q 326 865 329.3 873.1 L 337.7 893.9 Q 341 902 346.9 902.0 L 362.1 902.0 Q 368 902 369.5 891.7 L 373.5 865.3 Q 375 855 376.8 841.8 L 381.2 808.2 Q 383 795 381.0 784.0 L 376.0 756.0 Q 374 745 370.5 736.9 Z', 341, 795, true)}
                {renderMuscleTarget('right_arm', 'M 162.9 214.1 Q 166 204 158.5 204.9 L 139.5 207.1 Q 132 208 126.7 214.2 L 113.3 229.8 Q 108 236 105.4 246.8 L 98.6 274.2 Q 96 285 94.7 300.4 L 91.3 339.6 Q 90 355 100.1 356.5 L 125.9 360.5 Q 136 362 140.0 351.7 L 150.0 325.3 Q 154 315 153.6 300.7 L 152.4 264.3 Q 152 250 155.1 239.9 Z', 124, 292, false)}
                {renderMuscleTarget('left_arm', 'M 353.1 214.1 Q 350 204 357.5 204.9 L 376.5 207.1 Q 384 208 389.3 214.2 L 402.7 229.8 Q 408 236 410.6 246.8 L 417.4 274.2 Q 420 285 421.3 300.4 L 424.7 339.6 Q 426 355 415.9 356.5 L 390.1 360.5 Q 380 362 376.0 351.7 L 366.0 325.3 Q 362 315 362.4 300.7 L 363.6 264.3 Q 364 250 360.9 239.9 Z', 392, 292, false)}
                {renderMuscleTarget('right_thigh', 'M 157.2 545.9 Q 162 532 166.4 537.1 L 177.6 549.9 Q 182 555 189.9 556.5 L 210.1 560.5 Q 218 562 225.9 560.7 L 246.1 557.3 Q 254 556 250.0 573.4 L 240.0 617.6 Q 236 635 231.2 650.4 L 218.8 689.6 Q 214 705 201.7 705.0 L 170.3 705.0 Q 158 705 155.4 695.1 L 148.6 669.9 Q 146 660 144.7 645.7 L 141.3 609.3 Q 140 595 144.8 581.1 Z', 190, 625, false)}
                {renderMuscleTarget('left_thigh', 'M 358.8 545.9 Q 354 532 349.6 537.1 L 338.4 549.9 Q 334 555 326.1 556.5 L 305.9 560.5 Q 298 562 290.1 560.7 L 269.9 557.3 Q 262 556 266.0 573.4 L 276.0 617.6 Q 280 635 284.8 650.4 L 297.2 689.6 Q 302 705 314.3 705.0 L 345.7 705.0 Q 358 705 360.6 695.1 L 367.4 669.9 Q 370 660 371.3 645.7 L 374.7 609.3 Q 376 595 371.2 581.1 Z', 326, 625, false)}
                {/* Líneas guía HUD (Hombre Posterior) */}
                {renderHudCallout('back', 'M 104 120 L 154 120 L 258 292')}
                {renderHudCallout('right_forearm', 'M 52 272 L 52 426 L 99 426')}
                {renderHudCallout('left_forearm', 'M 464 272 L 464 426 L 417 426')}
                {renderHudCallout('glutes', 'M 412 618 L 368 618 L 288 502')}
                {renderHudCallout('right_calf', 'M 108 786 L 175 795')}
                {renderHudCallout('left_calf', 'M 408 786 L 341 795')}
              </>
            ) : (
              <>
                {renderMuscleTarget('back', 'M 203.0 188.8 Q 212 184 222.1 182.7 L 247.9 179.3 Q 258 178 268.1 179.3 L 293.9 182.7 Q 304 184 313.0 188.8 L 336.0 201.2 Q 345 206 347.4 219.0 L 353.6 252.0 Q 356 265 355.3 276.0 L 353.7 304.0 Q 353 315 348.4 327.5 L 336.6 359.5 Q 332 372 331.3 379.3 L 329.7 397.7 Q 329 405 330.5 410.9 L 334.5 426.1 Q 336 432 318.8 431.6 L 275.2 430.4 Q 258 430 240.8 430.4 L 197.2 431.6 Q 180 432 181.5 426.1 L 185.5 410.9 Q 187 405 186.3 397.7 L 184.7 379.3 Q 184 372 179.4 359.5 L 167.6 327.5 Q 163 315 162.3 304.0 L 160.7 276.0 Q 160 265 162.4 252.0 L 168.6 219.0 Q 171 206 180.0 201.2 Z', 258, 298, true)}
                {renderMuscleTarget('glutes', 'M 171.8 443.7 Q 178 434 195.6 433.6 L 240.4 432.4 Q 258 432 275.6 432.4 L 320.4 433.6 Q 338 434 344.2 443.7 L 359.8 468.3 Q 366 478 366.9 488.3 L 369.1 514.7 Q 370 525 364.7 532.3 L 351.3 550.7 Q 346 558 335.9 559.3 L 310.1 562.7 Q 300 564 290.8 559.8 L 267.2 549.2 Q 258 545 248.8 549.2 L 225.2 559.8 Q 216 564 205.9 562.7 L 180.1 559.3 Q 170 558 164.7 550.7 L 151.3 532.3 Q 146 525 146.9 514.7 L 149.1 488.3 Q 150 478 156.2 468.3 Z', 288, 502, true)}
                {renderMuscleTarget('right_forearm', 'M 100.1 367.8 Q 90 366 86.5 376.1 L 77.5 401.9 Q 74 412 72.2 422.1 L 67.8 447.9 Q 66 458 66.0 465.9 L 66.0 486.1 Q 66 494 71.7 494.2 L 86.3 494.8 Q 92 495 96.6 484.7 L 108.4 458.3 Q 113 448 118.1 431.7 L 130.9 390.3 Q 136 374 125.9 372.2 Z', 99, 430, true)}
                {renderMuscleTarget('left_forearm', 'M 415.9 367.8 Q 426 366 429.5 376.1 L 438.5 401.9 Q 442 412 443.8 422.1 L 448.2 447.9 Q 450 458 450.0 465.9 L 450.0 486.1 Q 450 494 444.3 494.2 L 429.7 494.8 Q 424 495 419.4 484.7 L 407.6 458.3 Q 403 448 397.9 431.7 L 385.1 390.3 Q 380 374 390.1 372.2 Z', 417, 430, true)}
                {renderMuscleTarget('right_calf', 'M 154.5 716.1 Q 158 708 170.3 708.0 L 201.7 708.0 Q 214 708 214.4 720.5 L 215.6 752.5 Q 216 765 214.7 776.7 L 211.3 806.3 Q 210 818 206.0 828.3 L 196.0 854.7 Q 192 865 188.7 873.1 L 180.3 893.9 Q 177 902 171.1 902.0 L 155.9 902.0 Q 150 902 148.2 891.7 L 143.8 865.3 Q 142 855 139.8 840.7 L 134.2 804.3 Q 132 790 134.2 780.1 L 139.8 754.9 Q 142 745 145.5 736.9 Z', 175, 795, true)}
                {renderMuscleTarget('left_calf', 'M 361.5 716.1 Q 358 708 345.7 708.0 L 314.3 708.0 Q 302 708 301.6 720.5 L 300.4 752.5 Q 300 765 301.3 776.7 L 304.7 806.3 Q 306 818 310.0 828.3 L 320.0 854.7 Q 324 865 327.3 873.1 L 335.7 893.9 Q 339 902 344.9 902.0 L 360.1 902.0 Q 366 902 367.8 891.7 L 372.2 865.3 Q 374 855 376.2 840.7 L 381.8 804.3 Q 384 790 381.8 780.1 L 376.2 754.9 Q 374 745 370.5 736.9 Z', 341, 795, true)}
                {renderMuscleTarget('right_arm', 'M 167.8 219.0 Q 170 206 162.1 208.2 L 141.9 213.8 Q 134 216 129.2 223.0 L 116.8 241.0 Q 112 248 109.8 260.5 L 104.2 292.5 Q 102 305 99.4 318.2 L 92.6 351.8 Q 90 365 100.1 366.5 L 125.9 370.5 Q 136 372 140.8 359.5 L 153.2 327.5 Q 158 315 158.4 304.0 L 159.6 276.0 Q 160 265 162.2 252.0 Z', 128, 295, false)}
                {renderMuscleTarget('left_arm', 'M 348.2 219.0 Q 346 206 353.9 208.2 L 374.1 213.8 Q 382 216 386.8 223.0 L 399.2 241.0 Q 404 248 406.2 260.5 L 411.8 292.5 Q 414 305 416.6 318.2 L 423.4 351.8 Q 426 365 415.9 366.5 L 390.1 370.5 Q 380 372 375.2 359.5 L 362.8 327.5 Q 358 315 357.6 304.0 L 356.4 276.0 Q 356 265 353.8 252.0 Z', 388, 295, false)}
                {renderMuscleTarget('right_thigh', 'M 144.2 544.3 Q 146 530 151.3 536.2 L 164.7 551.8 Q 170 558 180.1 559.3 L 205.9 562.7 Q 216 564 224.4 561.4 L 245.6 554.6 Q 254 552 250.5 569.6 L 241.5 614.4 Q 238 632 232.7 648.1 L 219.3 688.9 Q 214 705 201.7 705.0 L 170.3 705.0 Q 158 705 155.4 695.5 L 148.6 671.5 Q 146 662 144.2 647.3 L 139.8 609.7 Q 138 595 139.8 580.7 Z', 190, 625, false)}
                {renderMuscleTarget('left_thigh', 'M 371.8 544.3 Q 370 530 364.7 536.2 L 351.3 551.8 Q 346 558 335.9 559.3 L 310.1 562.7 Q 300 564 291.6 561.4 L 270.4 554.6 Q 262 552 265.5 569.6 L 274.5 614.4 Q 278 632 283.3 648.1 L 296.7 688.9 Q 302 705 314.3 705.0 L 345.7 705.0 Q 358 705 360.6 695.5 L 367.4 671.5 Q 370 662 371.8 647.3 L 376.2 609.7 Q 378 595 376.2 580.7 Z', 326, 625, false)}
                {/* Líneas guía HUD (Mujer Posterior) */}
                {renderHudCallout('back', 'M 104 120 L 154 120 L 258 298')}
                {renderHudCallout('right_forearm', 'M 52 272 L 52 430 L 99 430')}
                {renderHudCallout('left_forearm', 'M 464 272 L 464 430 L 417 430')}
                {renderHudCallout('glutes', 'M 412 618 L 368 618 L 288 502')}
                {renderHudCallout('right_calf', 'M 108 786 L 175 795')}
                {renderHudCallout('left_calf', 'M 408 786 L 341 795')}
              </>
            )}
          </G>
        )}
      </Svg>
    </View>
  );
}

/* ==========================================================
   GRÁFICA INTERACTIVA DE CRECIMIENTO MUSCULAR
   (7 DÍAS, 30 DÍAS, 90 DÍAS, TODO EL HISTORIAL)
========================================================== */
type TimeFilterRange = '7D' | '30D' | '90D' | 'ALL';

const TIME_FILTER_OPTIONS: { key: TimeFilterRange; label: string }[] = [
  { key: '7D', label: '7 días' },
  { key: '30D', label: '30 días' },
  { key: '90D', label: '90 días' },
  { key: 'ALL', label: 'Todo' },
];

const CHARTABLE_PARTS: BodyPartKey[] = [
  'chest',
  'back',
  'right_arm',
  'left_arm',
  'right_forearm',
  'left_forearm',
  'waist',
  'glutes',
  'right_thigh',
  'left_thigh',
  'right_calf',
  'left_calf',
];

function BodyPartGrowthChartCard({
  measurementLogs,
  selectedPart,
  onSelectPart,
  onOpenEditModal,
}: {
  measurementLogs: Record<string, DayMeasurements>;
  selectedPart: BodyPartKey;
  onSelectPart: (p: BodyPartKey) => void;
  onOpenEditModal: (p: BodyPartKey) => void;
}) {
  const [timeFilter, setTimeFilter] = useState<TimeFilterRange>('ALL');
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.max(260, Math.min(360, screenWidth - 64));
  const chartHeight = 155;
  const paddingX = 26;
  const paddingY = 28;

  const partInfo = BODY_PARTS_INFO[selectedPart] || BODY_PARTS_INFO.chest;

  // Filtrado y ordenación cronológica de mediciones para el músculo seleccionado
  const points = React.useMemo(() => {
    const allDates = Object.keys(measurementLogs).sort();
    const now = Date.now();
    let cutoff = 0;
    if (timeFilter === '7D') cutoff = now - 7 * 86400000;
    else if (timeFilter === '30D') cutoff = now - 30 * 86400000;
    else if (timeFilter === '90D') cutoff = now - 90 * 86400000;

    const list: { dateStr: string; val: number; timestamp: number }[] = [];
    for (const dStr of allDates) {
      const day = measurementLogs[dStr];
      if (!day) continue;
      const v = day[selectedPart];
      if (typeof v === 'number' && v > 0) {
        const [y, m, d] = dStr.split('-').map(Number);
        const t = new Date(y, m - 1, d).getTime();
        if (timeFilter === 'ALL' || t >= cutoff) {
          list.push({ dateStr: dStr, val: v, timestamp: t });
        }
      }
    }
    return list;
  }, [measurementLogs, selectedPart, timeFilter]);

  // Cálculos estadísticos de progresión
  const hasData = points.length > 0;
  const initialVal = hasData ? points[0].val : 0;
  const latestVal = hasData ? points[points.length - 1].val : 0;
  const delta = hasData ? +(latestVal - initialVal).toFixed(1) : 0;
  const allVals = points.map((p) => p.val);
  const minVal = hasData ? Math.min(...allVals) : 0;
  const maxVal = hasData ? Math.max(...allVals) : 0;

  // Geometría del trazado SVG
  const plotMin = maxVal === minVal ? minVal - 1 : minVal;
  const range = maxVal - minVal === 0 ? 2 : maxVal - minVal;

  const coords = points.map((p, idx) => {
    const x =
      points.length === 1
        ? chartWidth / 2
        : paddingX + (idx / (points.length - 1)) * (chartWidth - paddingX * 2);
    const y =
      chartHeight - paddingY - ((p.val - plotMin) / range) * (chartHeight - paddingY * 2);
    return {
      x,
      y,
      val: p.val,
      dateLabel: (() => {
        const [, m, d] = p.dateStr.split('-');
        const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        return `${parseInt(d, 10)} ${monthNames[parseInt(m, 10) - 1] || ''}`;
      })(),
    };
  });

  let curvePathD = '';
  let fillPathD = '';
  if (coords.length >= 2) {
    curvePathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const cpX = prev.x + (curr.x - prev.x) / 2;
      curvePathD += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    fillPathD = `${curvePathD} L ${coords[coords.length - 1].x} ${chartHeight - 14} L ${coords[0].x} ${chartHeight - 14} Z`;
  }

  // Interpretación del delta: para cintura la reducción suele ser el objetivo
  const isWaist = selectedPart === 'waist';
  const isPositiveGrowth = delta > 0;
  const isFavorable = isWaist ? delta <= 0 : delta >= 0;

  return (
    <View style={measureStyles.growthChartCard}>
      {/* Fondo con glassmorphism suave */}
      <LinearGradient colors={GRADIENTS.cardGlass} style={measureStyles.growthChartGradient}>
        {/* Cabecera: Título + Selector de Rango de Tiempo (7D, 30D, 90D, Todo) */}
        <View style={measureStyles.chartHeaderRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <View style={measureStyles.chartTagBadge}>
              <Ionicons name="trending-up-outline" size={12} color="#8B5CF6" />
              <Text style={measureStyles.chartTagText}>✦ EVOLUCIÓN MUSCULAR ✦</Text>
            </View>
            <Text style={measureStyles.chartTitle}>Gráfica de Crecimiento</Text>
          </View>

          {/* Selector de Rango Temporal */}
          <View style={measureStyles.timeFilterBar}>
            {TIME_FILTER_OPTIONS.map((tf) => {
              const active = timeFilter === tf.key;
              return (
                <Pressable
                  key={tf.key}
                  onPress={() => setTimeFilter(tf.key)}
                  style={[
                    measureStyles.timeFilterBtn,
                    active && measureStyles.timeFilterBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      measureStyles.timeFilterBtnText,
                      active && measureStyles.timeFilterBtnTextActive,
                    ]}
                  >
                    {tf.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* SELECTOR HORIZONTAL DE MÚSCULOS */}
        <View style={{ marginTop: 12, marginBottom: 14 }}>
          <Text style={measureStyles.selectorSectionHint}>
            SELECCIONA EL MÚSCULO A GRAFICAR:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={measureStyles.muscleSelectorScroll}
          >
            {CHARTABLE_PARTS.map((pKey) => {
              const info = BODY_PARTS_INFO[pKey];
              const isSelected = selectedPart === pKey;
              return (
                <Pressable
                  key={pKey}
                  onPress={() => onSelectPart(pKey)}
                  style={({ pressed }) => [
                    measureStyles.musclePillBtn,
                    isSelected && measureStyles.musclePillBtnActive,
                    pressed && s.btnPressed,
                  ]}
                >
                  {isSelected ? (
                    <LinearGradient
                      colors={['#8B5CF6', '#EC4899']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={measureStyles.musclePillGradient}
                    >
                      <Ionicons name={info.icon} size={13} color="#FFFFFF" />
                      <Text style={measureStyles.musclePillTextActive}>{info.shortLabel}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={measureStyles.musclePillInner}>
                      <Ionicons name={info.icon} size={13} color={C.sub} />
                      <Text style={measureStyles.musclePillTextInactive}>{info.shortLabel}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* BANNER DE RESUMEN: VALOR ACTUAL, DELTA Y RANGOS */}
        <View style={measureStyles.chartSummaryBanner}>
          <View>
            <Text style={measureStyles.bannerPartName}>{partInfo.label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <Text style={measureStyles.bannerCurrentValue}>
                {hasData ? `${latestVal} cm` : '--'}
              </Text>
              {hasData && (
                <View
                  style={[
                    measureStyles.deltaBadge,
                    {
                      backgroundColor: isFavorable
                        ? 'rgba(16, 185, 129, 0.14)'
                        : 'rgba(239, 68, 68, 0.12)',
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      delta === 0
                        ? 'remove-outline'
                        : isPositiveGrowth
                        ? 'arrow-up-outline'
                        : 'arrow-down-outline'
                    }
                    size={11}
                    color={isFavorable ? '#10B981' : '#EF4444'}
                  />
                  <Text
                    style={[
                      measureStyles.deltaBadgeText,
                      { color: isFavorable ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {delta > 0 ? `+${delta}` : `${delta}`} cm
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Mini métricas: Mínimo / Máximo en el período */}
          {hasData && (
            <View style={measureStyles.minMaxStatsRow}>
              <View style={measureStyles.miniStatBlock}>
                <Text style={measureStyles.miniStatLabel}>MÍN</Text>
                <Text style={measureStyles.miniStatValue}>{minVal} cm</Text>
              </View>
              <View style={measureStyles.miniStatDivider} />
              <View style={measureStyles.miniStatBlock}>
                <Text style={measureStyles.miniStatLabel}>MÁX</Text>
                <Text style={measureStyles.miniStatValue}>{maxVal} cm</Text>
              </View>
            </View>
          )}
        </View>

        {/* ÁREA DE GRÁFICA SVG */}
        <View style={measureStyles.svgChartWrapper}>
          {points.length === 0 ? (
            /* Estado sin datos en este período */
            <View style={measureStyles.chartEmptyState}>
              <View style={measureStyles.emptyStateIconCircle}>
                <Ionicons name="analytics-outline" size={26} color="#A78BFA" />
              </View>
              <Text style={measureStyles.emptyStateTitle}>Sin registros en este período</Text>
              <Text style={measureStyles.emptyStateSubtitle}>
                Toca el croquis arriba para registrar tu primera medida de {partInfo.label.toLowerCase()}.
              </Text>
              <Pressable
                onPress={() => onOpenEditModal(selectedPart)}
                style={({ pressed }) => [
                  measureStyles.emptyAddBtn,
                  pressed && s.btnPressed,
                ]}
              >
                <Ionicons name="add-circle-outline" size={14} color="#8B5CF6" />
                <Text style={measureStyles.emptyAddBtnText}>Registrar medida hoy</Text>
              </Pressable>
            </View>
          ) : points.length === 1 ? (
            /* Estado con un solo dato registrado */
            <View style={measureStyles.chartSinglePointState}>
              <View style={measureStyles.singlePointHero}>
                <LinearGradient
                  colors={['#8B5CF6', '#EC4899']}
                  style={measureStyles.singlePointCircle}
                >
                  <Text style={measureStyles.singlePointHeroVal}>{points[0].val}</Text>
                  <Text style={measureStyles.singlePointHeroUnit}>cm</Text>
                </LinearGradient>
              </View>
              <Text style={measureStyles.singlePointDate}>
                Registrado el {coords[0].dateLabel}
              </Text>
              <Text style={measureStyles.singlePointHint}>
                Registra mediciones en diferentes fechas para visualizar la curva de crecimiento muscular.
              </Text>
            </View>
          ) : (
            /* Curva SVG Dinámica con Puntos y Etiquetas */
            <View style={{ width: chartWidth, height: chartHeight, alignSelf: 'center' }}>
              <Svg width={chartWidth} height={chartHeight}>
                <Defs>
                  <SvgGradient id="growthCurveGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.32" />
                    <Stop offset="100%" stopColor="#EC4899" stopOpacity="0.02" />
                  </SvgGradient>
                </Defs>

                {/* Líneas guía horizontales sutiles */}
                <Line
                  x1={paddingX}
                  y1={paddingY}
                  x2={chartWidth - paddingX}
                  y2={paddingY}
                  stroke="rgba(203, 213, 225, 0.35)"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
                <Line
                  x1={paddingX}
                  y1={chartHeight / 2}
                  x2={chartWidth - paddingX}
                  y2={chartHeight / 2}
                  stroke="rgba(203, 213, 225, 0.25)"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
                <Line
                  x1={paddingX}
                  y1={chartHeight - paddingY}
                  x2={chartWidth - paddingX}
                  y2={chartHeight - paddingY}
                  stroke="rgba(203, 213, 225, 0.45)"
                  strokeWidth={1}
                />

                {/* Sombreado translúcido bajo la curva */}
                <Path d={fillPathD} fill="url(#growthCurveGrad)" />

                {/* Curva de crecimiento suave */}
                <Path
                  d={curvePathD}
                  fill="none"
                  stroke="#8B5CF6"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Puntos y halos de datos */}
                {coords.map((c, i) => (
                  <G key={i}>
                    <Circle
                      cx={c.x}
                      cy={c.y}
                      r={8}
                      fill="rgba(139, 92, 246, 0.2)"
                    />
                    <Circle
                      cx={c.x}
                      cy={c.y}
                      r={4.5}
                      fill="#FFFFFF"
                      stroke="#8B5CF6"
                      strokeWidth={2.4}
                    />
                    <Circle cx={c.x} cy={c.y} r={2} fill="#8B5CF6" />
                  </G>
                ))}
              </Svg>

              {/* Etiquetas flotantes sobre los puntos (Valores numéricos) */}
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {coords.map((c, i) => (
                  <View
                    key={i}
                    style={[
                      measureStyles.chartPointValueBubble,
                      {
                        left: c.x - 22,
                        top: Math.max(2, c.y - 25),
                      },
                    ]}
                  >
                    <Text style={measureStyles.chartPointValueText}>{c.val}</Text>
                  </View>
                ))}
              </View>

              {/* Fechas debajo de la gráfica */}
              <View style={measureStyles.chartDatesRow}>
                {coords.map((c, i) => (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      left: c.x - 25,
                      width: 50,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={measureStyles.chartDateText}>{c.dateLabel}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
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
   MODAL PARA AGREGAR O EDITAR LA MEDIDA (PERFECTO Y CENTRADO)
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
    currentValue !== undefined ? String(currentValue) : ''
  );

  const numVal = parseFloat(valStr) || (info.defaultAvg || 30);

  const adjustVal = (delta: number) => {
    const base = parseFloat(valStr) || (info.defaultAvg || 30);
    const updated = Math.max(0, Math.round((base + delta) * 10) / 10);
    setValStr(String(updated));
  };

  const handleSave = () => {
    Keyboard.dismiss();
    const parsed = parseFloat(valStr.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Valor inválido', 'Por favor ingresa un número de medida válido mayor a 0 cm.');
      return;
    }
    onSave(parsed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={measureStyles.modalBackdropOverlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
          style={measureStyles.modalKeyboardContainer}
        >
          <ScrollView
            contentContainerStyle={measureStyles.modalScrollWrapper}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <Pressable style={measureStyles.modalDialogCard} onPress={(e) => e.stopPropagation()}>
              {/* Cabecera del Modal */}
              <View style={measureStyles.modalHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={measureStyles.modalIconCircle}>
                    <Ionicons name={info.icon} size={20} color={C.pastelPurple} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={measureStyles.modalTitle} numberOfLines={1}>{info.label}</Text>
                    <Text style={measureStyles.modalSubtitle}>Fecha: {dateKeyStr}</Text>
                  </View>
                </View>

                <Pressable onPress={onClose} style={measureStyles.modalCloseBtn} hitSlop={10}>
                  <Ionicons name="close" size={22} color={C.sub} />
                </Pressable>
              </View>

              {/* Campo Central Grande con Teclado Numérico y Ajustes */}
              <View style={measureStyles.numberInputBigContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Text style={measureStyles.numberInputHint}>Perímetro corporal</Text>
                  <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8}>
                    <Text style={measureStyles.hideKeyboardHint}>Ocultar teclado ▾</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                  <TextInput
                    value={valStr}
                    onChangeText={setValStr}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    placeholder={String(info.defaultAvg || 30)}
                    placeholderTextColor={C.subMuted}
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

              {/* Botones de Acción (Siempre Visibles y centrados) */}
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
          </ScrollView>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

/* ==========================================================
   MODAL PARA AGREGAR / EDITAR PESO CORPORAL (CENTRADO)
========================================================== */
function WeightEditModal({
  visible,
  currentWeight,
  dateKeyStr,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  currentWeight?: number;
  dateKeyStr: string;
  onClose: () => void;
  onSave: (w: number) => void;
  onDelete: () => void;
}) {
  const [valStr, setValStr] = useState<string>(
    currentWeight !== undefined ? String(currentWeight) : ''
  );

  const numVal = parseFloat(valStr) || 75.0;

  const adjustVal = (delta: number) => {
    const base = parseFloat(valStr) || 75.0;
    const updated = Math.max(20, Math.round((base + delta) * 10) / 10);
    setValStr(String(updated));
  };

  const handleSave = () => {
    Keyboard.dismiss();
    const parsed = parseFloat(valStr.replace(',', '.'));
    if (isNaN(parsed) || parsed < 20 || parsed > 350) {
      Alert.alert('Peso inválido', 'Por favor ingresa un peso corporal válido en kg (ej: 75.5).');
      return;
    }
    onSave(parsed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={measureStyles.modalBackdropOverlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
          style={measureStyles.modalKeyboardContainer}
        >
          <ScrollView
            contentContainerStyle={measureStyles.modalScrollWrapper}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <Pressable style={measureStyles.modalDialogCard} onPress={(e) => e.stopPropagation()}>
              {/* Header */}
              <View style={measureStyles.modalHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={[measureStyles.modalIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                    <Ionicons name="scale-outline" size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={measureStyles.modalTitle}>Peso Corporal</Text>
                    <Text style={measureStyles.modalSubtitle}>Fecha: {dateKeyStr}</Text>
                  </View>
                </View>

                <Pressable onPress={onClose} style={measureStyles.modalCloseBtn} hitSlop={10}>
                  <Ionicons name="close" size={22} color={C.sub} />
                </Pressable>
              </View>

              {/* Input */}
              <View style={measureStyles.numberInputBigContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <Text style={measureStyles.numberInputHint}>Masa corporal total</Text>
                  <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8}>
                    <Text style={measureStyles.hideKeyboardHint}>Ocultar teclado ▾</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                  <TextInput
                    value={valStr}
                    onChangeText={setValStr}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    placeholder="75.0"
                    placeholderTextColor={C.subMuted}
                    style={measureStyles.numberInputBig}
                  />
                  <Text style={[measureStyles.numberUnitBig, { color: '#10B981' }]}>kg</Text>
                </View>

                {/* Steppers */}
                <View style={measureStyles.stepperRow}>
                  {[-1.0, -0.5, -0.1, +0.1, +0.5, +1.0].map((step) => (
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

              {/* Actions */}
              <View style={measureStyles.modalActionsRow}>
                {currentWeight !== undefined && (
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        'Eliminar peso',
                        `¿Deseas eliminar el registro de peso de este día?`,
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
                    label="Guardar peso"
                    onPress={handleSave}
                  />
                </View>
              </View>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
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

  // Tarjeta de Gráfica de Crecimiento
  growthChartCard: {
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
  growthChartGradient: {
    padding: 16,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chartTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  chartTagText: {
    color: '#8B5CF6',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  chartTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '800',
  },
  timeFilterBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(241, 245, 249, 0.95)',
    borderRadius: 12,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  timeFilterBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 9,
  },
  timeFilterBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  timeFilterBtnText: {
    color: C.sub,
    fontSize: 10,
    fontWeight: '700',
  },
  timeFilterBtnTextActive: {
    color: '#8B5CF6',
    fontWeight: '800',
  },
  selectorSectionHint: {
    color: C.subMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  muscleSelectorScroll: {
    gap: 7,
    paddingVertical: 2,
  },
  musclePillBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  musclePillBtnActive: {
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  musclePillGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  musclePillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
  },
  musclePillTextActive: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  musclePillTextInactive: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '700',
  },
  chartSummaryBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.7)',
  },
  bannerPartName: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '700',
  },
  bannerCurrentValue: {
    color: C.text,
    fontSize: 20,
    fontWeight: '900',
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  deltaBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  minMaxStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniStatBlock: {
    alignItems: 'center',
  },
  miniStatLabel: {
    color: C.subMuted,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  miniStatValue: {
    color: C.text,
    fontSize: 12,
    fontWeight: '800',
  },
  miniStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(203, 213, 225, 0.7)',
  },
  svgChartWrapper: {
    marginTop: 6,
    minHeight: 155,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPointValueBubble: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  chartPointValueText: {
    color: '#8B5CF6',
    fontSize: 9.5,
    fontWeight: '800',
  },
  chartDatesRow: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    height: 16,
  },
  chartDateText: {
    color: C.subMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  chartEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyStateIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyStateTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    color: C.sub,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    color: '#8B5CF6',
    fontSize: 11,
    fontWeight: '800',
  },
  chartSinglePointState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  singlePointHero: {
    marginBottom: 8,
  },
  singlePointCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  singlePointHeroVal: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  singlePointHeroUnit: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 9.5,
    fontWeight: '800',
    marginTop: -2,
  },
  singlePointDate: {
    color: C.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  singlePointHint: {
    color: C.subMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Contenedor Sticky de Pestañas
  stickyTabsContainer: {
    backgroundColor: C.bg,
    paddingTop: 2,
    paddingBottom: 8,
    zIndex: 25,
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

  // Botón Selector de Modelo de Croquis
  croquisSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.4)',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  modelIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  croquisSelectorTitle: {
    color: C.text,
    fontSize: 12,
    fontWeight: '900',
  },
  croquisSelectorHint: {
    color: C.pastelPurple,
    fontSize: 9.5,
    fontWeight: '700',
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

  // Contenedor SVG y Croquis Anatómico Cyber-HUD (Proporción 516:1024)
  bodySvgCanvasWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  svgStageBox: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#4E5E6E',
    borderWidth: 1.5,
    borderColor: 'rgba(196, 181, 253, 0.6)',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  croquisIllustrationImage: {
    borderRadius: 20,
  },

  // Burbujas de medida estilo HUD Sci-Fi sobre el lienzo
  floatingBubbleContainer: {
    position: 'absolute',
    zIndex: 10,
  },
  floatingBubbleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  floatingBubbleBadgeActive: {
    backgroundColor: 'rgba(30, 18, 56, 0.88)',
    borderWidth: 1.5,
    borderColor: '#E879F9',
    shadowColor: '#E879F9',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingBubbleBadgeEmpty: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(216, 180, 254, 0.58)',
  },
  floatingBubbleLabel: {
    color: 'rgba(226, 232, 240, 0.92)',
    fontSize: 8.5,
    fontWeight: '700',
  },
  floatingBubbleLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  floatingBubbleValue: {
    color: '#F0ABFC',
    fontSize: 10.5,
    fontWeight: '900',
  },
  floatingBubbleValueActive: {
    color: '#F5D0FE',
    fontSize: 11,
    fontWeight: '900',
  },

  // Widget de Peso integrado en la esquina inferior izquierda del croquis HUD
  integratedWeightWidget: {
    position: 'absolute',
    bottom: 9,
    left: 9,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.84)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.3,
    borderColor: 'rgba(16, 185, 129, 0.7)',
    shadowColor: '#10B981',
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 15,
  },
  integratedWeightIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  integratedWeightTag: {
    color: '#34D399',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  integratedWeightValue: {
    color: '#FFFFFF',
    fontSize: 12,
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

  // Modal Backdrop y Diálogo Centrado (Anti-Overflow & Anti-Keyboard Overlay)
  modalBackdropOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalKeyboardContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollWrapper: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    width: '100%',
  },
  modalDialogCard: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.16,
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
    fontSize: 17,
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
    marginBottom: 18,
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
  hideKeyboardHint: {
    color: C.pastelPurple,
    fontSize: 10,
    fontWeight: '700',
  },
  numberInputBig: {
    color: C.text,
    fontSize: 38,
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
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  stepperBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
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

  // Modal Selector de Modelo
  selectModelCard: {
    width: '90%',
    maxWidth: 350,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  selectModelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectModelTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '900',
  },
  selectModelDescription: {
    color: C.sub,
    fontSize: 12,
    lineHeight: 17,
  },
  modelOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.borderLight,
  },
  modelOptionBtnActive: {
    borderColor: C.pastelPurple,
    backgroundColor: '#FAF5FF',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  modelOptionIconGradient: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelOptionTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: '900',
  },
  modelOptionSubtitle: {
    color: C.sub,
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 2,
  },
  activeModelTag: {
    backgroundColor: C.pastelPurple,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeModelTagText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
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
