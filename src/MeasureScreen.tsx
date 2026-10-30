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
          <AnimeBodyVector
            genderModel={genderModel}
            view={bodyView}
            measurements={measurements}
            onSelectPart={onSelectPart}
          />

          {/* BURBUJAS FLOTANTES DE MEDIDA (Frontal y Posterior) */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {bodyView === 'front' ? (
              <>
                {/* 1. Pecho */}
                <BodyMeasureBubble
                  label="Pecho"
                  value={measurements.chest}
                  top={90}
                  left={168}
                  onPress={() => onSelectPart('chest')}
                />

                {/* 2. Bíceps Derecho */}
                <BodyMeasureBubble
                  label="Bíceps D"
                  value={measurements.right_arm}
                  top={112}
                  left={6}
                  onPress={() => onSelectPart('right_arm')}
                />

                {/* 3. Bíceps Izquierdo */}
                <BodyMeasureBubble
                  label="Bíceps I"
                  value={measurements.left_arm}
                  top={112}
                  right={6}
                  onPress={() => onSelectPart('left_arm')}
                />

                {/* 4. Cintura */}
                <BodyMeasureBubble
                  label="Cintura"
                  value={measurements.waist}
                  top={145}
                  left={168}
                  onPress={() => onSelectPart('waist')}
                />

                {/* 5. Muslo Derecho */}
                <BodyMeasureBubble
                  label="Muslo D"
                  value={measurements.right_thigh}
                  top={220}
                  left={24}
                  onPress={() => onSelectPart('right_thigh')}
                />

                {/* 6. Muslo Izquierdo */}
                <BodyMeasureBubble
                  label="Muslo I"
                  value={measurements.left_thigh}
                  top={220}
                  right={24}
                  onPress={() => onSelectPart('left_thigh')}
                />
              </>
            ) : (
              <>
                {/* 1. Espalda */}
                <BodyMeasureBubble
                  label="Espalda"
                  value={measurements.back}
                  top={96}
                  left={168}
                  onPress={() => onSelectPart('back')}
                />

                {/* 2. Nalgas (Glúteos) */}
                <BodyMeasureBubble
                  label="Nalgas"
                  value={measurements.glutes}
                  top={162}
                  left={168}
                  onPress={() => onSelectPart('glutes')}
                />

                {/* 3. Antebrazo Derecho */}
                <BodyMeasureBubble
                  label="Antebrazo D"
                  value={measurements.right_forearm}
                  top={174}
                  left={6}
                  onPress={() => onSelectPart('right_forearm')}
                />

                {/* 4. Antebrazo Izquierdo */}
                <BodyMeasureBubble
                  label="Antebrazo I"
                  value={measurements.left_forearm}
                  top={174}
                  right={6}
                  onPress={() => onSelectPart('left_forearm')}
                />

                {/* 5. Gemelo Derecho (Pantorrilla D) */}
                <BodyMeasureBubble
                  label="Gemelo D"
                  value={measurements.right_calf}
                  top={322}
                  left={18}
                  onPress={() => onSelectPart('right_calf')}
                />

                {/* 6. Gemelo Izquierdo (Pantorrilla I) */}
                <BodyMeasureBubble
                  label="Gemelo I"
                  value={measurements.left_calf}
                  top={322}
                  right={18}
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
              <Ionicons name="pencil-outline" size={11} color={C.pastelPurple} style={{ marginLeft: 3 }} />
            </Pressable>
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
            <Text style={measureStyles.legendLabel}>Por medir (Toca burbuja)</Text>
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
   VECTOR SVG: SILUETAS ANIME ANATÓMICAMENTE DETALLADAS
========================================================== */
function AnimeBodyVector({
  genderModel,
  view,
  measurements,
  onSelectPart,
}: {
  genderModel: GenderModel;
  view: 'front' | 'back';
  measurements: DayMeasurements;
  onSelectPart: (p: BodyPartKey) => void;
}) {
  const width = 300;
  const height = 416;

  const renderMuscleSection = (
    partKey: BodyPartKey,
    d: string,
    centerLabelX: number,
    centerLabelY: number
  ) => {
    const val = measurements[partKey];
    const isMeasured = val !== undefined && val > 0;

    const fillColor = isMeasured
      ? 'rgba(139, 92, 246, 0.4)'
      : 'rgba(238, 242, 255, 0.9)';
    const strokeColor = isMeasured ? '#8B5CF6' : 'rgba(167, 139, 250, 0.7)';
    const strokeWidth = isMeasured ? 2.5 : 1.5;

    return (
      <G key={partKey} onPress={() => onSelectPart(partKey)}>
        <Path
          d={d}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {isMeasured && (
          <Circle
            cx={centerLabelX}
            cy={centerLabelY}
            r={3.8}
            fill="#8B5CF6"
          />
        )}
      </G>
    );
  };

  const isMale = genderModel === 'male';

  return (
    <View style={measureStyles.svgContainer}>
      <Svg width={width} height={height} viewBox="0 0 300 416">
        <Defs>
          <SvgGradient id="animeGlowActive" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#A78BFA" stopOpacity="0.45" />
            <Stop offset="100%" stopColor="#F472B6" stopOpacity="0.3" />
          </SvgGradient>

          <SvgGradient id="animeHeadGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="rgba(241, 245, 249, 0.98)" />
            <Stop offset="100%" stopColor="rgba(226, 232, 240, 0.9)" />
          </SvgGradient>
        </Defs>

        {/* 1. CABEZA ANIME DETALLADA (No interactúa) */}
        <G>
          <Circle cx="150" cy="38" r="23" fill="rgba(203, 213, 225, 0.16)" />
          {isMale ? (
            /* Cabeza masculina anime con peinado puntiagudo y mandíbula marcada */
            <>
              <Path
                d="M 150 12 C 132 12, 124 23, 124 39 C 124 53, 133 65, 143 69 L 142 77 L 158 77 L 157 69 C 167 65, 176 53, 176 39 C 176 23, 168 12, 150 12 Z"
                fill="url(#animeHeadGrad)"
                stroke="rgba(148, 163, 184, 0.7)"
                strokeWidth="1.5"
              />
              {/* Mechones anime detallados */}
              <Path d="M 130 26 Q 142 16 150 24 Q 158 16 170 26" stroke="rgba(167, 139, 250, 0.5)" strokeWidth="1.2" fill="none" />
              <Path d="M 138 34 Q 150 28 162 34" stroke="rgba(167, 139, 250, 0.4)" strokeWidth="1.1" fill="none" />
            </>
          ) : (
            /* Cabeza femenina anime con mentón fino y peinado suave */
            <>
              <Path
                d="M 150 14 C 135 14, 127 25, 127 39 C 127 52, 135 63, 144 68 L 145 77 L 155 77 L 156 68 C 165 63, 173 52, 173 39 C 173 25, 165 14, 150 14 Z"
                fill="url(#animeHeadGrad)"
                stroke="rgba(148, 163, 184, 0.7)"
                strokeWidth="1.5"
              />
              <Path d="M 134 26 C 144 20, 156 20, 166 26" stroke="rgba(244, 114, 182, 0.5)" strokeWidth="1.2" fill="none" />
            </>
          )}
          {/* Cuello con trapecios */}
          <Path
            d={isMale ? 'M 142 74 L 140 83 L 160 83 L 158 74 Z' : 'M 145 74 L 144 83 L 156 83 L 155 74 Z'}
            fill="rgba(226, 232, 240, 0.9)"
            stroke="rgba(148, 163, 184, 0.6)"
            strokeWidth="1.2"
          />
        </G>

        {/* 2. MANOS ANATÓMICAS (No interactúan) */}
        <G>
          <Path
            d="M 44 218 C 42 224, 39 232, 42 238 C 44 242, 49 242, 51 236 L 53 218 Z"
            fill="rgba(226, 232, 240, 0.85)"
            stroke="rgba(148, 163, 184, 0.6)"
            strokeWidth="1.3"
          />
          <Path
            d="M 256 218 C 258 224, 261 232, 258 238 C 256 242, 251 242, 249 236 L 247 218 Z"
            fill="rgba(226, 232, 240, 0.85)"
            stroke="rgba(148, 163, 184, 0.6)"
            strokeWidth="1.3"
          />
        </G>

        {/* 3. PIES ANATÓMICOS (No interactúan) */}
        <G>
          <Path
            d="M 114 380 C 112 388, 107 396, 103 401 C 100 404, 107 406, 116 405 C 124 404, 126 399, 125 380 Z"
            fill="rgba(226, 232, 240, 0.85)"
            stroke="rgba(148, 163, 184, 0.6)"
            strokeWidth="1.3"
          />
          <Path
            d="M 186 380 C 188 388, 193 396, 197 401 C 200 404, 193 406, 184 405 C 176 404, 174 399, 175 380 Z"
            fill="rgba(226, 232, 240, 0.85)"
            stroke="rgba(148, 163, 184, 0.6)"
            strokeWidth="1.3"
          />
        </G>

        {/* ========================================================
            VISTA FRONTAL (FRENTE)
        ======================================================== */}
        {view === 'front' && (
          <G>
            {isMale ? (
              /* --- HOMBRE FRONTAL (Musculoso / V-Taper) --- */
              <>
                {/* Clavículas & Trapecios decorativos */}
                <Line x1="141" y1="83" x2="110" y2="87" stroke="rgba(148, 163, 184, 0.45)" strokeWidth="1.2" />
                <Line x1="159" y1="83" x2="190" y2="87" stroke="rgba(148, 163, 184, 0.45)" strokeWidth="1.2" />

                {/* PECHO - Pectorales Esculpidos con surco esternal */}
                {renderMuscleSection(
                  'chest',
                  'M 140 82 C 114 82, 97 90, 86 102 C 80 116, 88 133, 114 136 C 132 138, 146 131, 150 119 C 154 131, 168 138, 186 136 C 212 133, 220 116, 214 102 C 203 90, 186 82, 160 82 Z',
                  150,
                  108
                )}

                {/* CINTURA - Oblicuos & Core Atlético en V */}
                {renderMuscleSection(
                  'waist',
                  'M 114 136 C 132 138, 147 131, 150 120 C 153 131, 168 138, 186 136 L 178 178 C 164 183, 136 183, 122 178 Z',
                  150,
                  155
                )}

                {/* Líneas de definición abdominal (Six-pack) */}
                <Line x1="150" y1="126" x2="150" y2="176" stroke="rgba(167, 139, 250, 0.45)" strokeWidth="1.2" />
                <Line x1="136" y1="145" x2="164" y2="145" stroke="rgba(167, 139, 250, 0.35)" strokeWidth="1.1" />
                <Line x1="138" y1="160" x2="162" y2="160" stroke="rgba(167, 139, 250, 0.35)" strokeWidth="1.1" />

                {/* BRAZO D - Deltoides & Bíceps marcado */}
                {renderMuscleSection(
                  'right_arm',
                  'M 85 96 C 75 96, 63 107, 59 124 C 54 139, 53 153, 57 159 L 76 159 C 82 148, 87 132, 89 114 Z',
                  71,
                  128
                )}

                {/* BRAZO I - Deltoides & Bíceps marcado */}
                {renderMuscleSection(
                  'left_arm',
                  'M 215 96 C 225 96, 237 107, 241 124 C 246 139, 247 153, 243 159 L 224 159 C 218 148, 213 132, 211 114 Z',
                  229,
                  128
                )}

                {/* ANTEBRAZO D */}
                {renderMuscleSection(
                  'right_forearm',
                  'M 57 161 L 75 161 C 73 180, 67 200, 51 218 L 43 218 C 45 198, 51 176, 57 161 Z',
                  59,
                  188
                )}

                {/* ANTEBRAZO I */}
                {renderMuscleSection(
                  'left_forearm',
                  'M 243 161 L 225 161 C 227 180, 233 200, 249 218 L 257 218 C 255 198, 249 176, 243 161 Z',
                  241,
                  188
                )}

                {/* MUSLO D - Cuádriceps con barrido de vasto lateral y medial */}
                {renderMuscleSection(
                  'right_thigh',
                  'M 122 179 L 148 180 L 144 246 C 141 268, 137 284, 128 290 L 108 290 C 101 278, 97 250, 101 220 C 105 195, 114 184, 122 179 Z',
                  124,
                  234
                )}

                {/* MUSLO I - Cuádriceps con barrido de vasto lateral y medial */}
                {renderMuscleSection(
                  'left_thigh',
                  'M 178 179 L 152 180 L 156 246 C 159 268, 163 284, 172 290 L 192 290 C 199 278, 203 250, 199 220 C 195 195, 186 184, 178 179 Z',
                  176,
                  234
                )}

                {/* PANTORRILLA D - Diamante gastrocnemio */}
                {renderMuscleSection(
                  'right_calf',
                  'M 108 292 L 128 292 C 131 312, 133 342, 125 378 L 113 378 C 104 346, 102 318, 108 292 Z',
                  118,
                  334
                )}

                {/* PANTORRILLA I - Diamante gastrocnemio */}
                {renderMuscleSection(
                  'left_calf',
                  'M 192 292 L 172 292 C 169 312, 167 342, 175 378 L 187 378 C 196 346, 198 318, 192 292 Z',
                  182,
                  334
                )}
              </>
            ) : (
              /* --- MUJER FRONTAL (Esbelta / Fit Hourglass) --- */
              <>
                <Line x1="143" y1="83" x2="116" y2="86" stroke="rgba(244, 114, 182, 0.4)" strokeWidth="1.1" />
                <Line x1="157" y1="83" x2="184" y2="86" stroke="rgba(244, 114, 182, 0.4)" strokeWidth="1.1" />

                {/* PECHO - Tonificado y Femenino */}
                {renderMuscleSection(
                  'chest',
                  'M 142 82 C 122 82, 108 90, 100 102 C 94 114, 102 128, 122 131 C 136 133, 146 126, 150 118 C 154 126, 164 133, 178 131 C 198 128, 206 114, 200 102 C 192 90, 178 82, 158 82 Z',
                  150,
                  106
                )}

                {/* CINTURA - Estrecha Reloj de Arena Fit */}
                {renderMuscleSection(
                  'waist',
                  'M 122 131 C 136 133, 146 126, 150 118 C 154 126, 164 133, 178 131 L 186 176 C 168 180, 132 180, 114 176 Z',
                  150,
                  152
                )}

                {/* Línea sutil de abdomen plano femenino */}
                <Line x1="150" y1="124" x2="150" y2="172" stroke="rgba(244, 114, 182, 0.35)" strokeWidth="1.1" />

                {/* BRAZO D - Esbelto y Tonificado */}
                {renderMuscleSection(
                  'right_arm',
                  'M 98 96 C 88 96, 76 106, 73 122 C 70 136, 70 152, 74 158 L 89 158 C 94 148, 98 130, 100 114 Z',
                  82,
                  128
                )}

                {/* BRAZO I - Esbelto y Tonificado */}
                {renderMuscleSection(
                  'left_arm',
                  'M 202 96 C 212 96, 224 106, 227 122 C 230 136, 230 152, 226 158 L 211 158 C 206 148, 202 130, 200 114 Z',
                  218,
                  128
                )}

                {/* ANTEBRAZO D */}
                {renderMuscleSection(
                  'right_forearm',
                  'M 74 160 L 89 160 C 86 178, 80 198, 54 218 L 45 218 C 50 198, 66 176, 74 160 Z',
                  68,
                  188
                )}

                {/* ANTEBRAZO I */}
                {renderMuscleSection(
                  'left_forearm',
                  'M 226 160 L 211 160 C 214 178, 220 198, 246 218 L 255 218 C 250 198, 234 176, 226 160 Z',
                  232,
                  188
                )}

                {/* MUSLO D - Curva de cadera y pierna esbelta */}
                {renderMuscleSection(
                  'right_thigh',
                  'M 114 177 L 148 178 L 144 246 C 141 268, 136 284, 126 290 L 110 290 C 100 278, 96 250, 100 220 C 104 195, 108 184, 114 177 Z',
                  122,
                  234
                )}

                {/* MUSLO I - Curva de cadera y pierna esbelta */}
                {renderMuscleSection(
                  'left_thigh',
                  'M 186 177 L 152 178 L 156 246 C 159 268, 164 284, 174 290 L 190 290 C 200 278, 204 250, 200 220 C 196 195, 192 184, 186 177 Z',
                  178,
                  234
                )}

                {/* PANTORRILLA D - Estilizada */}
                {renderMuscleSection(
                  'right_calf',
                  'M 110 292 L 126 292 C 128 312, 130 342, 124 378 L 114 378 C 106 346, 104 318, 110 292 Z',
                  118,
                  334
                )}

                {/* PANTORRILLA I - Estilizada */}
                {renderMuscleSection(
                  'left_calf',
                  'M 190 292 L 174 292 C 172 312, 170 342, 176 378 L 186 378 C 194 346, 196 318, 190 292 Z',
                  182,
                  334
                )}
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
              /* --- HOMBRE POSTERIOR (Espalda V-Taper, Glúteos) --- */
              <>
                {/* ESPALDA - Gran Dorsal y Trapecios en V */}
                {renderMuscleSection(
                  'back',
                  'M 141 82 L 159 82 C 184 84, 204 92, 214 104 C 220 118, 210 138, 188 146 C 174 150, 150 152, 150 152 C 150 152, 126 150, 112 146 C 90 138, 80 118, 86 104 C 96 92, 116 84, 141 82 Z',
                  150,
                  116
                )}

                {/* Escápulas y corte dorsal */}
                <Line x1="150" y1="84" x2="150" y2="150" stroke="rgba(167, 139, 250, 0.45)" strokeWidth="1.2" />
                <Path d="M 132 108 Q 140 120 150 126 Q 160 120 168 108" stroke="rgba(167, 139, 250, 0.35)" strokeWidth="1.1" fill="none" />

                {/* NALGAS / GLÚTEOS - Redondeados y firmes */}
                {renderMuscleSection(
                  'glutes',
                  'M 120 152 C 134 154, 150 155, 150 162 C 150 155, 166 154, 180 152 C 198 162, 200 188, 182 202 C 168 212, 154 206, 150 200 C 146 206, 132 212, 118 202 C 100 188, 102 162, 120 152 Z',
                  150,
                  180
                )}

                {/* BRAZO D - Tríceps */}
                {renderMuscleSection(
                  'right_arm',
                  'M 86 96 C 76 96, 64 107, 60 124 C 55 139, 54 153, 58 159 L 77 159 C 83 148, 88 132, 90 114 Z',
                  72,
                  128
                )}

                {/* BRAZO I - Tríceps */}
                {renderMuscleSection(
                  'left_arm',
                  'M 214 96 C 224 96, 236 107, 240 124 C 245 139, 246 153, 242 159 L 223 159 C 217 148, 212 132, 210 114 Z',
                  228,
                  128
                )}

                {/* ANTEBRAZO D */}
                {renderMuscleSection(
                  'right_forearm',
                  'M 58 161 L 76 161 C 74 180, 68 200, 52 218 L 43 218 C 45 198, 52 176, 58 161 Z',
                  60,
                  188
                )}

                {/* ANTEBRAZO I */}
                {renderMuscleSection(
                  'left_forearm',
                  'M 242 161 L 224 161 C 226 180, 232 200, 248 218 L 257 218 C 255 198, 248 176, 242 161 Z',
                  240,
                  188
                )}

                {/* MUSLO D - Isquiotibiales */}
                {renderMuscleSection(
                  'right_thigh',
                  'M 118 202 C 132 212, 146 206, 150 200 L 144 252 C 141 270, 137 284, 128 290 L 108 290 C 101 278, 98 250, 104 220 Z',
                  124,
                  248
                )}

                {/* MUSLO I - Isquiotibiales */}
                {renderMuscleSection(
                  'left_thigh',
                  'M 182 202 C 168 212, 154 206, 150 200 L 156 252 C 159 270, 163 284, 172 290 L 192 290 C 199 278, 202 250, 196 220 Z',
                  176,
                  248
                )}

                {/* PANTORRILLA D - Gemelos posteriores */}
                {renderMuscleSection(
                  'right_calf',
                  'M 108 292 L 128 292 C 132 314, 134 342, 125 378 L 113 378 C 103 346, 102 318, 108 292 Z',
                  118,
                  334
                )}

                {/* PANTORRILLA I - Gemelos posteriores */}
                {renderMuscleSection(
                  'left_calf',
                  'M 192 292 L 172 292 C 168 314, 166 342, 175 378 L 187 378 C 197 346, 198 318, 192 292 Z',
                  182,
                  334
                )}
              </>
            ) : (
              /* --- MUJER POSTERIOR (Espalda Esbelta, Glúteos Pronunciados) --- */
              <>
                {/* ESPALDA - Tónica y Femenina */}
                {renderMuscleSection(
                  'back',
                  'M 144 82 L 156 82 C 176 84, 194 92, 202 104 C 208 116, 200 134, 182 142 C 170 146, 150 148, 150 148 C 150 148, 130 146, 118 142 C 100 134, 92 116, 98 104 C 106 92, 124 84, 144 82 Z',
                  150,
                  114
                )}

                <Line x1="150" y1="84" x2="150" y2="146" stroke="rgba(244, 114, 182, 0.4)" strokeWidth="1.1" />

                {/* NALGAS / GLÚTEOS - Curvatura pronunciada y estética */}
                {renderMuscleSection(
                  'glutes',
                  'M 116 148 C 132 150, 150 152, 150 160 C 150 152, 168 150, 184 148 C 204 160, 208 188, 190 204 C 172 216, 156 210, 150 202 C 144 210, 128 216, 110 204 C 92 188, 96 160, 116 148 Z',
                  150,
                  182
                )}

                {/* BRAZO D - Tríceps */}
                {renderMuscleSection(
                  'right_arm',
                  'M 98 96 C 88 96, 76 106, 73 122 C 70 136, 70 152, 74 158 L 89 158 C 94 148, 98 130, 100 114 Z',
                  82,
                  128
                )}

                {/* BRAZO I - Tríceps */}
                {renderMuscleSection(
                  'left_arm',
                  'M 202 96 C 212 96, 224 106, 227 122 C 230 136, 230 152, 226 158 L 211 158 C 206 148, 202 130, 200 114 Z',
                  218,
                  128
                )}

                {/* ANTEBRAZO D */}
                {renderMuscleSection(
                  'right_forearm',
                  'M 74 160 L 89 160 C 86 178, 80 198, 54 218 L 45 218 C 50 198, 66 176, 74 160 Z',
                  68,
                  188
                )}

                {/* ANTEBRAZO I */}
                {renderMuscleSection(
                  'left_forearm',
                  'M 226 160 L 211 160 C 214 178, 220 198, 246 218 L 255 218 C 250 198, 234 176, 226 160 Z',
                  232,
                  188
                )}

                {/* MUSLO D - Isquiotibiales */}
                {renderMuscleSection(
                  'right_thigh',
                  'M 110 204 C 128 216, 144 210, 150 202 L 144 252 C 141 270, 136 284, 126 290 L 110 290 C 100 278, 96 250, 100 220 Z',
                  122,
                  248
                )}

                {/* MUSLO I - Isquiotibiales */}
                {renderMuscleSection(
                  'left_thigh',
                  'M 190 204 C 172 216, 156 210, 150 202 L 156 252 C 159 270, 164 284, 174 290 L 190 290 C 200 278, 204 250, 200 220 Z',
                  178,
                  248
                )}

                {/* PANTORRILLA D - Gemelos */}
                {renderMuscleSection(
                  'right_calf',
                  'M 110 292 L 126 292 C 130 314, 132 342, 124 378 L 114 378 C 106 346, 104 318, 110 292 Z',
                  118,
                  334
                )}

                {/* PANTORRILLA I - Gemelos */}
                {renderMuscleSection(
                  'left_calf',
                  'M 190 292 L 174 292 C 170 314, 168 342, 176 378 L 186 378 C 194 346, 196 318, 190 292 Z',
                  182,
                  334
                )}
              </>
            )}
          </G>
        )}
      </Svg>
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

  // Contenedor SVG
  bodySvgCanvasWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  svgContainer: {
    width: 300,
    height: 416,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Burbujas de medida sobre la silueta (Interactivas)
  floatingBubbleContainer: {
    position: 'absolute',
    zIndex: 10,
  },
  floatingBubbleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  floatingBubbleBadgeActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  floatingBubbleBadgeEmpty: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: 'rgba(167, 139, 250, 0.6)',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  floatingBubbleLabel: {
    color: C.sub,
    fontSize: 8.5,
    fontWeight: '700',
  },
  floatingBubbleLabelActive: {
    color: C.text,
    fontWeight: '800',
  },
  floatingBubbleValue: {
    color: C.pastelPurple,
    fontSize: 10.5,
    fontWeight: '900',
  },
  floatingBubbleValueActive: {
    color: '#8B5CF6',
    fontSize: 11,
    fontWeight: '900',
  },

  // Widget de Peso integrado en la esquina inferior izquierda del croquis
  integratedWeightWidget: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    shadowColor: '#10B981',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
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
    color: '#10B981',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  integratedWeightValue: {
    color: C.text,
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
