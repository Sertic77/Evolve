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
                  top={114}
                  left={175}
                  onPress={() => onSelectPart('chest')}
                />

                {/* 2. Bíceps Derecho */}
                <BodyMeasureBubble
                  label="Bíceps D"
                  value={measurements.right_arm}
                  top={135}
                  left={8}
                  onPress={() => onSelectPart('right_arm')}
                />

                {/* 3. Bíceps Izquierdo */}
                <BodyMeasureBubble
                  label="Bíceps I"
                  value={measurements.left_arm}
                  top={135}
                  right={8}
                  onPress={() => onSelectPart('left_arm')}
                />

                {/* 4. Cintura */}
                <BodyMeasureBubble
                  label="Cintura"
                  value={measurements.waist}
                  top={180}
                  left={175}
                  onPress={() => onSelectPart('waist')}
                />

                {/* 5. Muslo Derecho */}
                <BodyMeasureBubble
                  label="Muslo D"
                  value={measurements.right_thigh}
                  top={275}
                  left={18}
                  onPress={() => onSelectPart('right_thigh')}
                />

                {/* 6. Muslo Izquierdo */}
                <BodyMeasureBubble
                  label="Muslo I"
                  value={measurements.left_thigh}
                  top={275}
                  right={18}
                  onPress={() => onSelectPart('left_thigh')}
                />
              </>
            ) : (
              <>
                {/* 1. Espalda */}
                <BodyMeasureBubble
                  label="Espalda"
                  value={measurements.back}
                  top={125}
                  left={175}
                  onPress={() => onSelectPart('back')}
                />

                {/* 2. Nalgas (Glúteos) */}
                <BodyMeasureBubble
                  label="Nalgas"
                  value={measurements.glutes}
                  top={232}
                  left={175}
                  onPress={() => onSelectPart('glutes')}
                />

                {/* 3. Antebrazo Derecho */}
                <BodyMeasureBubble
                  label="Antebrazo D"
                  value={measurements.right_forearm}
                  top={215}
                  left={8}
                  onPress={() => onSelectPart('right_forearm')}
                />

                {/* 4. Antebrazo Izquierdo */}
                <BodyMeasureBubble
                  label="Antebrazo I"
                  value={measurements.left_forearm}
                  top={215}
                  right={8}
                  onPress={() => onSelectPart('left_forearm')}
                />

                {/* 5. Gemelo Derecho (Pantorrilla D) */}
                <BodyMeasureBubble
                  label="Gemelo D"
                  value={measurements.right_calf}
                  top={395}
                  left={16}
                  onPress={() => onSelectPart('right_calf')}
                />

                {/* 6. Gemelo Izquierdo (Pantorrilla I) */}
                <BodyMeasureBubble
                  label="Gemelo I"
                  value={measurements.left_calf}
                  top={395}
                  right={16}
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
   CROQUIS ANIME: ILUSTRACIONES ANATÓMICAS DE ALTA FIDELIDAD
   CON CAPA INTERACTIVA SVG DE TOQUE Y RESALTADO
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
  const height = 520;

  // Selección de ilustración según género y vista anatómica (exacta a las fotos de referencia)
  const imageSource =
    genderModel === 'male'
      ? view === 'front'
        ? require('../assets/croquis/male_front.png')
        : require('../assets/croquis/male_back.png')
      : view === 'front'
      ? require('../assets/croquis/female_front.png')
      : require('../assets/croquis/female_back.png');

  // Renderizador de zona muscular interactiva sobre el croquis
  const renderMuscleTarget = (
    partKey: BodyPartKey,
    d: string,
    centerLabelX: number,
    centerLabelY: number
  ) => {
    const val = measurements[partKey];
    const isMeasured = val !== undefined && val > 0;

    return (
      <G key={partKey} onPress={() => onSelectPart(partKey)}>
        {/* Capa de toque y resaltado translúcido con glow al tener medida */}
        <Path
          d={d}
          fill={isMeasured ? 'rgba(139, 92, 246, 0.35)' : 'rgba(255, 255, 255, 0.01)'}
          stroke={isMeasured ? '#8B5CF6' : 'transparent'}
          strokeWidth={isMeasured ? 2 : 0}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {isMeasured && (
          <G>
            <Circle
              cx={centerLabelX}
              cy={centerLabelY}
              r={7}
              fill="rgba(139, 92, 246, 0.28)"
            />
            <Circle
              cx={centerLabelX}
              cy={centerLabelY}
              r={4}
              fill="#8B5CF6"
              stroke="#FFFFFF"
              strokeWidth={1.5}
            />
          </G>
        )}
      </G>
    );
  };

  const isMale = genderModel === 'male';

  return (
    <View style={measureStyles.svgContainer}>
      {/* 1. Ilustración Anime de Referencia en Alta Definición */}
      <Image
        source={imageSource}
        style={measureStyles.croquisIllustrationImage}
        resizeMode="contain"
      />

      {/* 2. Capa Interactiva SVG sobre el Croquis */}
      <Svg
        width={width}
        height={height}
        viewBox="0 0 300 520"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <SvgGradient id="animeGlowActive" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#A78BFA" stopOpacity="0.5" />
            <Stop offset="100%" stopColor="#F472B6" stopOpacity="0.35" />
          </SvgGradient>
        </Defs>

        {/* ========================================================
            VISTA FRONTAL (FRENTE)
        ======================================================== */}
        {view === 'front' && (
          <G>
            {isMale ? (
              /* --- HOMBRE FRONTAL (Musculoso) --- */
              <>
                {/* Pecho */}
                {renderMuscleTarget(
                  'chest',
                  'M 116 112 C 132 108, 148 108, 150 114 C 152 108, 168 108, 184 112 C 196 118, 198 135, 188 152 C 172 158, 158 158, 150 154 C 142 158, 128 158, 112 152 C 102 135, 104 118, 116 112 Z',
                  150,
                  134
                )}

                {/* Cintura (Abdominales y oblicuos) */}
                {renderMuscleTarget(
                  'waist',
                  'M 118 156 C 134 154, 166 154, 182 156 C 188 180, 192 208, 184 232 C 166 235, 134 235, 116 232 C 108 208, 112 180, 118 156 Z',
                  150,
                  194
                )}

                {/* Bíceps D (Brazo derecho - visual izquierda) */}
                {renderMuscleTarget(
                  'right_arm',
                  'M 84 110 C 96 115, 98 140, 96 170 C 94 186, 82 196, 70 194 C 56 188, 50 168, 52 145 C 54 125, 68 110, 84 110 Z',
                  72,
                  152
                )}

                {/* Bíceps I (Brazo izquierdo - visual derecha) */}
                {renderMuscleTarget(
                  'left_arm',
                  'M 216 110 C 232 110, 246 125, 248 145 C 250 168, 244 188, 230 194 C 218 196, 206 186, 204 170 C 202 140, 204 115, 216 110 Z',
                  228,
                  152
                )}

                {/* Muslo D (Cuádriceps derecho - visual izquierda) */}
                {renderMuscleTarget(
                  'right_thigh',
                  'M 114 234 C 134 234, 146 258, 148 298 C 150 338, 138 366, 126 368 C 108 368, 94 340, 90 300 C 88 260, 96 236, 114 234 Z',
                  118,
                  298
                )}

                {/* Muslo I (Cuádriceps izquierdo - visual derecha) */}
                {renderMuscleTarget(
                  'left_thigh',
                  'M 186 234 C 204 236, 212 260, 210 300 C 206 340, 192 368, 174 368 C 162 366, 150 338, 152 298 C 154 258, 166 234, 186 234 Z',
                  182,
                  298
                )}
              </>
            ) : (
              /* --- MUJER FRONTAL (Esbelta / Fit) --- */
              <>
                {/* Pecho (Top deportivo fit) */}
                {renderMuscleTarget(
                  'chest',
                  'M 120 110 C 136 108, 148 108, 150 114 C 152 108, 164 108, 180 110 C 194 116, 196 138, 186 158 C 172 164, 158 164, 150 160 C 142 164, 128 164, 114 158 C 104 138, 106 116, 120 110 Z',
                  150,
                  135
                )}

                {/* Cintura (Abdomen tonificado y cintura estrecha) */}
                {renderMuscleTarget(
                  'waist',
                  'M 120 162 C 136 160, 164 160, 180 162 C 186 182, 190 206, 182 228 C 166 230, 134 230, 118 228 C 110 206, 114 182, 120 162 Z',
                  150,
                  194
                )}

                {/* Bíceps D */}
                {renderMuscleTarget(
                  'right_arm',
                  'M 86 118 C 96 122, 98 144, 96 170 C 94 184, 84 192, 74 190 C 64 184, 60 168, 62 148 C 64 128, 74 118, 86 118 Z',
                  78,
                  152
                )}

                {/* Bíceps I */}
                {renderMuscleTarget(
                  'left_arm',
                  'M 214 118 C 226 118, 236 128, 238 148 C 240 168, 236 184, 226 190 C 216 192, 206 184, 204 170 C 202 144, 204 122, 214 118 Z',
                  222,
                  152
                )}

                {/* Muslo D (Mallas deportivas - cuádriceps) */}
                {renderMuscleTarget(
                  'right_thigh',
                  'M 116 232 C 136 232, 146 256, 148 296 C 150 336, 138 364, 126 366 C 110 366, 96 338, 92 298 C 90 258, 98 234, 116 232 Z',
                  118,
                  298
                )}

                {/* Muslo I (Mallas deportivas - cuádriceps) */}
                {renderMuscleTarget(
                  'left_thigh',
                  'M 184 232 C 202 234, 210 258, 208 298 C 204 338, 190 366, 174 366 C 162 364, 150 336, 152 296 C 154 256, 164 232, 184 232 Z',
                  182,
                  298
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
              /* --- HOMBRE POSTERIOR (Musculoso) --- */
              <>
                {/* Espalda (Dorsales en V / Trapecios) */}
                {renderMuscleTarget(
                  'back',
                  'M 150 95 C 170 95, 200 115, 212 138 C 208 175, 186 212, 168 226 C 158 228, 142 228, 132 226 C 114 212, 92 175, 88 138 C 100 115, 130 95, 150 95 Z',
                  150,
                  152
                )}

                {/* Nalgas (Glúteos atléticos) */}
                {renderMuscleTarget(
                  'glutes',
                  'M 116 228 C 138 224, 162 224, 184 228 C 202 240, 204 266, 188 282 C 172 290, 158 288, 150 274 C 142 288, 128 290, 112 282 C 96 266, 98 240, 116 228 Z',
                  150,
                  254
                )}

                {/* Antebrazo D (visual izquierda) */}
                {renderMuscleTarget(
                  'right_forearm',
                  'M 68 194 C 80 196, 84 218, 80 250 C 78 272, 68 286, 56 284 C 44 280, 42 262, 44 238 C 46 218, 54 196, 68 194 Z',
                  62,
                  238
                )}

                {/* Antebrazo I (visual derecha) */}
                {renderMuscleTarget(
                  'left_forearm',
                  'M 232 194 C 246 196, 254 218, 256 238 C 258 262, 256 280, 244 284 C 232 286, 222 272, 220 250 C 216 218, 220 196, 232 194 Z',
                  238,
                  238
                )}

                {/* Gemelo D (Pantorrilla derecha - visual izquierda) */}
                {renderMuscleTarget(
                  'right_calf',
                  'M 118 372 C 132 380, 134 412, 124 445 C 116 464, 108 470, 98 466 C 88 458, 86 438, 90 412 C 94 386, 104 372, 118 372 Z',
                  110,
                  416
                )}

                {/* Gemelo I (Pantorrilla izquierda - visual derecha) */}
                {renderMuscleTarget(
                  'left_calf',
                  'M 182 372 C 196 372, 206 386, 210 412 C 214 438, 212 458, 202 466 C 192 470, 184 464, 176 445 C 166 412, 168 380, 182 372 Z',
                  190,
                  416
                )}
              </>
            ) : (
              /* --- MUJER POSTERIOR (Esbelta / Fit) --- */
              <>
                {/* Espalda (Top deportivo racerback y espalda esculpida) */}
                {renderMuscleTarget(
                  'back',
                  'M 150 98 C 168 98, 196 116, 204 138 C 202 172, 182 206, 166 220 C 158 222, 142 222, 134 220 C 118 206, 98 172, 96 138 C 104 116, 132 98, 150 98 Z',
                  150,
                  152
                )}

                {/* Nalgas (Glúteos redondeados en mallas) */}
                {renderMuscleTarget(
                  'glutes',
                  'M 116 222 C 138 218, 162 218, 184 222 C 202 236, 204 262, 188 278 C 172 286, 158 284, 150 270 C 142 284, 128 286, 112 278 C 96 262, 98 236, 116 222 Z',
                  150,
                  250
                )}

                {/* Antebrazo D */}
                {renderMuscleTarget(
                  'right_forearm',
                  'M 70 192 C 80 194, 82 216, 80 246 C 78 268, 70 280, 60 278 C 50 274, 48 258, 50 236 C 52 216, 58 194, 70 192 Z',
                  64,
                  236
                )}

                {/* Antebrazo I */}
                {renderMuscleTarget(
                  'left_forearm',
                  'M 230 192 C 242 194, 248 216, 250 236 C 252 258, 250 274, 240 278 C 230 280, 222 268, 220 246 C 218 216, 220 194, 230 192 Z',
                  236,
                  236
                )}

                {/* Gemelo D */}
                {renderMuscleTarget(
                  'right_calf',
                  'M 116 370 C 128 378, 130 408, 122 438 C 114 458, 106 464, 98 460 C 88 452, 86 432, 90 408 C 94 382, 104 370, 116 370 Z',
                  110,
                  414
                )}

                {/* Gemelo I */}
                {renderMuscleTarget(
                  'left_calf',
                  'M 184 370 C 196 370, 206 382, 210 408 C 214 432, 212 452, 202 460 C 194 464, 186 458, 178 438 C 170 408, 172 378, 184 370 Z',
                  190,
                  414
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

  // Contenedor SVG y Croquis Anatómico Anime
  bodySvgCanvasWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  svgContainer: {
    width: 300,
    height: 520,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F3F2EC',
    borderWidth: 1.2,
    borderColor: 'rgba(203, 213, 225, 0.7)',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  croquisIllustrationImage: {
    width: 300,
    height: 520,
    borderRadius: 20,
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
