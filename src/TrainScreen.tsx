import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  Alert,
  Platform,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, GRADIENTS, fmt } from './theme';
import {
  useStore,
  dateKey,
  uid,
  Exercise,
  WorkoutExercise,
  WorkoutSet,
} from './store';
import { DateSelector, PrimaryButton, s } from './components';

const MUSCLE_GROUPS = ['Todos', 'Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core'];

/* ==========================================================
   PANTALLA PRINCIPAL DE ENTRENAMIENTO
========================================================== */
export default function TrainScreen() {
  const [tab, setTab] = useState(0); // 0: Registrar, 1: Estadísticas
  const [date, setDate] = useState(new Date());
  const key = dateKey(date);

  const { exercises, workoutLogs, setDayWorkout, upsertExercise } = useStore();
  const dayExercises = workoutLogs[key] ?? [];

  // Ejercicio seleccionado para ver estadísticas detalladas (null = rotación automática)
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  // Rango de fechas para estadísticas (en días hacia atrás, null = todo el tiempo)
  const [timeRangeDays, setTimeRangeDays] = useState<number | null>(30); // 7, 30, 90, null
  const [rangeModalOpen, setRangeModalOpen] = useState(false);

  // Modal para seleccionar ejercicio al registrar
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState<string | null>(null);

  // Modal para crear/editar ejercicio en la biblioteca
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  // Animación suave de transición de contenido entre pestañas
  const contentFadeAnim = useRef(new Animated.Value(1)).current;
  const contentSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    contentFadeAnim.setValue(0);
    contentSlideAnim.setValue(6);
    Animated.parallel([
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentSlideAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [tab]);

  // Manejo de agregar ejercicio al día
  const handleSelectExercise = (ex: Exercise) => {
    const newEx: WorkoutExercise = {
      id: uid(),
      exerciseId: ex.id,
      sets: [
        { id: uid(), weight: 20, reps: 10 },
        { id: uid(), weight: 20, reps: 10 },
        { id: uid(), weight: 20, reps: 10 },
      ],
    };
    setDayWorkout(key, [...dayExercises, newEx]);
    setPickerOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          tab === 1 && { paddingBottom: 320 },
        ]}
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Anime Pastel Claro */}
        <View style={styles.topHeader}>
          <View>
            <View style={styles.cyberTagRow}>
              <Ionicons name="flash" size={11} color={C.pastelPurple} />
              <Text style={styles.cyberTagText}>✦ EVOLVE // ENTRENAMIENTO ✦</Text>
            </View>
            <Text style={styles.screenTitle}>Entreno</Text>
          </View>

          <View style={styles.dateChipMini}>
            <Ionicons name="barbell-outline" size={14} color={C.pastelPurple} />
            <Text style={styles.dateChipMiniText}>
              {tab === 0
                ? date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()
                : 'MÉTRICAS'}
            </Text>
          </View>
        </View>

        {/* GRÁFICA DINÁMICA SUPERIOR (Cambia de tamaño y modo) */}
        <WorkoutDynamicChart
          tab={tab}
          dayExercises={dayExercises}
          workoutLogs={workoutLogs}
          exercises={exercises}
          selectedExerciseId={selectedExerciseId}
          onClearSelectedExercise={() => setSelectedExerciseId(null)}
          timeRangeDays={timeRangeDays}
          onOpenRangePicker={() => setRangeModalOpen(true)}
        />

        {/* Selector Maestro de Modo (Píldora deslizante ultra smooth) */}
        <TrainNavigationSegmented value={tab} onChange={setTab} />

        {/* Contenido Animado según pestaña */}
        <Animated.View
          style={{
            opacity: contentFadeAnim,
            transform: [{ translateY: contentSlideAnim }],
          }}
        >
          {tab === 0 ? (
            <WorkoutDayLog
              date={date}
              setDate={setDate}
              dayExercises={dayExercises}
              exercises={exercises}
              dayKey={key}
              onOpenExercisePicker={() => setPickerOpen(true)}
            />
          ) : (
            <WorkoutStatsLibrary
              exercises={exercises}
              workoutLogs={workoutLogs}
              selectedExerciseId={selectedExerciseId}
              onSelectExercise={(id) =>
                setSelectedExerciseId((prev) => (prev === id ? null : id))
              }
              onOpenCreateModal={() =>
                setEditingExercise({ id: uid(), name: '', muscleGroup: 'Pecho' })
              }
              onEditExercise={(ex) => setEditingExercise(ex)}
            />
          )}
        </Animated.View>
      </ScrollView>

      {/* MODAL DE BÚSQUEDA Y SELECCIÓN DE EJERCICIO */}
      <ExercisePickerModal
        visible={pickerOpen}
        exercises={exercises}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectExercise}
        onCreateNew={(initialName) => {
          setPickerOpen(false);
          setQuickCreateName(initialName);
        }}
      />

      {/* Modal para crear ejercicio nuevo con auto-asignación inmediata */}
      {quickCreateName !== null && (
        <ExerciseFormModal
          exercise={{ id: uid(), name: quickCreateName, muscleGroup: 'Pecho' }}
          onClose={() => setQuickCreateName(null)}
          onSave={(newEx) => {
            upsertExercise(newEx);
            handleSelectExercise(newEx); // Asigna inmediatamente al día
            setQuickCreateName(null);
          }}
        />
      )}

      {/* Modal para crear/editar ejercicio desde la biblioteca */}
      {editingExercise !== null && (
        <ExerciseFormModal
          exercise={editingExercise}
          onClose={() => setEditingExercise(null)}
          onSave={(saved) => {
            upsertExercise(saved);
            setEditingExercise(null);
          }}
        />
      )}

      {/* Modal de selección de Rango de Fechas para Estadísticas */}
      <RangeFilterModal
        visible={rangeModalOpen}
        currentDays={timeRangeDays}
        onClose={() => setRangeModalOpen(false)}
        onSelectRange={(days) => {
          setTimeRangeDays(days);
          setRangeModalOpen(false);
        }}
      />
    </View>
  );
}

/* ==========================================================
   GRÁFICA DINÁMICA SUPERIOR (Crece en estadísticas + Botón Calendario)
========================================================== */
function WorkoutDynamicChart({
  tab,
  dayExercises,
  workoutLogs,
  exercises,
  selectedExerciseId,
  onClearSelectedExercise,
  timeRangeDays,
  onOpenRangePicker,
}: {
  tab: number;
  dayExercises: WorkoutExercise[];
  workoutLogs: Record<string, WorkoutExercise[]>;
  exercises: Exercise[];
  selectedExerciseId: string | null;
  onClearSelectedExercise: () => void;
  timeRangeDays: number | null;
  onOpenRangePicker: () => void;
}) {
  // Altura animada: crece cuando pasa a estadísticas
  const heightAnim = useRef(new Animated.Value(tab === 0 ? 172 : 270)).current;

  // Animación del fondo (orbes flotantes)
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;

  // Rotación automática de estadísticas cuando no hay ejercicio seleccionado
  const [statIndex, setStatIndex] = useState(0);
  const statFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: tab === 0 ? 172 : 270,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [tab]);

  useEffect(() => {
    const bgLoop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim1, {
          toValue: 1,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim1, {
          toValue: 0,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const bgLoop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim2, {
          toValue: 1,
          duration: 6500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim2, {
          toValue: 0,
          duration: 6500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    bgLoop1.start();
    bgLoop2.start();

    return () => {
      bgLoop1.stop();
      bgLoop2.stop();
    };
  }, []);

  // Cálculo de totales del día actual (Registrar entrenamiento)
  const dayStats = useMemo(() => {
    let totalVolume = 0;
    let totalSets = 0;
    let totalReps = 0;

    dayExercises.forEach((we) => {
      we.sets.forEach((s) => {
        totalSets += 1;
        totalReps += s.reps || 0;
        totalVolume += (s.weight || 0) * (s.reps || 0);
      });
    });

    return { totalVolume, totalSets, totalReps };
  }, [dayExercises]);

  // Recopilación de estadísticas rotativas históricas (cuando no hay ejercicio seleccionado)
  const autoRotateStats = useMemo(() => {
    const allRecords: { title: string; subtitle: string; value: string; unit: string; icon: any }[] = [];

    // Calcular PR máx de ejercicios
    const maxWeights: Record<string, { weight: number; reps: number; date: string }> = {};
    let grandTotalVolume = 0;
    let grandTotalSets = 0;

    Object.entries(workoutLogs).forEach(([dateStr, weList]) => {
      weList.forEach((we) => {
        we.sets.forEach((s) => {
          grandTotalSets += 1;
          grandTotalVolume += (s.weight || 0) * (s.reps || 0);
          if (!maxWeights[we.exerciseId] || s.weight > maxWeights[we.exerciseId].weight) {
            maxWeights[we.exerciseId] = { weight: s.weight, reps: s.reps, date: dateStr };
          }
        });
      });
    });

    // Añadir mejores marcas de ejercicios
    Object.entries(maxWeights).forEach(([exId, data]) => {
      const ex = exercises.find((e) => e.id === exId);
      if (ex && data.weight > 0) {
        allRecords.push({
          title: `PR // ${ex.name.toUpperCase()}`,
          subtitle: `${data.reps} reps el ${data.date}`,
          value: `${data.weight}`,
          unit: 'KG MÁX',
          icon: 'trophy',
        });
      }
    });

    // Añadir volumen total acumulado
    allRecords.push({
      title: 'VOLUMEN HISTÓRICO TOTAL',
      subtitle: 'Energía levantada en todos los entrenamientos',
      value: grandTotalVolume > 1000 ? `${fmt(grandTotalVolume / 1000)}k` : `${grandTotalVolume}`,
      unit: 'KG TOTALES',
      icon: 'barbell',
    });

    // Añadir series acumuladas
    allRecords.push({
      title: 'SERIES TOTALES COMPLETADAS',
      subtitle: 'Constancia y disciplina acumulada',
      value: `${grandTotalSets}`,
      unit: 'SETS',
      icon: 'flame',
    });

    return allRecords.length > 0
      ? allRecords
      : [
          {
            title: 'REGISTRA TU PRIMER ENTRENO',
            subtitle: 'Las estadísticas comenzarán a rotar aquí',
            value: '0',
            unit: 'KG',
            icon: 'barbell',
          },
        ];
  }, [workoutLogs, exercises]);

  // Ciclo de rotación de estadísticas automáticas cada 3.6s
  useEffect(() => {
    if (tab !== 1 || selectedExerciseId !== null) return;

    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(statFadeAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(statFadeAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      setStatIndex((prev) => (prev + 1) % autoRotateStats.length);
    }, 3800);

    return () => clearInterval(interval);
  }, [tab, selectedExerciseId, autoRotateStats.length]);

  // Datos para la gráfica histórica de un ejercicio específico
  const historyData = useMemo(() => {
    if (!selectedExerciseId) return [];

    const now = new Date();
    const cutoffDate = timeRangeDays
      ? new Date(now.getTime() - timeRangeDays * 24 * 60 * 60 * 1000)
      : new Date(0);

    const points: { dateStr: string; dateObj: Date; maxWeight: number; totalVolume: number }[] = [];

    Object.entries(workoutLogs).forEach(([dateStr, weList]) => {
      const match = weList.find((we) => we.exerciseId === selectedExerciseId);
      if (match && match.sets.length > 0) {
        const parts = dateStr.split('-');
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

        if (dateObj >= cutoffDate) {
          const maxWeight = Math.max(...match.sets.map((s) => s.weight || 0));
          const totalVolume = match.sets.reduce((acc, s) => acc + (s.weight || 0) * (s.reps || 0), 0);
          points.push({ dateStr, dateObj, maxWeight, totalVolume });
        }
      }
    });

    return points.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [workoutLogs, selectedExerciseId, timeRangeDays]);

  const selectedExercise = exercises.find((e) => e.id === selectedExerciseId);

  // Interpolación de orbes flotantes
  const transX1 = floatAnim1.interpolate({ inputRange: [0, 1], outputRange: [-20, 25] });
  const transY1 = floatAnim1.interpolate({ inputRange: [0, 1], outputRange: [-10, 15] });
  const transX2 = floatAnim2.interpolate({ inputRange: [0, 1], outputRange: [20, -25] });
  const transY2 = floatAnim2.interpolate({ inputRange: [0, 1], outputRange: [15, -15] });

  const rangeLabel = timeRangeDays === 7 ? '7 días' : timeRangeDays === 30 ? '30 días' : timeRangeDays === 90 ? '3 meses' : 'Todo';

  return (
    <Animated.View style={[s.glassCard, { height: heightAnim, marginBottom: 8 }]}>
      {/* CAPA DE FONDO ANIMADO ANIME */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[s.floatingOrb1, { transform: [{ translateX: transX1 }, { translateY: transY1 }] }]} />
        <Animated.View style={[s.floatingOrb2, { transform: [{ translateX: transX2 }, { translateY: transY2 }] }]} />
        <Animated.View style={s.floatingOrb3} />
      </View>

      <LinearGradient colors={GRADIENTS.cardGlass} style={[s.cardGradient, { flex: 1 }]}>
        {/* CABECERA DE LA GRÁFICA */}
        <View style={styles.chartHeaderRow}>
          <View style={s.hudBadge}>
            <Ionicons name="sparkles" size={11} color={C.pastelPurple} />
            <Text style={s.hudBadgeText}>
              {tab === 0 ? '✦ SESIÓN DEL DÍA ✦' : selectedExercise ? `✦ HISTORIAL: ${selectedExercise.name.toUpperCase()} ✦` : '✦ ESTADÍSTICAS GLOBALES ✦'}
            </Text>
          </View>

          {/* BOTÓN DE CALENDARIO / RANGO EN ESTADÍSTICAS */}
          {tab === 1 && (
            <Pressable
              onPress={onOpenRangePicker}
              style={({ pressed }) => [styles.rangePickerBtn, pressed && s.btnPressed]}
            >
              <Ionicons name="calendar-outline" size={13} color={C.pastelPurple} />
              <Text style={styles.rangePickerBtnText}>{rangeLabel}</Text>
              <Ionicons name="chevron-down" size={11} color={C.sub} />
            </Pressable>
          )}
        </View>

        {/* MODO 1: GRÁFICA RESUMEN DE SESIÓN DIARIA */}
        {tab === 0 && (
          <View style={styles.dayWorkoutSummaryRow}>
            {/* Medidor Circular de Volumen */}
            <View style={styles.workoutVolRingContainer}>
              <Svg width={116} height={116} style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={58} cy={58} r={46} stroke="rgba(203, 213, 225, 0.4)" strokeWidth={10} fill="none" />
                <Circle
                  cx={58}
                  cy={58}
                  r={46}
                  stroke={C.pastelPurple}
                  strokeWidth={10}
                  fill="none"
                  strokeDasharray={`${Math.min(dayStats.totalVolume / 100, 289)} 289`}
                  strokeLinecap="round"
                />
              </Svg>
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="barbell" size={16} color={C.pastelPurple} style={{ marginBottom: 2 }} />
                <Text style={styles.workoutVolNumber}>
                  {dayStats.totalVolume > 9999 ? `${Math.round(dayStats.totalVolume / 1000)}k` : `${Math.round(dayStats.totalVolume)}`}
                </Text>
                <Text style={styles.workoutVolUnit}>KG VOL</Text>
              </View>
            </View>

            {/* Métricas laterales en tarjetas pastel */}
            <View style={{ flex: 1, marginLeft: 16, gap: 8 }}>
              <View style={styles.metricPillCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="layers-outline" size={14} color={C.pastelPurple} />
                  <Text style={styles.metricPillLabel}>Series realizadas</Text>
                </View>
                <Text style={styles.metricPillValue}>{dayStats.totalSets} sets</Text>
              </View>

              <View style={styles.metricPillCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="repeat-outline" size={14} color={C.pastelPink} />
                  <Text style={styles.metricPillLabel}>Repeticiones totales</Text>
                </View>
                <Text style={[styles.metricPillValue, { color: C.pastelPink }]}>{dayStats.totalReps} reps</Text>
              </View>

              <View style={styles.metricPillCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="fitness-outline" size={14} color={C.pastelMint} />
                  <Text style={styles.metricPillLabel}>Ejercicios distintos</Text>
                </View>
                <Text style={[styles.metricPillValue, { color: C.pastelMint }]}>{dayExercises.length} ejer</Text>
              </View>
            </View>
          </View>
        )}

        {/* MODO 2: ESTADÍSTICAS AMPLIADAS */}
        {tab === 1 && (
          <View style={{ flex: 1, justifyContent: 'center', marginTop: 10 }}>
            {selectedExercise ? (
              /* GRÁFICA SVG HISTÓRICA DEL EJERCICIO SELECCIONADO */
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <View>
                    <Text style={styles.selectedExerciseNameHeader}>{selectedExercise.name}</Text>
                    <Text style={styles.selectedExerciseSub}>Progresión de carga máxima ({rangeLabel})</Text>
                  </View>
                  <Pressable onPress={onClearSelectedExercise} style={styles.closeSelectedBtn}>
                    <Ionicons name="close" size={14} color={C.sub} />
                  </Pressable>
                </View>

                {historyData.length < 2 ? (
                  <View style={styles.emptyHistoryBox}>
                    <Ionicons name="stats-chart-outline" size={28} color={C.subMuted} />
                    <Text style={styles.emptyHistoryText}>
                      {historyData.length === 1
                        ? `1 registro guardado (${historyData[0].maxWeight} kg). Registra otro día para ver la curva.`
                        : 'Aún no hay registros en este rango para graficar.'}
                    </Text>
                  </View>
                ) : (
                  <WorkoutHistorySVGChart data={historyData} />
                )}
              </View>
            ) : (
              /* CARRUSEL DE ESTADÍSTICAS ROTATIVAS ANIMADAS AUTOMÁTICAS */
              <Animated.View style={[{ alignItems: 'center', justifyContent: 'center', flex: 1 }, { opacity: statFadeAnim }]}>
                {autoRotateStats[statIndex] && (
                  <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
                    <View style={styles.statOrbGlow}>
                      <Ionicons name={autoRotateStats[statIndex].icon} size={28} color={C.pastelPurple} />
                    </View>
                    <Text style={styles.rotStatTitle}>{autoRotateStats[statIndex].title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginVertical: 4 }}>
                      <Text style={styles.rotStatBigValue}>{autoRotateStats[statIndex].value}</Text>
                      <Text style={styles.rotStatUnit}>{autoRotateStats[statIndex].unit}</Text>
                    </View>
                    <Text style={styles.rotStatSubtitle}>{autoRotateStats[statIndex].subtitle}</Text>
                    <Text style={styles.rotHintText}>✦ Toca un ejercicio abajo para ver su curva detallada ✦</Text>
                  </View>
                )}
              </Animated.View>
            )}
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

/* ==========================================================
   GRÁFICA SVG HISTÓRICA DEL EJERCICIO SELECCIONADO
========================================================== */
function WorkoutHistorySVGChart({
  data,
}: {
  data: { dateStr: string; maxWeight: number; totalVolume: number }[];
}) {
  const width = Dimensions.get('window').width - 64;
  const height = 150;
  const paddingX = 20;
  const paddingY = 24;

  const weights = data.map((d) => d.maxWeight);
  const minW = Math.max(0, Math.min(...weights) - 5);
  const maxW = Math.max(...weights) + 5;
  const range = maxW - minW || 1;

  // Generación de coordenadas de puntos
  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((d.maxWeight - minW) / range) * (height - paddingY * 2);
    return { x, y, weight: d.maxWeight, date: d.dateStr.slice(5) };
  });

  // Generación del trazado SVG suave
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX1 = prev.x + (curr.x - prev.x) / 2;
    const cpX2 = prev.x + (curr.x - prev.x) / 2;
    pathD += ` C ${cpX1} ${prev.y}, ${cpX2} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const fillD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <View style={{ width, height, marginTop: 4 }}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.pastelPurple} stopOpacity="0.25" />
            <Stop offset="1" stopColor={C.pastelPurple} stopOpacity="0.01" />
          </SvgGradient>
        </Defs>

        {/* Línea base horizontal */}
        <Line x1={paddingX} y1={height - 18} x2={width - paddingX} y2={height - 18} stroke="rgba(203, 213, 225, 0.4)" strokeWidth={1} />

        {/* Área sombreada bajo la curva */}
        <Path d={fillD} fill="url(#curveFill)" />

        {/* Curva de progresión */}
        <Path d={pathD} fill="none" stroke={C.pastelPurple} strokeWidth={3} strokeLinecap="round" />

        {/* Puntos y etiquetas de peso */}
        {points.map((p, idx) => (
          <React.Fragment key={idx}>
            <Circle cx={p.x} cy={p.y} r={5} fill="#FFFFFF" stroke={C.pastelPurple} strokeWidth={2.5} />
            <Circle cx={p.x} cy={p.y} r={2} fill={C.pastelPurple} />
          </React.Fragment>
        ))}
      </Svg>

      {/* Etiquetas debajo de los puntos */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, marginTop: -14 }}>
        {points.map((p, idx) => (
          <View key={idx} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: C.text }}>{p.weight}kg</Text>
            <Text style={{ fontSize: 9, color: C.subMuted }}>{p.date}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ==========================================================
   OPCIÓN 1: REGISTRO DEL DÍA (Ejercicios, Series, Reps)
========================================================== */
function WorkoutDayLog({
  date,
  setDate,
  dayExercises,
  exercises,
  dayKey,
  onOpenExercisePicker,
}: {
  date: Date;
  setDate: (d: Date) => void;
  dayExercises: WorkoutExercise[];
  exercises: Exercise[];
  dayKey: string;
  onOpenExercisePicker: () => void;
}) {
  const { setDayWorkout } = useStore();

  const updateExercises = (newList: WorkoutExercise[]) => {
    setDayWorkout(dayKey, newList);
  };

  return (
    <View style={{ marginTop: 4 }}>
      {/* Selector de Fecha */}
      <DateSelector date={date} onChange={setDate} />

      {/* Empty State si no hay ejercicios */}
      {dayExercises.length === 0 && (
        <View style={styles.emptyWorkoutCard}>
          <LinearGradient colors={['#FFFFFF', '#F8FAFF']} style={styles.emptyWorkoutGradient}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="barbell-outline" size={32} color={C.pastelPurple} />
            </View>
            <Text style={styles.emptyWorkoutTitle}>Sin ejercicios en este día</Text>
            <Text style={styles.emptyWorkoutSubtitle}>
              Toca en "Agregar ejercicio" para registrar tus series, pesos y repeticiones.
            </Text>
          </LinearGradient>
        </View>
      )}

      {/* Tarjetas de Ejercicios del Día */}
      {dayExercises.map((we, index) => {
        const ex = exercises.find((e) => e.id === we.exerciseId);
        const exName = ex?.name || 'Ejercicio';
        const exGroup = ex?.muscleGroup || 'General';

        const updateSets = (newSets: WorkoutSet[]) => {
          updateExercises(dayExercises.map((x) => (x.id === we.id ? { ...x, sets: newSets } : x)));
        };

        const deleteExerciseFromDay = () => {
          updateExercises(dayExercises.filter((x) => x.id !== we.id));
        };

        const totalVol = we.sets.reduce((acc, s) => acc + (s.weight || 0) * (s.reps || 0), 0);

        return (
          <View key={we.id} style={styles.workoutExerciseCard}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFF']} style={{ padding: 16 }}>
              {/* Barra lateral de acento */}
              <View style={styles.exerciseAccentBar} />

              {/* Cabecera del Ejercicio */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, paddingLeft: 6 }}>
                  <Text style={styles.exerciseTitleText}>{exName}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <View style={styles.muscleBadge}>
                      <Text style={styles.muscleBadgeText}>{exGroup}</Text>
                    </View>
                    <Text style={styles.volumeMiniText}>Volumen: {Math.round(totalVol)} kg</Text>
                  </View>
                </View>

                <Pressable onPress={deleteExerciseFromDay} hitSlop={10} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={18} color={C.danger} />
                </Pressable>
              </View>

              {/* Encabezados de la Tabla de Series */}
              <View style={styles.setTableHeadersRow}>
                <Text style={[styles.setTableHeaderText, { width: 44 }]}>SET</Text>
                <Text style={[styles.setTableHeaderText, { flex: 1, textAlign: 'center' }]}>PESO (KG)</Text>
                <Text style={[styles.setTableHeaderText, { flex: 1, textAlign: 'center' }]}>REPS</Text>
                <View style={{ width: 34 }} />
              </View>

              {/* Filas de Series */}
              {we.sets.map((set, setIdx) => (
                <View key={set.id} style={styles.setRowContainer}>
                  <View style={styles.setNumberBadge}>
                    <Text style={styles.setNumberText}>{setIdx + 1}</Text>
                  </View>

                  {/* Input de Peso */}
                  <View style={styles.setInputBox}>
                    <TextInput
                      value={set.weight ? String(set.weight) : ''}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={C.subMuted}
                      style={styles.setTextInput}
                      onChangeText={(t) => {
                        const val = parseFloat(t.replace(',', '.')) || 0;
                        updateSets(we.sets.map((s) => (s.id === set.id ? { ...s, weight: val } : s)));
                      }}
                    />
                    <Text style={styles.setUnitLabel}>kg</Text>
                  </View>

                  {/* Input de Repeticiones */}
                  <View style={styles.setInputBox}>
                    <TextInput
                      value={set.reps ? String(set.reps) : ''}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={C.subMuted}
                      style={styles.setTextInput}
                      onChangeText={(t) => {
                        const val = parseInt(t) || 0;
                        updateSets(we.sets.map((s) => (s.id === set.id ? { ...s, reps: val } : s)));
                      }}
                    />
                    <Text style={styles.setUnitLabel}>reps</Text>
                  </View>

                  {/* Botón eliminar serie */}
                  <Pressable
                    onPress={() => updateSets(we.sets.filter((s) => s.id !== set.id))}
                    hitSlop={8}
                    style={{ width: 34, alignItems: 'center' }}
                  >
                    <Ionicons name="close-circle-outline" size={19} color={C.danger} />
                  </Pressable>
                </View>
              ))}

              {/* Botón para agregar una nueva serie */}
              <Pressable
                onPress={() => {
                  const lastSet = we.sets[we.sets.length - 1];
                  const newSet: WorkoutSet = {
                    id: uid(),
                    weight: lastSet ? lastSet.weight : 20,
                    reps: lastSet ? lastSet.reps : 10,
                  };
                  updateSets([...we.sets, newSet]);
                }}
                style={({ pressed }) => [styles.addSetDashedBtn, pressed && s.btnPressed]}
              >
                <Ionicons name="add" size={16} color={C.pastelPurple} />
                <Text style={styles.addSetDashedText}>+ Agregar serie</Text>
              </Pressable>
            </LinearGradient>
          </View>
        );
      })}

      {/* Botón Principal para Agregar Ejercicio */}
      <View style={{ marginTop: 6 }}>
        <PrimaryButton icon="add-circle" label="Agregar ejercicio" onPress={onOpenExercisePicker} />
      </View>
    </View>
  );
}

/* ==========================================================
   OPCIÓN 2: ESTADÍSTICAS Y BIBLIOTECA DE EJERCICIOS
========================================================== */
function WorkoutStatsLibrary({
  exercises,
  workoutLogs,
  selectedExerciseId,
  onSelectExercise,
  onOpenCreateModal,
  onEditExercise,
}: {
  exercises: Exercise[];
  workoutLogs: Record<string, WorkoutExercise[]>;
  selectedExerciseId: string | null;
  onSelectExercise: (id: string) => void;
  onOpenCreateModal: () => void;
  onEditExercise: (ex: Exercise) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('Todos');

  // Cálculo de estadísticas por ejercicio
  const exerciseStatsMap = useMemo(() => {
    const stats: Record<string, { maxWeight: number; totalSets: number; lastDate: string }> = {};

    Object.entries(workoutLogs).forEach(([dateStr, weList]) => {
      weList.forEach((we) => {
        if (!stats[we.exerciseId]) {
          stats[we.exerciseId] = { maxWeight: 0, totalSets: 0, lastDate: dateStr };
        }
        stats[we.exerciseId].totalSets += we.sets.length;
        we.sets.forEach((s) => {
          if (s.weight > stats[we.exerciseId].maxWeight) {
            stats[we.exerciseId].maxWeight = s.weight;
          }
        });
        stats[we.exerciseId].lastDate = dateStr;
      });
    });

    return stats;
  }, [workoutLogs]);

  const filtered = useMemo(() => {
    return exercises
      .filter((e) => {
        const matchesQuery = e.name.toLowerCase().includes(query.toLowerCase());
        const matchesGroup = selectedGroup === 'Todos' || e.muscleGroup === selectedGroup;
        return matchesQuery && matchesGroup;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, query, selectedGroup]);

  return (
    <View style={{ marginTop: 6 }}>
      {/* Buscador y Botón Crear Ejercicio */}
      <View style={styles.searchAddRow}>
        <View style={styles.searchBoxGlass}>
          <Ionicons name="search" size={17} color={C.pastelPurple} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar ejercicio para estadísticas..."
            placeholderTextColor={C.subMuted}
            style={styles.searchTextInput}
            clearButtonMode="while-editing"
          />
          {query.length > 0 && Platform.OS !== 'ios' && (
            <Pressable onPress={() => setQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={16} color={C.sub} />
            </Pressable>
          )}
          <Pressable onPress={() => Keyboard.dismiss()} style={{ padding: 4 }}>
            <Ionicons name="chevron-down-circle-outline" size={18} color={C.pastelPurple} />
          </Pressable>
        </View>

        <Pressable onPress={onOpenCreateModal} style={({ pressed }) => [styles.addSquareBtn, pressed && s.btnPressed]}>
          <LinearGradient colors={GRADIENTS.primary} style={styles.addSquareGradient}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>

      {/* Filtro horizontal por Grupo Muscular */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
        {MUSCLE_GROUPS.map((g) => {
          const active = selectedGroup === g;
          return (
            <Pressable
              key={g}
              onPress={() => setSelectedGroup(g)}
              style={[styles.filterGroupPill, active && styles.filterGroupPillActive]}
            >
              <Text style={[styles.filterGroupText, active && styles.filterGroupTextActive]}>{g}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Contador y Consejo */}
      <View style={styles.countBadgeRow}>
        <Text style={styles.countBadgeText}>✦ TOCA UN EJERCICIO PARA GRAFICAR SU PROGRESO ✦</Text>
      </View>

      {/* Lista de Ejercicios */}
      {filtered.map((ex) => {
        const isSelected = selectedExerciseId === ex.id;
        const st = exerciseStatsMap[ex.id];

        return (
          <Pressable
            key={ex.id}
            onPress={() => onSelectExercise(ex.id)}
            style={({ pressed }) => [
              styles.exerciseItemCard,
              isSelected && styles.exerciseItemCardSelected,
              pressed && s.btnPressed,
            ]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.exerciseItemName, isSelected && { color: C.pastelPurple }]}>{ex.name}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={16} color={C.pastelPurple} />}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <View style={styles.muscleBadge}>
                    <Text style={styles.muscleBadgeText}>{ex.muscleGroup}</Text>
                  </View>
                  <Text style={styles.statsMiniText}>
                    {st ? `PR: ${st.maxWeight} kg  •  ${st.totalSets} series` : 'Sin entrenamientos registrados'}
                  </Text>
                </View>
              </View>

              <Pressable onPress={() => onEditExercise(ex)} hitSlop={10} style={{ padding: 6 }}>
                <Ionicons name="pencil-outline" size={16} color={C.subMuted} />
              </Pressable>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ==========================================================
   SELECTOR MAESTRO DE NAVEGACIÓN EN ENTRENAMIENTO
========================================================== */
function TrainNavigationSegmented({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  const options = [
    { label: 'Registrar entrenamiento', icon: 'barbell-outline' },
    { label: 'Estadísticas', icon: 'stats-chart-outline' },
  ];

  const [containerWidth, setContainerWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: value, friction: 8, tension: 65, useNativeDriver: true }).start();
  }, [value]);

  const pillWidth = containerWidth > 0 ? (containerWidth - 8) / 2 : 0;
  const translateX = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [4, pillWidth + 4] });

  return (
    <View style={s.mainSegmentedContainer} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {containerWidth > 0 && (
        <Animated.View style={[s.slidingPill, { width: pillWidth, transform: [{ translateX }] }]}>
          <LinearGradient colors={['#8B5CF6', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.slidingPillGradient} />
        </Animated.View>
      )}

      {options.map((opt, i) => {
        const active = value === i;
        return (
          <Pressable key={opt.label} onPress={() => onChange(i)} style={s.mainSegmentedBtn}>
            <Ionicons name={opt.icon as any} size={16} color={active ? '#FFFFFF' : C.sub} style={{ marginRight: 6 }} />
            <Text style={[s.mainSegmentedText, active ? s.mainSegmentedTextActive : s.mainSegmentedTextInactive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ==========================================================
   MODAL DE BÚSQUEDA DE EJERCICIOS (SEGURO CONTRA TECLADO)
========================================================== */
function ExercisePickerModal({
  visible,
  exercises,
  onSelect,
  onClose,
  onCreateNew,
}: {
  visible: boolean;
  exercises: Exercise[];
  onSelect: (ex: Exercise) => void;
  onClose: () => void;
  onCreateNew: (name: string) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return exercises;
    return exercises.filter((e) => e.name.toLowerCase().includes(query.toLowerCase().trim()));
  }, [exercises, query]);

  const exactMatch = exercises.some((e) => e.name.toLowerCase().trim() === query.toLowerCase().trim());

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.pickerSheetContainer}>
          <View style={s.pickerSheetContent}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFF']} style={{ flex: 1 }}>
              <View style={s.sheetHandleBar} />
              <View style={s.sheetHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={s.hudIconOrb}>
                    <Ionicons name="barbell" size={16} color={C.pastelPurple} />
                  </View>
                  <View>
                    <Text style={s.sheetTitle}>SELECCIONAR EJERCICIO</Text>
                    <Text style={s.sheetSubtitle}>Elige un ejercicio para tu entrenamiento</Text>
                  </View>
                </View>
                <Pressable onPress={onClose} style={({ pressed }) => [s.sheetCloseBtn, pressed && s.btnPressed]}>
                  <Ionicons name="close" size={20} color={C.sub} />
                </Pressable>
              </View>

              <View style={s.searchBarContainer}>
                <Ionicons name="search" size={18} color={C.pastelPurple} style={{ marginLeft: 12 }} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar o escribir nombre del ejercicio..."
                  placeholderTextColor={C.subMuted}
                  style={s.searchInput}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </View>

              {query.trim().length > 0 && !exactMatch && (
                <Pressable
                  onPress={() => {
                    onCreateNew(query.trim());
                    onClose();
                  }}
                  style={({ pressed }) => [s.quickCreateCard, pressed && s.btnPressed]}
                >
                  <LinearGradient colors={['rgba(167, 139, 250, 0.15)', 'rgba(244, 114, 182, 0.15)']} style={s.quickCreateGradient}>
                    <Ionicons name="add-circle" size={20} color={C.pastelPurple} />
                    <Text style={s.quickCreateText}>
                      Crear nuevo ejercicio: <Text style={{ color: C.text, fontWeight: '800' }}>"{query.trim()}"</Text>
                    </Text>
                  </LinearGradient>
                </Pressable>
              )}

              <FlatList<Exercise>
                data={filtered}
                keyExtractor={(item: Exercise) => item.id}
                keyboardShouldPersistTaps="always"
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 36 }}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                renderItem={({ item }: { item: Exercise }) => (
                  <Pressable
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                    style={({ pressed }) => [s.ingredientItemCard, pressed && s.btnPressed]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={s.ingredientItemName}>{item.name}</Text>
                      <View style={styles.muscleBadge}>
                        <Text style={styles.muscleBadgeText}>{item.muscleGroup}</Text>
                      </View>
                    </View>
                  </Pressable>
                )}
              />
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ==========================================================
   MODAL PARA CREAR O EDITAR EJERCICIO
========================================================== */
function ExerciseFormModal({
  exercise,
  onSave,
  onClose,
}: {
  exercise: Exercise;
  onSave: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(exercise.name);
  const [muscleGroup, setMuscleGroup] = useState(exercise.muscleGroup || 'Pecho');

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.formModalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.formModalSheetContainer}>
          <View style={styles.formModalSheetContent}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFF']} style={{ padding: 20 }}>
              <View style={styles.sheetHandleBar} />
              <View style={styles.formHeaderRow}>
                <View>
                  <Text style={styles.formTitle}>{exercise.name ? 'EDITAR EJERCICIO' : 'NUEVO EJERCICIO'}</Text>
                  <Text style={styles.formSubtitle}>Configura el nombre y grupo muscular</Text>
                </View>
                <Pressable onPress={onClose} style={styles.sheetCloseMiniBtn}>
                  <Ionicons name="close" size={20} color={C.text} />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Nombre del ejercicio</Text>
              <View style={[styles.fieldInputBox, { marginBottom: 14 }]}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Ej. Press Militar con Barra..."
                  placeholderTextColor={C.subMuted}
                  style={styles.fieldTextInput}
                />
              </View>

              <Text style={styles.fieldLabel}>Grupo muscular principal</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4, marginBottom: 20 }}>
                {MUSCLE_GROUPS.filter((g) => g !== 'Todos').map((g) => {
                  const active = muscleGroup === g;
                  return (
                    <Pressable
                      key={g}
                      onPress={() => setMuscleGroup(g)}
                      style={[styles.filterGroupPill, active && styles.filterGroupPillActive]}
                    >
                      <Text style={[styles.filterGroupText, active && styles.filterGroupTextActive]}>{g}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <PrimaryButton
                icon="checkmark-circle"
                label="Guardar ejercicio"
                onPress={() => {
                  if (!name.trim()) {
                    Alert.alert('Nombre requerido', 'Ingresa un nombre para el ejercicio.');
                    return;
                  }
                  onSave({ id: exercise.id, name: name.trim(), muscleGroup });
                }}
              />
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ==========================================================
   MODAL DE RANGO DE FECHAS PARA ESTADÍSTICAS
========================================================== */
function RangeFilterModal({
  visible,
  currentDays,
  onClose,
  onSelectRange,
}: {
  visible: boolean;
  currentDays: number | null;
  onClose: () => void;
  onSelectRange: (days: number | null) => void;
}) {
  const options = [
    { label: 'Últimos 7 días', days: 7 },
    { label: 'Últimos 30 días (1 mes)', days: 30 },
    { label: 'Últimos 90 días (3 meses)', days: 90 },
    { label: 'Todo el historial completo', days: null },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.rangeModalCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>FILTRAR RANGO DE TIEMPO</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color={C.sub} />
            </Pressable>
          </View>

          {options.map((opt) => {
            const active = currentDays === opt.days;
            return (
              <Pressable
                key={opt.label}
                onPress={() => onSelectRange(opt.days)}
                style={[styles.rangeOptionRow, active && styles.rangeOptionRowActive]}
              >
                <Text style={[styles.rangeOptionText, active && styles.rangeOptionTextActive]}>{opt.label}</Text>
                {active && <Ionicons name="checkmark-circle" size={18} color={C.pastelPurple} />}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ==========================================================
   ESTILOS ESPECÍFICOS DE ENTRENAMIENTO
========================================================== */
const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 130,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  cyberTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  cyberTagText: {
    color: C.pastelPurple,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  screenTitle: {
    color: C.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  dateChipMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
    marginTop: 6,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  dateChipMiniText: {
    color: C.textSub,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Gráfica
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rangePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.borderPastelPurple,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  rangePickerBtnText: {
    color: C.pastelPurple,
    fontSize: 11,
    fontWeight: '800',
  },

  // Medidor circular de volumen
  dayWorkoutSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  workoutVolRingContainer: {
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutVolNumber: {
    color: C.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  workoutVolUnit: {
    color: C.pastelPurple,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  metricPillCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  metricPillLabel: {
    color: C.sub,
    fontSize: 11.5,
    fontWeight: '600',
  },
  metricPillValue: {
    color: C.pastelPurple,
    fontSize: 12.5,
    fontWeight: '800',
  },

  // Estadísticas rotativas
  statOrbGlow: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  rotStatTitle: {
    color: C.pastelPurple,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  rotStatBigValue: {
    color: C.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  rotStatUnit: {
    color: C.pastelPink,
    fontSize: 13,
    fontWeight: '800',
  },
  rotStatSubtitle: {
    color: C.sub,
    fontSize: 12,
    textAlign: 'center',
  },
  rotHintText: {
    color: C.subMuted,
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 8,
  },

  // Ejercicio seleccionado en gráfica
  selectedExerciseNameHeader: {
    color: C.text,
    fontSize: 15,
    fontWeight: '800',
  },
  selectedExerciseSub: {
    color: C.sub,
    fontSize: 11,
  },
  closeSelectedBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(203, 213, 225, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyHistoryText: {
    color: C.sub,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 240,
  },

  // Empty state Día
  emptyWorkoutCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderLight,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyWorkoutGradient: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    marginBottom: 12,
  },
  emptyWorkoutTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyWorkoutSubtitle: {
    color: C.sub,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  // Tarjeta de Ejercicio en Día
  workoutExerciseCard: {
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  exerciseAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: C.pastelPurple,
  },
  exerciseTitleText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '800',
  },
  muscleBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  muscleBadgeText: {
    color: C.pastelPurple,
    fontSize: 11,
    fontWeight: '700',
  },
  volumeMiniText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '600',
  },

  // Tabla de Series
  setTableHeadersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 6,
  },
  setTableHeaderText: {
    color: C.subMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  setRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.6)',
  },
  setNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  setNumberText: {
    color: C.pastelPurple,
    fontSize: 12,
    fontWeight: '800',
  },
  setInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
    paddingHorizontal: 8,
    marginHorizontal: 4,
  },
  setTextInput: {
    color: C.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 6,
    minWidth: 36,
  },
  setUnitLabel: {
    color: C.subMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  addSetDashedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    backgroundColor: 'rgba(139, 92, 246, 0.04)',
    gap: 4,
  },
  addSetDashedText: {
    color: C.pastelPurple,
    fontSize: 12,
    fontWeight: '700',
  },

  // Biblioteca de Ejercicios
  searchAddRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  searchBoxGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    gap: 8,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchTextInput: {
    flex: 1,
    color: C.text,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  addSquareBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  addSquareGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterGroupPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  filterGroupPillActive: {
    backgroundColor: C.pastelPurple,
    borderColor: C.pastelPurple,
  },
  filterGroupText: {
    color: C.sub,
    fontSize: 12,
    fontWeight: '700',
  },
  filterGroupTextActive: {
    color: '#FFFFFF',
  },
  countBadgeRow: {
    marginVertical: 10,
  },
  countBadgeText: {
    color: C.subMuted,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  exerciseItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  exerciseItemCardSelected: {
    borderColor: C.pastelPurple,
    borderWidth: 2,
    backgroundColor: '#F8F7FF',
  },
  exerciseItemName: {
    color: C.text,
    fontSize: 15,
    fontWeight: '800',
  },
  statsMiniText: {
    color: C.sub,
    fontSize: 11.5,
    fontWeight: '600',
  },

  // Modales
  formModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  formModalSheetContainer: {
    width: '100%',
  },
  formModalSheetContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderPastelPurple,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetHandleBar: {
    width: 38,
    height: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  formTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  formSubtitle: {
    color: C.sub,
    fontSize: 12,
    marginTop: 2,
  },
  sheetCloseMiniBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    color: C.sub,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  fieldInputBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    paddingHorizontal: 12,
  },
  fieldTextInput: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 9,
  },
  rangeModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: C.borderPastelPurple,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 10,
  },
  rangeOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.6)',
  },
  rangeOptionRowActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  rangeOptionText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rangeOptionTextActive: {
    color: C.pastelPurple,
    fontWeight: '800',
  },
});
