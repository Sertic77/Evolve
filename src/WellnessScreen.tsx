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
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop, Line, Text as SvgText, Rect, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, GRADIENTS, registerThemeSheet, getPaletteColorWithAlpha } from './theme';
import { DateSelector, PrimaryButton, s } from './components';
import {
  useStore,
  dateKey,
  Supplement,
  isSupplementActiveOnDate,
  HealthMetricDefinition,
  HealthLogEntry,
  uid,
  SEED_HEALTH_METRICS,
  SEED_HEALTH_LOGS,
  getActivePalette,
  getFontFamily,
  SleepLogEntry,
  SEED_SLEEP_LOGS,
  ColorPalette,
} from './store';
import {
  formatAlarmTime12h,
  parseAlarmTime,
  toAlarmTime24h,
  scheduleSupplementDailyAlarm,
  cancelSupplementDailyAlarm,
} from './notifications';
import {
  ALARM_SOUNDS,
  getAlarmSoundById,
  playAlarmSound,
  stopAlarmSound,
  previewAlarmSound,
} from './audioSounds';
import * as Notifications from 'expo-notifications';

function parseDateKey(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/* ==========================================================
   PANTALLA PRINCIPAL: SECCIÓN BIENESTAR (SUEÑO Y SUPLEMENTOS)
========================================================== */
export default function WellnessScreen() {
  // 0: Sueño, 1: Suplementos, 2: Salud
  const [tab, setTab] = useState<number>(0);
  const [date, setDate] = useState<Date>(new Date());
  const key = dateKey(date);

  const {
    supplements,
    supplementLogs,
    addSupplement,
    updateSupplement,
    deleteSupplement,
    setSupplementAlarm,
    toggleSupplementDose,
    sleepLogs,
    setSleepLog,
    syncWatchData,
    activePaletteId,
    customPalettes,
    typography,
  } = useStore();

  const palette = getActivePalette({ activePaletteId, customPalettes });
  const titleFont = getFontFamily(typography?.titles || 'system');
  const subtitleFont = getFontFamily(typography?.subtitles || 'system');
  const bodyFont = getFontFamily(typography?.body || 'system');
  const dataFont = getFontFamily(typography?.data || 'system');

  // Estado para Smartband & Sueño
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const syncSpinAnim = useRef(new Animated.Value(0)).current;
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Modal para Ajuste Manual de Sueño & Calorías
  const [editSleepModalOpen, setEditSleepModalOpen] = useState<boolean>(false);
  const [formSleepHours, setFormSleepHours] = useState<string>('7');
  const [formSleepMinutes, setFormSleepMinutes] = useState<string>('45');
  const [formBedtime, setFormBedtime] = useState<string>('23:15');
  const [formWakeTime, setFormWakeTime] = useState<string>('07:00');
  const [formBurnedCalories, setFormBurnedCalories] = useState<string>('520');
  const [formSteps, setFormSteps] = useState<string>('8430');
  const [formHeartRate, setFormHeartRate] = useState<string>('58');

  const todayKey = dateKey(new Date());
  const isFutureDate = key > todayKey;
  const isToday = key === todayKey;

  // Obtenemos los datos de sueño de la fecha seleccionada (nunca para fechas futuras)
  const rawSleepLog: SleepLogEntry | undefined = isFutureDate
    ? undefined
    : (sleepLogs && sleepLogs[key]) || SEED_SLEEP_LOGS[key];

  const hasDataForDate = !isFutureDate && !!rawSleepLog && (rawSleepLog.hours > 0 || (rawSleepLog.activeCaloriesBurned ?? 0) > 0);

  const currentSleep: SleepLogEntry = rawSleepLog || {
    hours: 0,
    minutes: 0,
    bedtime: '--:--',
    wakeTime: '--:--',
    deepSleepHours: 0,
    lightSleepHours: 0,
    remSleepHours: 0,
    awakeMinutes: 0,
    sleepScore: 0,
    activeCaloriesBurned: 0,
    steps: 0,
    restingHeartRate: 0,
    syncedFromDevice: false,
    deviceName: 'Xiaomi Smart Band (Apple Health)',
    source: 'manual',
    lastSyncedAt: undefined,
    qualityNote: isFutureDate
      ? 'Fecha futura: aún no se registran datos de descanso ni actividad.'
      : 'Sin datos registrados para esta fecha.',
  };

  const totalSleepMinutes = currentSleep.hours * 60 + currentSleep.minutes;
  const deepMinutes = Math.round((currentSleep.deepSleepHours || 0) * 60);
  const lightMinutes = Math.round((currentSleep.lightSleepHours || 0) * 60);
  const remMinutes = Math.round((currentSleep.remSleepHours || 0) * 60);
  const awakeMins = currentSleep.awakeMinutes || 0;
  const totalPhaseMinutes = Math.max(1, deepMinutes + lightMinutes + remMinutes + awakeMins);

  const deepPct = hasDataForDate ? Math.round((deepMinutes / totalPhaseMinutes) * 100) : 0;
  const lightPct = hasDataForDate ? Math.round((lightMinutes / totalPhaseMinutes) * 100) : 0;
  const remPct = hasDataForDate ? Math.round((remMinutes / totalPhaseMinutes) * 100) : 0;
  const awakePct = hasDataForDate ? Math.max(0, 100 - (deepPct + lightPct + remPct)) : 0;

  const spinInterpolate = syncSpinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleSyncSmartband = () => {
    if (isFutureDate) {
      Alert.alert('Fecha Futura', 'No es posible sincronizar datos para una fecha que aún no ha ocurrido.');
      return;
    }
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncFeedback(null);

    syncSpinAnim.setValue(0);
    const spinLoop = Animated.loop(
      Animated.timing(syncSpinAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinLoop.start();

    setTimeout(() => {
      spinLoop.stop();
      syncSpinAnim.setValue(0);
      setIsSyncing(false);

      // Si ya existen datos guardados por el usuario para hoy, preservamos sus valores exactos
      const existing = (sleepLogs && sleepLogs[key]) || SEED_SLEEP_LOGS[key];
      const hours = existing?.hours ?? 7;
      const minutes = existing?.minutes ?? 45;
      const calories = existing?.activeCaloriesBurned ?? 520;
      const steps = existing?.steps ?? 8430;
      const hr = existing?.restingHeartRate ?? 58;

      syncWatchData(key, {
        hours,
        minutes,
        activeCaloriesBurned: calories,
        steps,
        restingHeartRate: hr,
        sleepScore: existing?.sleepScore || 88,
        deepSleepHours: existing?.deepSleepHours || 1.8,
        lightSleepHours: existing?.lightSleepHours || 4.4,
        remSleepHours: existing?.remSleepHours || 1.5,
        awakeMinutes: existing?.awakeMinutes || 18,
        qualityNote: existing?.qualityNote || 'Recuperación física óptima y ciclo de sueño profundo regular.',
      });

      setSyncFeedback(
        `✓ Smartband sincronizada vía Apple Health: ${hours}h ${minutes}m de descanso y ${calories} kcal quemadas hoy.`,
      );

      setTimeout(() => {
        setSyncFeedback(null);
      }, 5000);
    }, 1100);
  };

  const openEditSleepModal = () => {
    if (isFutureDate) {
      Alert.alert('Fecha Futura', 'No se pueden registrar datos de sueño ni calorías para una fecha futura.');
      return;
    }
    const log = rawSleepLog || {
      hours: 7,
      minutes: 45,
      bedtime: '23:15',
      wakeTime: '07:00',
      activeCaloriesBurned: 520,
      steps: 8430,
      restingHeartRate: 58,
    };
    setFormSleepHours(String(log.hours || ''));
    setFormSleepMinutes(String(log.minutes || ''));
    setFormBedtime(log.bedtime && log.bedtime !== '--:--' ? log.bedtime : '23:15');
    setFormWakeTime(log.wakeTime && log.wakeTime !== '--:--' ? log.wakeTime : '07:00');
    setFormBurnedCalories(String(log.activeCaloriesBurned || ''));
    setFormSteps(String(log.steps || ''));
    setFormHeartRate(String(log.restingHeartRate || ''));
    setEditSleepModalOpen(true);
  };

  const handleSaveManualSleep = () => {
    if (isFutureDate) {
      Alert.alert('Fecha Futura', 'No se pueden registrar datos para una fecha futura.');
      return;
    }
    const h = Math.max(0, Math.min(24, parseInt(formSleepHours, 10) || 0));
    const m = Math.max(0, Math.min(59, parseInt(formSleepMinutes, 10) || 0));
    const cal = Math.max(0, parseInt(formBurnedCalories, 10) || 0);
    const steps = Math.max(0, parseInt(formSteps, 10) || 0);
    const hr = Math.max(30, Math.min(220, parseInt(formHeartRate, 10) || 60));

    const totalH = h + m / 60;
    const deep = +(totalH * 0.23).toFixed(1);
    const rem = +(totalH * 0.20).toFixed(1);
    const light = +(totalH * 0.57).toFixed(1);
    const score = totalH > 0 ? Math.min(100, Math.round((totalH / 8) * 85) + 15) : 0;

    const now = new Date();
    const hours12 = now.getHours() % 12 || 12;
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    const timeStr = `Hoy, ${String(hours12).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${ampm}`;

    setSleepLog(key, {
      hours: h,
      minutes: m,
      bedtime: formBedtime.trim() || '23:15',
      wakeTime: formWakeTime.trim() || '07:00',
      deepSleepHours: deep,
      lightSleepHours: light,
      remSleepHours: rem,
      awakeMinutes: 15,
      sleepScore: score,
      activeCaloriesBurned: cal,
      steps,
      restingHeartRate: hr,
      syncedFromDevice: true,
      deviceName: 'Xiaomi Smart Band (Apple Health)',
      source: 'apple_health',
      lastSyncedAt: timeStr,
      qualityNote: 'Datos sincronizados con los valores de tu Smartband / Apple Health.',
    });

    setEditSleepModalOpen(false);
    setSyncFeedback(`✓ Datos de Smartband guardados: ${h}h ${m}m y ${cal} kcal activas.`);
    setTimeout(() => setSyncFeedback(null), 4000);
  };


  const daySupplementChecks = supplementLogs[key] || {};

  // Modo edición para modificar cantidades (- / +) o quitar suplementos rápidamente
  const [isEditingList, setIsEditingList] = useState<boolean>(false);

  // Modal para agregar un nuevo suplemento o editar uno existente
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingSupplement, setEditingSupplement] = useState<Supplement | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formTarget, setFormTarget] = useState<number>(1);

  // Modal para programar alarma diaria de un suplemento
  const [alarmModalSupp, setAlarmModalSupp] = useState<Supplement | null>(null);
  const [alarmHour12, setAlarmHour12] = useState<number>(8);
  const [alarmMinute, setAlarmMinute] = useState<number>(0);
  const [alarmHourText, setAlarmHourText] = useState<string>('08');
  const [alarmMinuteText, setAlarmMinuteText] = useState<string>('00');
  const [alarmPeriod, setAlarmPeriod] = useState<'AM' | 'PM'>('AM');
  const [selectedSoundId, setSelectedSoundId] = useState<string>('alarma-clasica');
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const [savingAlarm, setSavingAlarm] = useState<boolean>(false);

  // Alarma sonando en tiempo real (In-app ringing alert)
  const [ringingAlarmSupp, setRingingAlarmSupp] = useState<Supplement | null>(null);
  const [ringingSoundId, setRingingSoundId] = useState<string>('alarma-clasica');

  // Animación de transición entre Sueño y Suplementos
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

  // Listener para cuando una notificación de alarma se dispara
  useEffect(() => {
    let sub: any = null;
    if (Platform.OS !== 'web') {
      try {
        sub = Notifications.addNotificationReceivedListener((notification) => {
          const suppId = notification.request.content.data?.supplementId as string | undefined;
          const sId = notification.request.content.data?.soundId as string | undefined;
          if (suppId) {
            const supp = supplements.find((item) => item.id === suppId);
            if (supp) {
              triggerAlarmRinging(supp, sId || supp.alarmSound || 'alarma-clasica');
            }
          }
        });
      } catch {}
    }
    return () => {
      if (sub && sub.remove) sub.remove();
      void stopAlarmSound();
    };
  }, [supplements]);

  // Suplementos activos para la fecha seleccionada en el calendario
  const activeSupplements = supplements.filter((item) => isSupplementActiveOnDate(item, key));

  // Cálculo del progreso total del día en suplementos
  const totalDosesToday = activeSupplements.reduce((acc, item) => acc + item.dailyTarget, 0);
  const completedDosesToday = activeSupplements.reduce((acc, item) => {
    const checks = daySupplementChecks[item.id] || [];
    let count = 0;
    for (let i = 0; i < item.dailyTarget; i++) {
      if (checks[i]) count++;
    }
    return acc + count;
  }, 0);
  const progressPct =
    totalDosesToday > 0 ? Math.round((completedDosesToday / totalDosesToday) * 100) : 0;
  const allCompletedToday = totalDosesToday > 0 && completedDosesToday === totalDosesToday;

  const openAddSupplementModal = () => {
    setEditingSupplement(null);
    setFormName('');
    setFormTarget(1);
    setModalOpen(true);
  };

  const openEditSupplementModal = (supp: Supplement) => {
    setEditingSupplement(supp);
    setFormName(supp.name);
    setFormTarget(supp.dailyTarget);
    setModalOpen(true);
  };

  const handleSaveSupplementModal = () => {
    const trimmed = formName.trim();
    if (!trimmed) {
      Alert.alert('Nombre requerido', 'Ingresa el nombre del suplemento.');
      return;
    }
    const cleanTarget = Math.max(1, Math.min(10, Math.round(formTarget || 1)));
    if (editingSupplement) {
      const prevAlarmTime = editingSupplement.alarmTime;
      const prevNotifId = editingSupplement.alarmNotificationId;
      const nameChanged = editingSupplement.name !== trimmed;

      updateSupplement(
        editingSupplement.id,
        {
          name: trimmed,
          dailyTarget: cleanTarget,
        },
        key,
      );

      if (prevAlarmTime && nameChanged) {
        const activeUpdated = useStore
          .getState()
          .supplements.find(
            (item) =>
              isSupplementActiveOnDate(item, key) &&
              item.name === trimmed &&
              item.alarmTime === prevAlarmTime,
          );
        if (activeUpdated) {
          const parsed = parseAlarmTime(prevAlarmTime);
          void scheduleSupplementDailyAlarm({
            supplementId: activeUpdated.id,
            supplementName: trimmed,
            hour: parsed.hour24,
            minute: parsed.minute,
            previousNotificationId: prevNotifId,
          }).then((res) => {
            setSupplementAlarm(activeUpdated.id, prevAlarmTime, res.notificationId);
          });
        }
      }
    } else {
      addSupplement(trimmed, cleanTarget, key);
    }
    setModalOpen(false);
  };

  const handleDeleteSupplement = (supp: Supplement) => {
    Alert.alert(
      'Quitar suplemento',
      `¿Deseas quitar "${supp.name}" de este día y los días futuros? Se mantendrá en el historial de los días pasados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: () => {
            if (supp.alarmNotificationId) {
              void cancelSupplementDailyAlarm(supp.alarmNotificationId);
            }
            deleteSupplement(supp.id, key);
          },
        },
      ]
    );
  };

  const openAlarmModal = (supp: Supplement) => {
    void stopAlarmSound();
    setPlayingPreviewId(null);
    const parsed = parseAlarmTime(supp.alarmTime);
    setAlarmModalSupp(supp);
    setAlarmHour12(parsed.hour12);
    setAlarmMinute(parsed.minute);
    setAlarmHourText(String(parsed.hour12).padStart(2, '0'));
    setAlarmMinuteText(String(parsed.minute).padStart(2, '0'));
    setAlarmPeriod(parsed.period);
    setSelectedSoundId(supp.alarmSound || 'alarma-clasica');
  };

  const closeAlarmModal = () => {
    void stopAlarmSound();
    setPlayingPreviewId(null);
    setAlarmModalSupp(null);
  };

  const handleToggleSoundPreview = async (soundId: string) => {
    if (playingPreviewId === soundId) {
      await stopAlarmSound();
      setPlayingPreviewId(null);
    } else {
      setSelectedSoundId(soundId);
      setPlayingPreviewId(soundId);
      await previewAlarmSound(soundId);
      setTimeout(() => {
        setPlayingPreviewId((curr) => (curr === soundId ? null : curr));
      }, 3500);
    }
  };

  const stepAlarmHour = (delta: number) => {
    setAlarmHour12((prev) => {
      const next = ((prev - 1 + delta + 12) % 12) + 1;
      setAlarmHourText(String(next).padStart(2, '0'));
      return next;
    });
  };

  const stepAlarmMinute = (delta: number) => {
    setAlarmMinute((prev) => {
      const next = (prev + delta + 60) % 60;
      setAlarmMinuteText(String(next).padStart(2, '0'));
      return next;
    });
  };

  const applyAlarmPreset = (h12: number, min: number, period: 'AM' | 'PM') => {
    setAlarmHour12(h12);
    setAlarmMinute(min);
    setAlarmHourText(String(h12).padStart(2, '0'));
    setAlarmMinuteText(String(min).padStart(2, '0'));
    setAlarmPeriod(period);
  };

  const handleSaveAlarm = async () => {
    if (!alarmModalSupp || savingAlarm) return;
    await stopAlarmSound();
    setPlayingPreviewId(null);

    const parsedH = parseInt(alarmHourText, 10);
    const parsedM = parseInt(alarmMinuteText, 10);
    const cleanH12 = Number.isFinite(parsedH) ? Math.max(1, Math.min(12, parsedH)) : alarmHour12;
    const cleanMin = Number.isFinite(parsedM) ? Math.max(0, Math.min(59, parsedM)) : alarmMinute;

    const { hhmm, hour24, minute } = toAlarmTime24h(cleanH12, cleanMin, alarmPeriod);
    setSavingAlarm(true);
    try {
      const result = await scheduleSupplementDailyAlarm({
        supplementId: alarmModalSupp.id,
        supplementName: alarmModalSupp.name,
        hour: hour24,
        minute,
        soundId: selectedSoundId,
        previousNotificationId: alarmModalSupp.alarmNotificationId,
      });

      if (result.permissionDenied) {
        Alert.alert(
          'Permiso de notificaciones',
          'Activa los permisos de notificaciones de Evolve en los ajustes de tu teléfono para que suene la alarma a la hora indicada.',
        );
      }

      setSupplementAlarm(alarmModalSupp.id, hhmm, result.notificationId, selectedSoundId);
      setAlarmModalSupp(null);
    } finally {
      setSavingAlarm(false);
    }
  };

  const handleDisableAlarm = async () => {
    if (!alarmModalSupp || savingAlarm) return;
    await stopAlarmSound();
    setPlayingPreviewId(null);
    setSavingAlarm(true);
    try {
      await cancelSupplementDailyAlarm(alarmModalSupp.alarmNotificationId);
      setSupplementAlarm(alarmModalSupp.id, undefined, undefined, undefined);
      setAlarmModalSupp(null);
    } finally {
      setSavingAlarm(false);
    }
  };

  // Disparar alarma sonando en pantalla con sonido continuo
  const triggerAlarmRinging = (supp: Supplement, soundId?: string) => {
    const tone = soundId || supp.alarmSound || 'alarma-clasica';
    setRingingAlarmSupp(supp);
    setRingingSoundId(tone);
    void playAlarmSound(tone, true);
  };

  const handleStopRingingAlarm = async () => {
    await stopAlarmSound();
    setRingingAlarmSupp(null);
  };

  const handleTakeDoseFromRingingAlarm = async () => {
    if (ringingAlarmSupp) {
      const currentChecks = daySupplementChecks[ringingAlarmSupp.id] || [];
      let targetIndex = -1;
      for (let i = 0; i < ringingAlarmSupp.dailyTarget; i++) {
        if (!currentChecks[i]) {
          targetIndex = i;
          break;
        }
      }
      if (targetIndex !== -1) {
        toggleSupplementDose(key, ringingAlarmSupp.id, targetIndex, ringingAlarmSupp.dailyTarget);
      }
    }
    await stopAlarmSound();
    setRingingAlarmSupp(null);
  };

  const handleTestAlarmNow = () => {
    if (!alarmModalSupp) return;
    const testSupp = { ...alarmModalSupp, alarmSound: selectedSoundId };
    void stopAlarmSound();
    setPlayingPreviewId(null);
    setAlarmModalSupp(null);
    triggerAlarmRinging(testSupp, selectedSoundId);
  };

  return (
    <View style={[wellnessStyles.rootContainer, { backgroundColor: palette.bg }]}>
      <ScrollView
        contentContainerStyle={wellnessStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[1]}
      >
        {/* Cabecera con Paleta Activa */}
        <View style={wellnessStyles.topHeader}>
          <View>
            <View style={wellnessStyles.cyberTagRow}>
              <Ionicons name="sparkles" size={11} color={palette.primary} />
              <Text style={[wellnessStyles.cyberTagText, { color: palette.primary, fontFamily: subtitleFont }]}>
                ✦ EVOLVE // SALUD & DESCANSO ✦
              </Text>
            </View>
            <Text style={[wellnessStyles.screenTitle, { color: palette.text, fontFamily: titleFont }]}>
              Bienestar
            </Text>
          </View>

          <View style={[wellnessStyles.headerBadgeMini, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
            <Ionicons
              name={tab === 0 ? 'moon-outline' : tab === 1 ? 'medkit-outline' : 'pulse-outline'}
              size={14}
              color={palette.primary}
            />
            <Text style={[wellnessStyles.headerBadgeMiniText, { color: palette.text, fontFamily: dataFont }]}>
              {date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* VARIANT SELECTOR CON TRES BOTONES: SUEÑO, SUPLEMENTOS Y SALUD (Sticky) */}
        <View style={wellnessStyles.stickyTabsContainer}>
          <WellnessModeSegmented value={tab} onChange={setTab} palette={palette} />
        </View>

        {/* CONTENIDO SEGÚN PESTAÑA ACTIVA */}
        <Animated.View
          style={{
            opacity: tabContentFade,
            transform: [{ translateY: tabContentSlide }],
          }}
        >
          {tab === 0 ? (
            /* ==========================================================
               PESTAÑA 1: SUEÑO & SMARTBAND SYNC (APPLE HEALTH)
            ========================================================== */
            <View style={{ marginTop: 4 }}>
              <DateSelector date={date} onChange={setDate} />

              {/* GRÁFICA HISTÓRICA DE SUEÑO Y CALORÍAS (DEBAJO DEL CALENDARIO) */}
              <SleepAndCaloriesHistoricalChart
                logs={sleepLogs}
                selectedDateKey={key}
                onSelectDateKey={(k) => setDate(parseDateKey(k))}
                palette={palette}
                titleFont={titleFont}
                subtitleFont={subtitleFont}
                dataFont={dataFont}
              />

              {isFutureDate ? (
                /* AVISO PARA FECHAS FUTURAS: NUNCA SE MUESTRAN DATOS FALSOS */
                <View style={[wellnessStyles.futureDateNoticeCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
                  <LinearGradient
                    colors={
                      palette.isDark
                        ? ['#1E293B', '#0F172A']
                        : ['#FFFFFF', '#F8FAFF']
                    }
                    style={wellnessStyles.futureDateNoticeGradient}
                  >
                    <View style={[wellnessStyles.futureIconBox, { backgroundColor: `${palette.primary}18` }]}>
                      <Ionicons name="calendar-outline" size={30} color={palette.primary} />
                    </View>
                    <Text style={[wellnessStyles.futureNoticeTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Fecha Futura ({date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })})
                    </Text>
                    <Text style={[wellnessStyles.futureNoticeSubtitle, { color: palette.textSub, fontFamily: bodyFont }]}>
                      No existen registros de sueño ni calorías todavía para esta fecha. Los datos se sincronizarán automáticamente desde tu Smartband / Apple Health una vez transcurra la noche.
                    </Text>

                    <Pressable
                      style={({ pressed }) => [
                        wellnessStyles.backToTodayBtn,
                        { borderColor: palette.primary, backgroundColor: `${palette.primary}12` },
                        pressed && { transform: [{ scale: 0.98 }] },
                      ]}
                      onPress={() => setDate(new Date())}
                    >
                      <Ionicons name="arrow-back" size={15} color={palette.primary} />
                      <Text style={[wellnessStyles.backToTodayBtnText, { color: palette.primary, fontFamily: subtitleFont }]}>
                        Volver al Día de Hoy
                      </Text>
                    </Pressable>
                  </LinearGradient>
                </View>
              ) : (
                /* VISTA ACTIVA DE SUEÑO & SMARTBAND */
                <>
                  {/* 1. Tarjeta de Conexión & Sincronización Smartband */}
                  <View style={[wellnessStyles.smartbandCard, { borderColor: palette.border, backgroundColor: palette.cardBg }]}>
                    <LinearGradient
                      colors={
                        palette.isDark
                          ? ['#1E293B', '#0F172A']
                          : ['#FFFFFF', '#F8FAFF']
                      }
                      style={wellnessStyles.smartbandCardGradient}
                    >
                      <View style={wellnessStyles.smartbandHeaderRow}>
                        <View style={[wellnessStyles.smartbandIconBox, { backgroundColor: `${palette.primary}18` }]}>
                          <Ionicons name="watch-outline" size={24} color={palette.primary} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[wellnessStyles.smartbandTitle, { color: palette.text, fontFamily: titleFont }]}>
                            Xiaomi Smart Band
                          </Text>
                          <Text style={[wellnessStyles.smartbandSubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
                            Sincronizado vía Apple Health
                          </Text>
                        </View>

                        <View style={[wellnessStyles.connectedBadge, { borderColor: `${palette.primary}40`, backgroundColor: `${palette.primary}12` }]}>
                          <View style={[wellnessStyles.connectedDot, { backgroundColor: palette.primary }]} />
                          <Text style={[wellnessStyles.connectedText, { color: palette.primary, fontFamily: subtitleFont }]}>
                            Conectado
                          </Text>
                        </View>
                      </View>

                      {/* Info de volcado */}
                      <View style={[wellnessStyles.syncMetaRow, { borderColor: palette.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="time-outline" size={13} color={palette.textSub} />
                          <Text style={[wellnessStyles.syncMetaText, { color: palette.textSub, fontFamily: bodyFont }]}>
                            {currentSleep.lastSyncedAt
                              ? `Último volcado: ${currentSleep.lastSyncedAt}`
                              : 'Sin sincronizar aún para este día'}
                          </Text>
                        </View>
                        <View style={[wellnessStyles.healthKitPill, { backgroundColor: `${palette.secondary}15`, borderColor: `${palette.secondary}30` }]}>
                          <Ionicons name="fitness-outline" size={12} color={palette.secondary} />
                          <Text style={[wellnessStyles.healthKitPillText, { color: palette.secondary, fontFamily: dataFont }]}>
                            Apple Health
                          </Text>
                        </View>
                      </View>

                      {/* Botón Principal de Sincronización */}
                      <View style={{ gap: 8 }}>
                        <Pressable
                          style={({ pressed }) => [
                            wellnessStyles.syncNowBtn,
                            pressed && { transform: [{ scale: 0.98 }] },
                          ]}
                          onPress={handleSyncSmartband}
                          disabled={isSyncing}
                        >
                          <LinearGradient
                            colors={[palette.primary, palette.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={wellnessStyles.syncNowBtnGradient}
                          >
                            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                              <Ionicons name="sync-outline" size={18} color="#FFFFFF" />
                            </Animated.View>
                            <Text style={[wellnessStyles.syncNowBtnText, { fontFamily: titleFont }]}>
                              {isSyncing ? 'Volcando datos de Apple Health...' : 'Sincronizar Smartband Ahora'}
                            </Text>
                          </LinearGradient>
                        </Pressable>

                        {/* Botón Calibrar / Ingresar valores exactos de la app */}
                        <Pressable
                          style={({ pressed }) => [
                            wellnessStyles.calibrateQuickBtn,
                            { borderColor: palette.border, backgroundColor: palette.bg },
                            pressed && { transform: [{ scale: 0.98 }] },
                          ]}
                          onPress={openEditSleepModal}
                        >
                          <Ionicons name="options-outline" size={14} color={palette.primary} />
                          <Text style={[wellnessStyles.calibrateQuickBtnText, { color: palette.text, fontFamily: subtitleFont }]}>
                            Ajustar valores exactos de mi Smartband
                          </Text>
                        </Pressable>
                      </View>

                      {/* Banner de Feedback / Confirmación */}
                      {syncFeedback && (
                        <View style={[wellnessStyles.feedbackBanner, { backgroundColor: `${palette.primary}15`, borderColor: `${palette.primary}35` }]}>
                          <Ionicons name="checkmark-circle" size={16} color={palette.primary} />
                          <Text style={[wellnessStyles.feedbackBannerText, { color: palette.text, fontFamily: bodyFont }]}>
                            {syncFeedback}
                          </Text>
                        </View>
                      )}
                    </LinearGradient>
                  </View>

                  {/* 2. Tarjeta Resumen: Horas de Sueño y Recuperación de Anoche */}
                  <View style={[wellnessStyles.sleepSummaryCard, { borderColor: palette.border, backgroundColor: palette.cardBg }]}>
                    <LinearGradient
                      colors={
                        palette.isDark
                          ? ['#1E293B', '#0F172A']
                          : ['#FFFFFF', '#F8FAFF']
                      }
                      style={wellnessStyles.sleepSummaryGradient}
                    >
                      <View style={wellnessStyles.sleepCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={[wellnessStyles.sleepMoonBadge, { backgroundColor: `${palette.primary}18` }]}>
                            <Ionicons name="moon" size={18} color={palette.primary} />
                          </View>
                          <View>
                            <Text style={[wellnessStyles.sleepCardTitle, { color: palette.text, fontFamily: titleFont }]}>
                              Sueño de Anoche
                            </Text>
                            <Text style={[wellnessStyles.sleepCardSubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
                              Calidad de descanso y recuperación física
                            </Text>
                          </View>
                        </View>

                        {/* Puntaje de Sueño */}
                        {hasDataForDate && (
                          <View style={[wellnessStyles.sleepScorePill, { borderColor: palette.primary, backgroundColor: `${palette.primary}14` }]}>
                            <Text style={[wellnessStyles.sleepScorePillNum, { color: palette.primary, fontFamily: dataFont }]}>
                              {currentSleep.sleepScore || 0}
                            </Text>
                            <Text style={[wellnessStyles.sleepScorePillLabel, { color: palette.primary, fontFamily: subtitleFont }]}>
                              Puntos
                            </Text>
                          </View>
                        )}
                      </View>

                      {hasDataForDate ? (
                        <>
                          {/* Gran indicador numérico de horas de sueño */}
                          <View style={wellnessStyles.sleepBigTimeContainer}>
                            <View style={wellnessStyles.sleepBigTimeRow}>
                              <Text style={[wellnessStyles.sleepBigTimeNum, { color: palette.text, fontFamily: dataFont }]}>
                                {currentSleep.hours}
                              </Text>
                              <Text style={[wellnessStyles.sleepBigTimeUnit, { color: palette.textSub, fontFamily: subtitleFont }]}>
                                h
                              </Text>
                              <Text style={[wellnessStyles.sleepBigTimeNum, { color: palette.text, fontFamily: dataFont, marginLeft: 12 }]}>
                                {String(currentSleep.minutes).padStart(2, '0')}
                              </Text>
                              <Text style={[wellnessStyles.sleepBigTimeUnit, { color: palette.textSub, fontFamily: subtitleFont }]}>
                                m
                              </Text>
                            </View>
                            <Text style={[wellnessStyles.sleepMetaPercentText, { color: palette.primary, fontFamily: subtitleFont }]}>
                              {Math.min(100, Math.round(((currentSleep.hours * 60 + currentSleep.minutes) / 480) * 100))}% de la meta recomendada (8h)
                            </Text>
                          </View>

                          {/* Barra de progreso de la meta */}
                          <View style={[wellnessStyles.sleepTargetTrack, { backgroundColor: palette.isDark ? '#334155' : 'rgba(203, 213, 225, 0.4)' }]}>
                            <LinearGradient
                              colors={[palette.primary, palette.secondary]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[
                                wellnessStyles.sleepTargetFill,
                                { width: `${Math.min(100, Math.round(((currentSleep.hours * 60 + currentSleep.minutes) / 480) * 100))}%` },
                              ]}
                            />
                          </View>

                          {/* Horarios: Acostado, Despertar, Tiempo Despierto */}
                          <View style={wellnessStyles.sleepScheduleRow}>
                            <View style={[wellnessStyles.sleepScheduleBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="bed-outline" size={13} color={palette.primary} />
                                <Text style={[wellnessStyles.sleepScheduleLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                                  Acostado
                                </Text>
                              </View>
                              <Text style={[wellnessStyles.sleepScheduleVal, { color: palette.text, fontFamily: dataFont }]}>
                                {currentSleep.bedtime || '--:--'}
                              </Text>
                            </View>

                            <View style={[wellnessStyles.sleepScheduleBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="sunny-outline" size={13} color={palette.secondary} />
                                <Text style={[wellnessStyles.sleepScheduleLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                                  Despertar
                                </Text>
                              </View>
                              <Text style={[wellnessStyles.sleepScheduleVal, { color: palette.text, fontFamily: dataFont }]}>
                                {currentSleep.wakeTime || '--:--'}
                              </Text>
                            </View>

                            <View style={[wellnessStyles.sleepScheduleBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="eye-outline" size={13} color={palette.textSub} />
                                <Text style={[wellnessStyles.sleepScheduleLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                                  Despierto
                                </Text>
                              </View>
                              <Text style={[wellnessStyles.sleepScheduleVal, { color: palette.text, fontFamily: dataFont }]}>
                                {currentSleep.awakeMinutes || 0} min
                              </Text>
                            </View>
                          </View>

                          {/* Fases de Sueño (Deep, Light, REM) */}
                          <View style={wellnessStyles.phasesContainer}>
                            <Text style={[wellnessStyles.phasesTitle, { color: palette.text, fontFamily: titleFont }]}>
                              Fases de Sueño
                            </Text>

                            <View style={[wellnessStyles.phasesBarTrack, { backgroundColor: palette.isDark ? '#334155' : 'rgba(203, 213, 225, 0.4)' }]}>
                              <View style={{ width: `${deepPct}%`, height: '100%', backgroundColor: palette.primary }} />
                              <View style={{ width: `${lightPct}%`, height: '100%', backgroundColor: palette.secondary }} />
                              <View style={{ width: `${remPct}%`, height: '100%', backgroundColor: `${palette.primary}99` }} />
                              <View style={{ width: `${awakePct}%`, height: '100%', backgroundColor: `${palette.textSub}40` }} />
                            </View>

                            {/* Chips de Leyenda */}
                            <View style={wellnessStyles.phasesLegendGrid}>
                              <View style={wellnessStyles.phaseLegendItem}>
                                <View style={[wellnessStyles.phaseLegendDot, { backgroundColor: palette.primary }]} />
                                <Text style={[wellnessStyles.phaseLegendName, { color: palette.textSub, fontFamily: subtitleFont }]}>
                                  Profundo: <Text style={{ color: palette.text, fontWeight: '700' }}>{currentSleep.deepSleepHours || 0}h</Text>
                                </Text>
                              </View>

                              <View style={wellnessStyles.phaseLegendItem}>
                                <View style={[wellnessStyles.phaseLegendDot, { backgroundColor: palette.secondary }]} />
                                <Text style={[wellnessStyles.phaseLegendName, { color: palette.textSub, fontFamily: subtitleFont }]}>
                                  Ligero: <Text style={{ color: palette.text, fontWeight: '700' }}>{currentSleep.lightSleepHours || 0}h</Text>
                                </Text>
                              </View>

                              <View style={wellnessStyles.phaseLegendItem}>
                                <View style={[wellnessStyles.phaseLegendDot, { backgroundColor: `${palette.primary}99` }]} />
                                <Text style={[wellnessStyles.phaseLegendName, { color: palette.textSub, fontFamily: subtitleFont }]}>
                                  REM: <Text style={{ color: palette.text, fontWeight: '700' }}>{currentSleep.remSleepHours || 0}h</Text>
                                </Text>
                              </View>

                              <View style={wellnessStyles.phaseLegendItem}>
                                <View style={[wellnessStyles.phaseLegendDot, { backgroundColor: `${palette.textSub}40` }]} />
                                <Text style={[wellnessStyles.phaseLegendName, { color: palette.textSub, fontFamily: subtitleFont }]}>
                                  Despierto: <Text style={{ color: palette.text, fontWeight: '700' }}>{currentSleep.awakeMinutes || 0}m</Text>
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Nota de Calidad */}
                          <View style={[wellnessStyles.qualityNoteBox, { backgroundColor: palette.bg, borderColor: `${palette.primary}30` }]}>
                            <Ionicons name="sparkles" size={14} color={palette.primary} />
                            <Text style={[wellnessStyles.qualityNoteText, { color: palette.textSub, fontFamily: bodyFont }]}>
                              {currentSleep.qualityNote || 'Recuperación física óptima y buen porcentaje de sueño profundo.'}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <View style={[wellnessStyles.emptyDayBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                          <Ionicons name="moon-outline" size={28} color={palette.textSub} />
                          <Text style={[wellnessStyles.emptyDayText, { color: palette.text, fontFamily: subtitleFont }]}>
                            Sin registros de sueño para este día
                          </Text>
                          <Text style={{ fontSize: 12, color: palette.textSub, textAlign: 'center', marginTop: 4 }}>
                            Pulsa "Sincronizar Smartband" arriba o registra las horas manualmente.
                          </Text>
                        </View>
                      )}
                    </LinearGradient>
                  </View>

                  {/* 3. Tarjeta de Calorías Quemadas y Actividad del Reloj */}
                  <View style={[wellnessStyles.burnedCaloriesCard, { borderColor: palette.border, backgroundColor: palette.cardBg }]}>
                    <LinearGradient
                      colors={
                        palette.isDark
                          ? ['#1E293B', '#0F172A']
                          : ['#FFFFFF', '#F8FAFF']
                      }
                      style={wellnessStyles.burnedCaloriesGradient}
                    >
                      <View style={wellnessStyles.sleepCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={[wellnessStyles.burnedFlameBadge, { backgroundColor: `${palette.secondary}18` }]}>
                            <Ionicons name="flame" size={20} color={palette.secondary} />
                          </View>
                          <View>
                            <Text style={[wellnessStyles.sleepCardTitle, { color: palette.text, fontFamily: titleFont }]}>
                              Calorías Quemadas
                            </Text>
                            <Text style={[wellnessStyles.sleepCardSubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
                              Gasto calórico activo registrado por la smartband
                            </Text>
                          </View>
                        </View>

                        <View style={[wellnessStyles.sourceDeviceBadge, { borderColor: `${palette.secondary}40`, backgroundColor: `${palette.secondary}12` }]}>
                          <Ionicons name="watch" size={11} color={palette.secondary} />
                          <Text style={[wellnessStyles.sourceDeviceBadgeText, { color: palette.secondary, fontFamily: subtitleFont }]}>
                            Reloj
                          </Text>
                        </View>
                      </View>

                      {hasDataForDate ? (
                        <>
                          {/* Hero de Calorías Quemadas */}
                          <View style={[wellnessStyles.burnedCaloriesHero, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                              <Ionicons name="flame" size={26} color={palette.secondary} />
                              <Text style={[wellnessStyles.burnedCaloriesNum, { color: palette.text, fontFamily: dataFont }]}>
                                {currentSleep.activeCaloriesBurned || 0}
                              </Text>
                              <Text style={[wellnessStyles.burnedCaloriesUnit, { color: palette.secondary, fontFamily: titleFont }]}>
                                kcal activas
                              </Text>
                            </View>

                            <Text style={[wellnessStyles.burnedCaloriesSubText, { color: palette.textSub, fontFamily: bodyFont }]}>
                              + ~1,650 kcal basales estimados = <Text style={{ color: palette.text, fontWeight: '700' }}>{(currentSleep.activeCaloriesBurned || 0) + 1650} kcal quemadas en total</Text>
                            </Text>
                          </View>

                          {/* Métricas complementarias sincronizadas del reloj */}
                          <View style={wellnessStyles.watchMetricsGrid}>
                            <View style={[wellnessStyles.watchMetricBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="footsteps-outline" size={14} color={palette.primary} />
                                <Text style={[wellnessStyles.watchMetricLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                                  Pasos
                                </Text>
                              </View>
                              <Text style={[wellnessStyles.watchMetricVal, { color: palette.text, fontFamily: dataFont }]}>
                                {(currentSleep.steps || 0).toLocaleString('es-ES')}
                              </Text>
                            </View>

                            <View style={[wellnessStyles.watchMetricBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="heart-outline" size={14} color={palette.secondary} />
                                <Text style={[wellnessStyles.watchMetricLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                                  Pulso Reposo
                                </Text>
                              </View>
                              <Text style={[wellnessStyles.watchMetricVal, { color: palette.text, fontFamily: dataFont }]}>
                                {currentSleep.restingHeartRate || '--'} <Text style={{ fontSize: 11, color: palette.textSub }}>bpm</Text>
                              </Text>
                            </View>

                            <View style={[wellnessStyles.watchMetricBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="flash-outline" size={14} color={palette.primary} />
                                <Text style={[wellnessStyles.watchMetricLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                                  Recuperación
                                </Text>
                              </View>
                              <Text style={[wellnessStyles.watchMetricVal, { color: palette.primary, fontFamily: dataFont }]}>
                                {currentSleep.sleepScore ? `${currentSleep.sleepScore}%` : '--'}
                              </Text>
                            </View>
                          </View>
                        </>
                      ) : (
                        <View style={[wellnessStyles.emptyDayBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                          <Ionicons name="flame-outline" size={28} color={palette.textSub} />
                          <Text style={[wellnessStyles.emptyDayText, { color: palette.text, fontFamily: subtitleFont }]}>
                            Sin calorías registradas para este día
                          </Text>
                        </View>
                      )}
                    </LinearGradient>
                  </View>

                  {/* 4. Botón para Ajustar o Registrar Manualmente */}
                  <Pressable
                    style={({ pressed }) => [
                      wellnessStyles.manualEditBtn,
                      { borderColor: palette.primary, backgroundColor: palette.cardBg },
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={openEditSleepModal}
                  >
                    <Ionicons name="create-outline" size={16} color={palette.primary} />
                    <Text style={[wellnessStyles.manualEditBtnText, { color: palette.primary, fontFamily: subtitleFont }]}>
                      Ajustar o registrar horas manualmente
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : tab === 1 ? (
            /* ==========================================================
               PESTAÑA 2: SUPLEMENTOS
            ========================================================== */
            <View style={{ marginTop: 2 }}>
              {/* 1. Botón de Calendario */}
              <DateSelector date={date} onChange={setDate} />

              {/* 2. Tarjeta de Progreso Diario de Suplementos */}
              <View style={wellnessStyles.progressCard}>
                <LinearGradient
                  colors={
                    allCompletedToday ? [getPaletteColorWithAlpha(palette.secondary, 0.12), getPaletteColorWithAlpha(palette.secondary, 0.04)] : [getPaletteColorWithAlpha(palette.primary, 0.08), getPaletteColorWithAlpha(palette.primary, 0.02)]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={wellnessStyles.progressCardGradient}
                >
                  <View style={wellnessStyles.progressHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <LinearGradient
                        colors={[palette.primary, palette.secondary]}
                        style={wellnessStyles.progressIconBadge}
                      >
                        <Ionicons
                          name={allCompletedToday ? 'checkmark-done' : 'Checkbox-outline' in Ionicons.glyphMap ? 'checkbox-outline' : 'medkit'}
                          size={18}
                          color="#FFFFFF"
                        />
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={wellnessStyles.progressTitle}>
                          {allCompletedToday
                            ? '¡Todos los suplementos tomados!'
                            : 'Checklist Diario de Suplementos'}
                        </Text>
                        <Text style={wellnessStyles.progressSubtitle}>
                          {completedDosesToday} de {totalDosesToday} tomas completadas en el día
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        wellnessStyles.progressPctPill,
                        {
                          backgroundColor: getPaletteColorWithAlpha(palette.primary, 0.14),
                          borderColor: getPaletteColorWithAlpha(palette.primary, 0.35),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          wellnessStyles.progressPctText,
                          { color: palette.primary },
                        ]}
                      >
                        {progressPct}%
                      </Text>
                    </View>
                  </View>

                  <View style={wellnessStyles.progressBarTrack}>
                    <LinearGradient
                      colors={[palette.primary, palette.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        wellnessStyles.progressBarFill,
                        { width: `${progressPct}%` },
                      ]}
                    />
                  </View>
                </LinearGradient>
              </View>

              {/* 3. Cabecera del Listado + Botón para Modificar */}
              <View style={wellnessStyles.listSectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="list-outline" size={16} color={palette.primary} />
                  <Text style={wellnessStyles.listSectionTitle}>MIS SUPLEMENTOS DIARIOS</Text>
                </View>

                <Pressable
                  onPress={() => setIsEditingList((prev) => !prev)}
                  style={({ pressed }) => [
                    wellnessStyles.modifyModeBtn,
                    {
                      borderColor: isEditingList
                        ? palette.primary
                        : getPaletteColorWithAlpha(palette.primary, 0.35),
                      backgroundColor: isEditingList
                        ? palette.primary
                        : getPaletteColorWithAlpha(palette.primary, 0.08),
                    },
                    pressed && s.btnPressed,
                  ]}
                >
                  <Ionicons
                    name={isEditingList ? 'checkmark-circle' : 'options-outline'}
                    size={14}
                    color={isEditingList ? '#FFFFFF' : palette.primary}
                  />
                  <Text
                    style={[
                      wellnessStyles.modifyModeBtnText,
                      { color: isEditingList ? '#FFFFFF' : palette.primary },
                    ]}
                  >
                    {isEditingList ? 'Listo' : 'Modificar'}
                  </Text>
                </Pressable>
              </View>

              {isEditingList && (
                <View style={wellnessStyles.editHintBanner}>
                  <Ionicons name="information-circle-outline" size={16} color={palette.primary} />
                  <Text style={wellnessStyles.editHintBannerText}>
                    Usa los botones <Text style={{ fontWeight: '900' }}>-</Text> y{' '}
                    <Text style={{ fontWeight: '900' }}>+</Text> para disminuir o aumentar las veces
                    al día (checkboxes), toca el nombre para renombrar o usa la papelera para quitar.
                  </Text>
                </View>
              )}

              {/* 4. Lista de Suplementos con Checkboxes por cada toma diaria */}
              {activeSupplements.length === 0 ? (
                <View style={wellnessStyles.emptyListCard}>
                  <Ionicons name="medkit-outline" size={32} color={palette.primary} />
                  <Text style={wellnessStyles.emptyListTitle}>Sin suplementos en tu lista</Text>
                  <Text style={wellnessStyles.emptyListSub}>
                    Agrega suplementos como Creatina, Omega 3 o Citrato de Magnesio para llevar tu control diario.
                  </Text>
                  <Pressable
                    onPress={openAddSupplementModal}
                    style={({ pressed }) => [
                      wellnessStyles.emptyAddBtn,
                      pressed && s.btnPressed,
                    ]}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={palette.primary} />
                    <Text style={[wellnessStyles.emptyAddBtnText, { color: palette.primary }]}>Agregar suplemento</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={wellnessStyles.supplementListContainer}>
                  {activeSupplements.map((supp) => {
                    const checks = daySupplementChecks[supp.id] || [];
                    let checkedCount = 0;
                    for (let i = 0; i < supp.dailyTarget; i++) {
                      if (checks[i]) checkedCount++;
                    }
                    const isAllDone = checkedCount === supp.dailyTarget;

                    return (
                      <View
                        key={supp.id}
                        style={[
                          wellnessStyles.supplementItemCard,
                          {
                            backgroundColor: palette.isDark ? '#1E293B' : '#FFFFFF',
                            borderColor: isAllDone
                              ? palette.secondary
                              : getPaletteColorWithAlpha(palette.primary, 0.25),
                          },
                        ]}
                      >
                        <View style={wellnessStyles.supplementMainRow}>
                          {/* Información izquierda del suplemento */}
                          <View style={wellnessStyles.supplementInfoCol}>
                            <Pressable
                              disabled={!isEditingList}
                              onPress={() => openEditSupplementModal(supp)}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View
                                  style={[
                                    wellnessStyles.supplementDotIndicator,
                                    {
                                      backgroundColor: isAllDone ? palette.secondary : palette.primary,
                                    },
                                  ]}
                                />
                                <Text
                                  style={[
                                    wellnessStyles.supplementNameText,
                                    palette.isDark && { color: '#FFFFFF' },
                                    isAllDone && wellnessStyles.supplementNameTextDone,
                                  ]}
                                >
                                  {supp.name}
                                </Text>
                                {isEditingList && (
                                  <Ionicons name="create-outline" size={14} color={C.sub} />
                                )}
                              </View>

                              <Text style={wellnessStyles.supplementDoseSubText}>
                                {supp.dailyTarget === 1
                                  ? '1 vez al día'
                                  : `${supp.dailyTarget} veces al día`}{' '}
                                ·{' '}
                                <Text
                                  style={{
                                    color: isAllDone ? palette.secondary : palette.primary,
                                    fontWeight: '800',
                                  }}
                                >
                                  {checkedCount}/{supp.dailyTarget}{' '}
                                  {isAllDone ? 'completado' : 'tomadas'}
                                </Text>
                              </Text>
                            </Pressable>

                            {/* Botón de reloj por defecto justo debajo de las veces al día */}
                            <Pressable
                              onPress={() => openAlarmModal(supp)}
                              hitSlop={6}
                              style={({ pressed }) => [
                                wellnessStyles.alarmClockBtn,
                                supp.alarmTime && wellnessStyles.alarmClockBtnActive,
                                palette.isDark && {
                                  backgroundColor: palette.primary,
                                  borderColor: palette.primary,
                                },
                                pressed && s.btnPressed,
                              ]}
                            >
                              <Ionicons
                                name={supp.alarmTime ? 'alarm' : 'alarm-outline'}
                                size={14}
                                color={palette.isDark ? '#FFFFFF' : (supp.alarmTime ? palette.primary : C.sub)}
                              />
                              {supp.alarmTime ? (
                                <Text style={[wellnessStyles.alarmClockBtnText, palette.isDark && { color: '#FFFFFF' }]}>
                                  {formatAlarmTime12h(supp.alarmTime)} · {getAlarmSoundById(supp.alarmSound).name}
                                </Text>
                              ) : (
                                <Text style={[wellnessStyles.alarmClockBtnPlaceholderText, palette.isDark && { color: '#FFFFFF' }]}>
                                  Programar alarma
                                </Text>
                              )}
                            </Pressable>
                          </View>

                          {/* Derecha: Checkboxes correspondientes al número de veces que se debe tomar */}
                          <View style={wellnessStyles.checkboxesWrap}>
                            {Array.from({ length: supp.dailyTarget }, (_, doseIdx) => {
                              const checked = Boolean(checks[doseIdx]);
                              return (
                                <Pressable
                                  key={doseIdx}
                                  onPress={() =>
                                    toggleSupplementDose(
                                      key,
                                      supp.id,
                                      doseIdx,
                                      supp.dailyTarget
                                    )
                                  }
                                  style={({ pressed }) => [
                                    wellnessStyles.doseCheckboxBtn,
                                    {
                                      borderColor: getPaletteColorWithAlpha(palette.primary, 0.35),
                                      backgroundColor: 'transparent',
                                    },
                                    checked && wellnessStyles.doseCheckboxBtnActive,
                                    pressed && { transform: [{ scale: 0.92 }] },
                                  ]}
                                  hitSlop={4}
                                >
                                  {checked ? (
                                    <LinearGradient
                                      colors={[palette.primary, palette.secondary]}
                                      start={{ x: 0, y: 0 }}
                                      end={{ x: 1, y: 1 }}
                                      style={wellnessStyles.doseCheckboxGradient}
                                    >
                                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                                    </LinearGradient>
                                  ) : (
                                    <View style={wellnessStyles.doseCheckboxEmptyInner}>
                                      {supp.dailyTarget > 1 && (
                                        <Text style={[wellnessStyles.doseCheckboxNumberHint, { color: getPaletteColorWithAlpha(palette.primary, 0.7) }]}>
                                          {doseIdx + 1}
                                        </Text>
                                      )}
                                    </View>
                                  )}
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>

                        {/* Controles de Modificación Rápida (Disminuir/Aumentar cantidad de tomas o Quitar suplemento) */}
                        {isEditingList && (
                          <View style={wellnessStyles.supplementEditFooter}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={wellnessStyles.editFooterLabel}>
                                Tomas por día (checkboxes):
                              </Text>

                              <View style={wellnessStyles.stepperContainer}>
                                <Pressable
                                  onPress={() =>
                                    updateSupplement(
                                      supp.id,
                                      {
                                        dailyTarget: Math.max(1, supp.dailyTarget - 1),
                                      },
                                      key,
                                    )
                                  }
                                  disabled={supp.dailyTarget <= 1}
                                  style={({ pressed }) => [
                                    wellnessStyles.stepperBtn,
                                    supp.dailyTarget <= 1 && { opacity: 0.35 },
                                    pressed && s.btnPressed,
                                  ]}
                                >
                                  <Ionicons name="remove" size={15} color={palette.primary} />
                                </Pressable>

                                <Text style={wellnessStyles.stepperValueText}>
                                  {supp.dailyTarget}
                                </Text>

                                <Pressable
                                  onPress={() =>
                                    updateSupplement(
                                      supp.id,
                                      {
                                        dailyTarget: Math.min(10, supp.dailyTarget + 1),
                                      },
                                      key,
                                    )
                                  }
                                  disabled={supp.dailyTarget >= 10}
                                  style={({ pressed }) => [
                                    wellnessStyles.stepperBtn,
                                    supp.dailyTarget >= 10 && { opacity: 0.35 },
                                    pressed && s.btnPressed,
                                  ]}
                                >
                                  <Ionicons name="add" size={15} color={palette.primary} />
                                </Pressable>
                              </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Pressable
                                onPress={() => openEditSupplementModal(supp)}
                                style={({ pressed }) => [
                                  wellnessStyles.editNameSmallBtn,
                                  pressed && s.btnPressed,
                                ]}
                              >
                                <Ionicons name="pencil" size={13} color={palette.primary} />
                              </Pressable>

                              <Pressable
                                onPress={() => handleDeleteSupplement(supp)}
                                style={({ pressed }) => [
                                  wellnessStyles.deleteSuppSmallBtn,
                                  pressed && s.btnPressed,
                                ]}
                              >
                                <Ionicons name="trash-outline" size={14} color={C.danger} />
                                <Text style={wellnessStyles.deleteSuppSmallBtnText}>Quitar</Text>
                              </Pressable>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Botón inferior para agregar nuevo suplemento */}
              <Pressable
                onPress={openAddSupplementModal}
                style={({ pressed }) => [
                  wellnessStyles.bottomAddSuppBtn,
                  {
                    borderColor: getPaletteColorWithAlpha(palette.primary, 0.45),
                    backgroundColor: getPaletteColorWithAlpha(palette.primary, 0.05),
                  },
                  pressed && s.btnPressed,
                ]}
              >
                <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
                <Text style={[wellnessStyles.bottomAddSuppBtnText, { color: palette.primary }]}>
                  Agregar otro suplemento
                </Text>
              </Pressable>
            </View>
          ) : (
            /* ==========================================================
               PESTAÑA 3: SALUD Y BIOMARCADORES
            ========================================================== */
            <HealthSection date={date} setDate={setDate} />
          )}
        </Animated.View>
      </ScrollView>

      {/* MODAL REGISTRO MANUAL DE SUEÑO Y CALORÍAS */}
      <Modal
        visible={editSleepModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditSleepModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Pressable
            style={wellnessStyles.modalBackdrop}
            onPress={() => setEditSleepModalOpen(false)}
          >
            <Pressable
              style={[
                wellnessStyles.modalCard,
                { backgroundColor: palette.cardBg, borderColor: palette.border },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={wellnessStyles.modalHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[wellnessStyles.modalIconCircle, { backgroundColor: `${palette.primary}18` }]}>
                    <Ionicons name="bed-outline" size={18} color={palette.primary} />
                  </View>
                  <Text style={[wellnessStyles.modalTitle, { color: palette.text, fontFamily: titleFont }]}>
                    Registro de Sueño y Actividad
                  </Text>
                </View>
                <Pressable onPress={() => setEditSleepModalOpen(false)} style={wellnessStyles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color={palette.textSub} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {/* Horas y minutos dormidos */}
                <Text style={[wellnessStyles.inputFieldLabel, { color: palette.text, fontFamily: subtitleFont, marginTop: 10 }]}>
                  Tiempo de Sueño
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[wellnessStyles.inputFieldSubLabel, { color: palette.textSub, fontFamily: bodyFont }]}>Horas</Text>
                    <TextInput
                      style={[
                        wellnessStyles.modalTextInput,
                        { backgroundColor: palette.bg, borderColor: palette.border, color: palette.text, fontFamily: dataFont },
                      ]}
                      value={formSleepHours}
                      onChangeText={setFormSleepHours}
                      keyboardType="numeric"
                      placeholder="7"
                      placeholderTextColor={palette.textSub}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[wellnessStyles.inputFieldSubLabel, { color: palette.textSub, fontFamily: bodyFont }]}>Minutos</Text>
                    <TextInput
                      style={[
                        wellnessStyles.modalTextInput,
                        { backgroundColor: palette.bg, borderColor: palette.border, color: palette.text, fontFamily: dataFont },
                      ]}
                      value={formSleepMinutes}
                      onChangeText={setFormSleepMinutes}
                      keyboardType="numeric"
                      placeholder="45"
                      placeholderTextColor={palette.textSub}
                    />
                  </View>
                </View>

                {/* Horario de acostarse y levantarse */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[wellnessStyles.inputFieldSubLabel, { color: palette.textSub, fontFamily: bodyFont }]}>Hora Acostarse</Text>
                    <TextInput
                      style={[
                        wellnessStyles.modalTextInput,
                        { backgroundColor: palette.bg, borderColor: palette.border, color: palette.text, fontFamily: dataFont },
                      ]}
                      value={formBedtime}
                      onChangeText={setFormBedtime}
                      placeholder="23:15"
                      placeholderTextColor={palette.textSub}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[wellnessStyles.inputFieldSubLabel, { color: palette.textSub, fontFamily: bodyFont }]}>Hora Despertar</Text>
                    <TextInput
                      style={[
                        wellnessStyles.modalTextInput,
                        { backgroundColor: palette.bg, borderColor: palette.border, color: palette.text, fontFamily: dataFont },
                      ]}
                      value={formWakeTime}
                      onChangeText={setFormWakeTime}
                      placeholder="07:00"
                      placeholderTextColor={palette.textSub}
                    />
                  </View>
                </View>

                {/* Calorías quemadas */}
                <Text style={[wellnessStyles.inputFieldLabel, { color: palette.text, fontFamily: subtitleFont }]}>
                  Calorías Activas Quemadas (kcal)
                </Text>
                <TextInput
                  style={[
                    wellnessStyles.modalTextInput,
                    { backgroundColor: palette.bg, borderColor: palette.border, color: palette.text, fontFamily: dataFont, marginBottom: 14 },
                  ]}
                  value={formBurnedCalories}
                  onChangeText={setFormBurnedCalories}
                  keyboardType="numeric"
                  placeholder="520"
                  placeholderTextColor={palette.textSub}
                />

                {/* Pasos y pulso */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[wellnessStyles.inputFieldSubLabel, { color: palette.textSub, fontFamily: bodyFont }]}>Pasos</Text>
                    <TextInput
                      style={[
                        wellnessStyles.modalTextInput,
                        { backgroundColor: palette.bg, borderColor: palette.border, color: palette.text, fontFamily: dataFont },
                      ]}
                      value={formSteps}
                      onChangeText={setFormSteps}
                      keyboardType="numeric"
                      placeholder="8430"
                      placeholderTextColor={palette.textSub}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[wellnessStyles.inputFieldSubLabel, { color: palette.textSub, fontFamily: bodyFont }]}>Pulso Reposo (bpm)</Text>
                    <TextInput
                      style={[
                        wellnessStyles.modalTextInput,
                        { backgroundColor: palette.bg, borderColor: palette.border, color: palette.text, fontFamily: dataFont },
                      ]}
                      value={formHeartRate}
                      onChangeText={setFormHeartRate}
                      keyboardType="numeric"
                      placeholder="58"
                      placeholderTextColor={palette.textSub}
                    />
                  </View>
                </View>
              </ScrollView>

              {/* Botón Guardar */}
              <Pressable
                style={({ pressed }) => [
                  wellnessStyles.saveSleepBtn,
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
                onPress={handleSaveManualSleep}
              >
                <LinearGradient
                  colors={[palette.primary, palette.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={wellnessStyles.saveSleepBtnGradient}
                >
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  <Text style={[wellnessStyles.saveSleepBtnText, { fontFamily: titleFont }]}>
                    Guardar Registro
                  </Text>
                </LinearGradient>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL PARA AGREGAR O EDITAR SUPLEMENTO */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={wellnessStyles.modalBackdrop}
            onPress={() => setModalOpen(false)}
          >
            <Pressable
              style={wellnessStyles.modalCard}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={wellnessStyles.modalHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={wellnessStyles.modalIconCircle}>
                    <Ionicons name="medkit" size={19} color={palette.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={wellnessStyles.modalTitle}>
                      {editingSupplement ? 'Modificar Suplemento' : 'Nuevo Suplemento'}
                    </Text>
                    <Text style={wellnessStyles.modalSubtitle}>
                      Se repetirá día a día con sus checkboxes correspondientes
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => setModalOpen(false)}
                  style={wellnessStyles.modalCloseBtn}
                >
                  <Ionicons name="close" size={18} color={C.sub} />
                </Pressable>
              </View>

              <View style={{ marginTop: 14 }}>
                <Text style={wellnessStyles.inputLabel}>NOMBRE DEL SUPLEMENTO</Text>
                <TextInput
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="Ej. Creatina, Omega 3, Vitamina D3..."
                  placeholderTextColor={C.subMuted}
                  style={wellnessStyles.textInput}
                  returnKeyType="done"
                  onSubmitEditing={handleSaveSupplementModal}
                />
              </View>

              <View style={{ marginTop: 16 }}>
                <Text style={wellnessStyles.inputLabel}>
                  VECES QUE SE DEBE TOMAR AL DÍA (CHECKBOXES)
                </Text>

                <View style={wellnessStyles.modalTargetRow}>
                  <Pressable
                    onPress={() => setFormTarget((prev) => Math.max(1, prev - 1))}
                    style={({ pressed }) => [
                      wellnessStyles.modalStepperCircleBtn,
                      formTarget <= 1 && { opacity: 0.4 },
                      pressed && s.btnPressed,
                    ]}
                  >
                    <Ionicons name="remove" size={20} color={palette.primary} />
                  </Pressable>

                  <View style={wellnessStyles.modalTargetCenterBox}>
                    <Text style={wellnessStyles.modalTargetBigNumber}>{formTarget}</Text>
                    <Text style={wellnessStyles.modalTargetUnitText}>
                      {formTarget === 1 ? 'vez al día (1 checkbox)' : `veces al día (${formTarget} checkboxes)`}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => setFormTarget((prev) => Math.min(10, prev + 1))}
                    style={({ pressed }) => [
                      wellnessStyles.modalStepperCircleBtn,
                      formTarget >= 10 && { opacity: 0.4 },
                      pressed && s.btnPressed,
                    ]}
                  >
                    <Ionicons name="add" size={20} color={palette.primary} />
                  </Pressable>
                </View>

                {/* Vista previa de las checkboxes que tendrá */}
                <View style={wellnessStyles.previewCheckboxesRow}>
                  {Array.from({ length: formTarget }, (_, idx) => (
                    <View key={idx} style={wellnessStyles.previewCheckboxChip}>
                      <Ionicons name="checkbox-outline" size={15} color={palette.primary} />
                      <Text style={[wellnessStyles.previewCheckboxChipText, { color: palette.primary }]}>Toma #{idx + 1}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={wellnessStyles.modalActionsRow}>
                <Pressable
                  onPress={() => setModalOpen(false)}
                  style={({ pressed }) => [
                    wellnessStyles.modalCancelBtn,
                    pressed && s.btnPressed,
                  ]}
                >
                  <Text style={wellnessStyles.modalCancelBtnText}>Cancelar</Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveSupplementModal}
                  style={({ pressed }) => [
                    wellnessStyles.modalSaveBtn,
                    pressed && s.btnPressed,
                  ]}
                >
                  <LinearGradient
                    colors={[palette.primary, palette.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={wellnessStyles.modalSaveBtnGradient}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={wellnessStyles.modalSaveBtnText}>
                      {editingSupplement ? 'Guardar' : 'Guardar Suplemento'}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>

              {editingSupplement && (
                <Pressable
                  onPress={() => {
                    setModalOpen(false);
                    handleDeleteSupplement(editingSupplement);
                  }}
                  style={({ pressed }) => [
                    wellnessStyles.modalDeleteFullBtn,
                    { marginTop: 10 },
                    pressed && s.btnPressed,
                  ]}
                >
                  <Ionicons name="trash-outline" size={16} color={C.danger} />
                  <Text style={wellnessStyles.modalDeleteFullBtnText}>
                    Quitar este suplemento de la lista
                  </Text>
                </Pressable>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL PARA PROGRAMAR HORA DE ALARMA DEL SUPLEMENTO */}
      <Modal
        visible={Boolean(alarmModalSupp)}
        transparent
        animationType="fade"
        onRequestClose={closeAlarmModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={wellnessStyles.modalBackdrop}
            onPress={closeAlarmModal}
          >
            <Pressable
              style={wellnessStyles.modalCard}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={wellnessStyles.modalHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={wellnessStyles.modalIconCircle}>
                    <Ionicons name="alarm" size={20} color={palette.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={wellnessStyles.modalTitle}>Programar Alarma</Text>
                    <Text style={wellnessStyles.modalSubtitle}>
                      {alarmModalSupp?.name} · Recordatorio diario
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={closeAlarmModal}
                  style={wellnessStyles.modalCloseBtn}
                >
                  <Ionicons name="close" size={18} color={C.sub} />
                </Pressable>
              </View>

              {/* Selector Digital de Hora (HH : MM + AM/PM) */}
              <View style={wellnessStyles.alarmPickerBox}>
                {/* Columna Hora */}
                <View style={wellnessStyles.alarmTimeUnitCol}>
                  <Pressable
                    onPress={() => stepAlarmHour(1)}
                    style={({ pressed }) => [
                      wellnessStyles.alarmStepBtn,
                      pressed && s.btnPressed,
                    ]}
                  >
                    <Ionicons name="chevron-up" size={20} color={palette.primary} />
                  </Pressable>

                  <TextInput
                    value={alarmHourText}
                    onChangeText={(txt) => {
                      const digits = txt.replace(/[^0-9]/g, '').slice(0, 2);
                      setAlarmHourText(digits);
                      const num = parseInt(digits, 10);
                      if (num >= 1 && num <= 12) {
                        setAlarmHour12(num);
                      }
                    }}
                    onBlur={() => {
                      const num = parseInt(alarmHourText, 10);
                      const clean = Number.isFinite(num)
                        ? Math.max(1, Math.min(12, num))
                        : alarmHour12;
                      setAlarmHour12(clean);
                      setAlarmHourText(String(clean).padStart(2, '0'));
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                    style={wellnessStyles.alarmDigitInput}
                  />
                  <Text style={wellnessStyles.alarmUnitCaption}>HORA</Text>

                  <Pressable
                    onPress={() => stepAlarmHour(-1)}
                    style={({ pressed }) => [
                      wellnessStyles.alarmStepBtn,
                      pressed && s.btnPressed,
                    ]}
                  >
                    <Ionicons name="chevron-down" size={20} color={palette.primary} />
                  </Pressable>
                </View>

                <Text style={wellnessStyles.alarmColonText}>:</Text>

                {/* Columna Minutos */}
                <View style={wellnessStyles.alarmTimeUnitCol}>
                  <Pressable
                    onPress={() => stepAlarmMinute(5)}
                    style={({ pressed }) => [
                      wellnessStyles.alarmStepBtn,
                      pressed && s.btnPressed,
                    ]}
                  >
                    <Ionicons name="chevron-up" size={20} color={palette.primary} />
                  </Pressable>

                  <TextInput
                    value={alarmMinuteText}
                    onChangeText={(txt) => {
                      const digits = txt.replace(/[^0-9]/g, '').slice(0, 2);
                      setAlarmMinuteText(digits);
                      const num = parseInt(digits, 10);
                      if (num >= 0 && num <= 59) {
                        setAlarmMinute(num);
                      }
                    }}
                    onBlur={() => {
                      const num = parseInt(alarmMinuteText, 10);
                      const clean = Number.isFinite(num)
                        ? Math.max(0, Math.min(59, num))
                        : alarmMinute;
                      setAlarmMinute(clean);
                      setAlarmMinuteText(String(clean).padStart(2, '0'));
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                    style={wellnessStyles.alarmDigitInput}
                  />
                  <Text style={wellnessStyles.alarmUnitCaption}>MIN</Text>

                  <Pressable
                    onPress={() => stepAlarmMinute(-5)}
                    style={({ pressed }) => [
                      wellnessStyles.alarmStepBtn,
                      pressed && s.btnPressed,
                    ]}
                  >
                    <Ionicons name="chevron-down" size={20} color={palette.primary} />
                  </Pressable>
                </View>

                {/* Columna AM / PM */}
                <View style={wellnessStyles.alarmPeriodCol}>
                  {(['AM', 'PM'] as const).map((periodOpt) => {
                    const active = alarmPeriod === periodOpt;
                    return (
                      <Pressable
                        key={periodOpt}
                        onPress={() => setAlarmPeriod(periodOpt)}
                        style={({ pressed }) => [
                          wellnessStyles.alarmPeriodBtn,
                          active && wellnessStyles.alarmPeriodBtnActive,
                          pressed && s.btnPressed,
                        ]}
                      >
                        {active ? (
                          <LinearGradient
                            colors={[palette.primary, palette.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={wellnessStyles.alarmPeriodGradient}
                          >
                            <Text style={wellnessStyles.alarmPeriodTextActive}>
                              {periodOpt}
                            </Text>
                          </LinearGradient>
                        ) : (
                          <Text style={wellnessStyles.alarmPeriodText}>{periodOpt}</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Horarios rápidos de 1 toque */}
              <View style={{ marginTop: 14 }}>
                <Text style={wellnessStyles.inputLabel}>HORARIOS RÁPIDOS</Text>
                <View style={wellnessStyles.alarmPresetsRow}>
                  {[
                    { label: '7:00 AM', h: 7, m: 0, p: 'AM' as const },
                    { label: '8:00 AM', h: 8, m: 0, p: 'AM' as const },
                    { label: '1:00 PM', h: 1, m: 0, p: 'PM' as const },
                    { label: '8:00 PM', h: 8, m: 0, p: 'PM' as const },
                    { label: '10:00 PM', h: 10, m: 0, p: 'PM' as const },
                  ].map((preset) => {
                    const isSelected =
                      alarmHour12 === preset.h &&
                      alarmMinute === preset.m &&
                      alarmPeriod === preset.p;
                    return (
                      <Pressable
                        key={preset.label}
                        onPress={() => applyAlarmPreset(preset.h, preset.m, preset.p)}
                        style={({ pressed }) => [
                          wellnessStyles.alarmPresetChip,
                          isSelected && wellnessStyles.alarmPresetChipActive,
                          pressed && s.btnPressed,
                        ]}
                      >
                        <Text
                          style={[
                            wellnessStyles.alarmPresetChipText,
                            isSelected && wellnessStyles.alarmPresetChipTextActive,
                          ]}
                        >
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Selector de tonos de alarma */}
              <View style={{ marginTop: 16 }}>
                <View style={wellnessStyles.soundHeaderRow}>
                  <Text style={wellnessStyles.inputLabel}>ELEGIR TONO DE ALARMA</Text>
                  <Text style={wellnessStyles.soundCountHint}>5 tonos</Text>
                </View>

                <View style={wellnessStyles.soundListWrap}>
                  {ALARM_SOUNDS.map((sound) => {
                    const isSelected = selectedSoundId === sound.id;
                    const isPreviewing = playingPreviewId === sound.id;

                    return (
                      <Pressable
                        key={sound.id}
                        onPress={() => handleToggleSoundPreview(sound.id)}
                        style={({ pressed }) => [
                          wellnessStyles.soundItemCard,
                          isSelected && wellnessStyles.soundItemCardActive,
                          pressed && s.btnPressed,
                        ]}
                      >
                        {/* Radio indicador */}
                        <View
                          style={[
                            wellnessStyles.soundRadioCircle,
                            isSelected && wellnessStyles.soundRadioCircleActive,
                          ]}
                        >
                          {isSelected && <View style={wellnessStyles.soundRadioInnerDot} />}
                        </View>

                        <Text style={wellnessStyles.soundEmoji}>{sound.emoji}</Text>

                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text
                            style={[
                              wellnessStyles.soundNameText,
                              isSelected && wellnessStyles.soundNameTextActive,
                            ]}
                          >
                            {sound.name}
                          </Text>
                          <Text style={wellnessStyles.soundDescText}>{sound.description}</Text>
                        </View>

                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            handleToggleSoundPreview(sound.id);
                          }}
                          style={({ pressed }) => [
                            wellnessStyles.soundPlayBtn,
                            isPreviewing && wellnessStyles.soundPlayBtnActive,
                            pressed && s.btnPressed,
                          ]}
                          hitSlop={6}
                        >
                          <Ionicons
                            name={isPreviewing ? 'stop-circle' : 'volume-high-outline'}
                            size={16}
                            color={isPreviewing ? palette.secondary : isSelected ? palette.primary : C.sub}
                          />
                          <Text
                            style={[
                              wellnessStyles.soundPlayBtnText,
                              isPreviewing && wellnessStyles.soundPlayBtnTextActive,
                              isSelected && !isPreviewing && { color: palette.primary },
                            ]}
                          >
                            {isPreviewing ? 'Parar' : 'Oír'}
                          </Text>
                        </Pressable>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Botón para probar cómo suena la alarma */}
                <Pressable
                  onPress={handleTestAlarmNow}
                  style={({ pressed }) => [
                    wellnessStyles.testAlarmBtn,
                    pressed && s.btnPressed,
                  ]}
                >
                  <Ionicons name="notifications" size={15} color={palette.primary} />
                  <Text style={[wellnessStyles.testAlarmBtnText, { color: palette.primary }]}>
                    Probar alarma con "{getAlarmSoundById(selectedSoundId).name}"
                  </Text>
                </Pressable>
              </View>

              <View style={wellnessStyles.modalActionsRow}>
                <Pressable
                  onPress={closeAlarmModal}
                  style={({ pressed }) => [
                    wellnessStyles.modalCancelBtn,
                    pressed && s.btnPressed,
                  ]}
                >
                  <Text style={wellnessStyles.modalCancelBtnText}>Cancelar</Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveAlarm}
                  disabled={savingAlarm}
                  style={({ pressed }) => [
                    wellnessStyles.modalSaveBtn,
                    savingAlarm && { opacity: 0.7 },
                    pressed && s.btnPressed,
                  ]}
                >
                  <LinearGradient
                    colors={[palette.primary, palette.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={wellnessStyles.modalSaveBtnGradient}
                  >
                    <Ionicons name="alarm" size={18} color="#FFFFFF" />
                    <Text style={wellnessStyles.modalSaveBtnText}>Guardar Alarma</Text>
                  </LinearGradient>
                </Pressable>
              </View>

              {Boolean(alarmModalSupp?.alarmTime) && (
                <Pressable
                  onPress={handleDisableAlarm}
                  disabled={savingAlarm}
                  style={({ pressed }) => [
                    wellnessStyles.modalDeleteFullBtn,
                    { marginTop: 10 },
                    pressed && s.btnPressed,
                  ]}
                >
                  <Ionicons name="notifications-off-outline" size={16} color={C.danger} />
                  <Text style={wellnessStyles.modalDeleteFullBtnText}>
                    Desactivar alarma
                  </Text>
                </Pressable>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL ALARMA SONANDO EN PANTALLA */}
      <Modal
        visible={Boolean(ringingAlarmSupp)}
        transparent
        animationType="fade"
        onRequestClose={handleStopRingingAlarm}
      >
        <View style={wellnessStyles.ringingModalBackdrop}>
          <View style={wellnessStyles.ringingCard}>
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={wellnessStyles.ringingHeaderGradient}
            >
              <View style={wellnessStyles.ringingIconCircle}>
                <Ionicons name="alarm" size={38} color="#FFFFFF" />
              </View>
              <Text style={wellnessStyles.ringingHeaderTitle}>¡HORA DE TU SUPLEMENTO!</Text>
              <Text style={wellnessStyles.ringingHeaderSubtitle}>
                {ringingAlarmSupp?.name}
              </Text>
            </LinearGradient>

            <View style={wellnessStyles.ringingBody}>
              <View style={wellnessStyles.ringingSoundTagRow}>
                <Ionicons name="musical-notes" size={15} color={palette.primary} />
                <Text style={wellnessStyles.ringingSoundTagText}>
                  Sonando: {getAlarmSoundById(ringingSoundId).name} {getAlarmSoundById(ringingSoundId).emoji}
                </Text>
              </View>

              <Text style={wellnessStyles.ringingHintText}>
                Alarma programada activa. Confirma tu toma para registrar tu progreso en Evolve.
              </Text>

              <Pressable
                onPress={handleTakeDoseFromRingingAlarm}
                style={({ pressed }) => [
                  wellnessStyles.ringingPrimaryActionBtn,
                  pressed && s.btnPressed,
                ]}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={wellnessStyles.ringingPrimaryGradient}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={wellnessStyles.ringingPrimaryBtnText}>
                    Tomar dosis y marcar toma
                  </Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={handleStopRingingAlarm}
                style={({ pressed }) => [
                  wellnessStyles.ringingSecondaryBtn,
                  pressed && s.btnPressed,
                ]}
              >
                <Ionicons name="volume-mute-outline" size={18} color={C.sub} />
                <Text style={wellnessStyles.ringingSecondaryBtnText}>
                  Detener alarma
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ==========================================================
   VARIANT SELECTOR CON DOS BOTONES (Sueño / Suplementos)
========================================================== */
function WellnessModeSegmented({
  value,
  onChange,
  palette,
}: {
  value: number;
  onChange: (v: number) => void;
  palette?: ColorPalette;
}) {
  const options = [
    { label: 'Sueño', icon: 'moon-outline' },
    { label: 'Suplementos', icon: 'medkit-outline' },
    { label: 'Salud', icon: 'pulse-outline' },
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

  const pillWidth = containerWidth > 0 ? (containerWidth - 8) / options.length : 0;
  const translateX = slideAnim.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => 4 + i * pillWidth),
  });

  const prim = palette?.primary || '#8B5CF6';
  const sec = palette?.secondary || '#EC4899';

  return (
    <View
      style={[
        s.mainSegmentedContainer,
        {
          backgroundColor: palette ? palette.bg : C.bg,
          borderColor: getPaletteColorWithAlpha(prim, 0.25),
          shadowColor: prim,
          marginBottom: 4,
        },
      ]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {containerWidth > 0 && (
        <Animated.View style={[s.slidingPill, { width: pillWidth, transform: [{ translateX }], shadowColor: prim }]}>
          <LinearGradient
            colors={[prim, sec]}
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
              size={15}
              color={active ? '#FFFFFF' : (palette?.textSub || C.sub)}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                s.mainSegmentedText,
                active
                  ? s.mainSegmentedTextActive
                  : [s.mainSegmentedTextInactive, palette && { color: palette.textSub }],
              ]}
              numberOfLines={1}
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
   ESTILOS DE LA SECCIÓN BIENESTAR
========================================================== */
const wellnessStyles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 115,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cyberTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  cyberTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.pastelPurple,
    letterSpacing: 1.1,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: C.text,
    letterSpacing: -0.5,
  },
  headerBadgeMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  headerBadgeMiniText: {
    color: C.pastelPurple,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stickyTabsContainer: {
    backgroundColor: 'transparent',
    paddingTop: 2,
    paddingBottom: 4,
    zIndex: 50,
  },

  // Tarjeta de progreso diario de suplementos
  progressCard: {
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'hidden',
  },
  progressCardGradient: {
    padding: 15,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  progressIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    color: C.text,
  },
  progressSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: C.sub,
    marginTop: 2,
  },
  progressPctPill: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  progressPctPillDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  progressPctText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#8B5CF6',
  },
  progressPctTextDone: {
    color: '#059669',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(203, 213, 225, 0.45)',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Cabecera de lista de suplementos
  listSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  listSectionTitle: {
    fontSize: 11.5,
    fontWeight: '900',
    color: C.sub,
    letterSpacing: 0.8,
  },
  modifyModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  modifyModeBtnActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  modifyModeBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#8B5CF6',
  },
  modifyModeBtnTextActive: {
    color: '#FFFFFF',
  },
  addSuppTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 11,
    backgroundColor: '#EC4899',
  },
  addSuppTopBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  editHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  editHintBannerText: {
    flex: 1,
    fontSize: 11.5,
    color: C.text,
    lineHeight: 16,
  },

  // Tarjetas de suplementos individuales
  supplementListContainer: {
    gap: 10,
  },
  supplementItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1.2,
    borderColor: C.border,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  supplementItemCardDone: {
    borderColor: 'rgba(16, 185, 129, 0.45)',
    backgroundColor: '#F8FEFC',
  },
  supplementMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  supplementInfoCol: {
    flex: 1,
  },
  supplementDotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  supplementNameText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: C.text,
  },
  supplementNameTextDone: {
    color: '#065F46',
  },
  supplementDoseSubText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: C.sub,
    marginTop: 3,
    marginLeft: 16,
  },

  // Checkboxes de dosis
  checkboxesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    maxWidth: '55%',
  },
  doseCheckboxBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: 'rgba(139, 92, 246, 0.42)',
    backgroundColor: '#FAF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  doseCheckboxBtnActive: {
    borderColor: '#10B981',
    borderWidth: 0,
  },
  doseCheckboxGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doseCheckboxEmptyInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doseCheckboxNumberHint: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(139, 92, 246, 0.65)',
  },

  // Pie de edición rápida por suplemento (- / + y quitar)
  supplementEditFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.8)',
  },
  editFooterLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: C.sub,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    paddingHorizontal: 3,
    paddingVertical: 2,
    gap: 6,
  },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#8B5CF6',
    minWidth: 18,
    textAlign: 'center',
  },
  editNameSmallBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteSuppSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: C.dangerBg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  deleteSuppSmallBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.danger,
  },

  // Botón inferior agregar suplemento
  bottomAddSuppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(139, 92, 246, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  bottomAddSuppBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#8B5CF6',
  },

  // Estado vacío
  emptyListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyListTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: C.text,
    marginTop: 8,
  },
  emptyListSub: {
    fontSize: 12,
    color: C.sub,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  emptyAddBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#8B5CF6',
  },

  // Tarjeta Smartband & Apple Health
  smartbandCard: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  smartbandCardGradient: {
    padding: 16,
  },
  smartbandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  smartbandIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartbandTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  smartbandSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  syncMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 14,
  },
  syncMetaText: {
    fontSize: 12,
  },
  healthKitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  healthKitPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  syncNowBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  syncNowBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  syncNowBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  feedbackBannerText: {
    fontSize: 12,
    flex: 1,
    fontWeight: '600',
  },

  // Tarjeta Resumen Sueño de Anoche
  sleepSummaryCard: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  sleepSummaryGradient: {
    padding: 16,
  },
  sleepCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sleepMoonBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sleepCardSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  sleepScorePill: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  sleepScorePillNum: {
    fontSize: 16,
    fontWeight: '900',
  },
  sleepScorePillLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sleepBigTimeContainer: {
    alignItems: 'center',
    marginVertical: 6,
  },
  sleepBigTimeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  sleepBigTimeNum: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
  },
  sleepBigTimeUnit: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 3,
  },
  sleepMetaPercentText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  sleepTargetTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 12,
  },
  sleepTargetFill: {
    height: '100%',
    borderRadius: 4,
  },
  sleepScheduleRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  sleepScheduleBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  sleepScheduleLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  sleepScheduleVal: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  phasesContainer: {
    marginTop: 12,
    paddingTop: 12,
  },
  phasesTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  phasesBarTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 10,
  },
  phasesLegendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  phaseLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: '45%',
  },
  phaseLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseLegendName: {
    fontSize: 11,
  },
  qualityNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  qualityNoteText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },

  // Tarjeta Calorías Quemadas y Actividad Smartband
  burnedCaloriesCard: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  burnedCaloriesGradient: {
    padding: 16,
  },
  burnedFlameBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceDeviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  sourceDeviceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  burnedCaloriesHero: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: 10,
  },
  burnedCaloriesNum: {
    fontSize: 34,
    fontWeight: '900',
  },
  burnedCaloriesUnit: {
    fontSize: 15,
    fontWeight: '800',
  },
  burnedCaloriesSubText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  watchMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  watchMetricBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  watchMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  watchMetricVal: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },

  // Botón Edición Manual
  manualEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  manualEditBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Modal Inputs
  inputFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  inputFieldSubLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  modalTextInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  saveSleepBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 16,
  },
  saveSleepBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  saveSleepBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // Botón Calibrar Rápido
  calibrateQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  calibrateQuickBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Aviso Fechas Futuras
  futureDateNoticeCard: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  futureDateNoticeGradient: {
    padding: 24,
    alignItems: 'center',
  },
  futureIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  futureNoticeTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  futureNoticeSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  backToTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  backToTodayBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },

  // Caja de Día Vacío
  emptyDayBox: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  emptyDayText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },

  // Gráfica Histórica de Sueño y Calorías
  historyChartCard: {
    marginTop: 10,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  historyChartGradient: {
    padding: 14,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  historySubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  chartToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
  },
  chartToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartToggleBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  historyLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  historyLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyLegendText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Modal Agregar / Modificar Suplemento
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: '900',
    color: C.text,
  },
  modalSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: C.sub,
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    color: C.sub,
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14.5,
    fontWeight: '700',
    color: C.text,
  },
  modalTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  modalStepperCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTargetCenterBox: {
    alignItems: 'center',
  },
  modalTargetBigNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#8B5CF6',
  },
  modalTargetUnitText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: C.sub,
    marginTop: 1,
  },
  previewCheckboxesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  previewCheckboxChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  previewCheckboxChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8B5CF6',
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: C.sub,
  },
  modalSaveBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  modalSaveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  modalSaveBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalDeleteFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: C.dangerBg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  modalDeleteFullBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: C.danger,
  },

  // Botón de icono de reloj debajo de las veces al día
  alarmClockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 6,
    marginLeft: 16,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.32)',
  },
  alarmClockBtnActive: {
    backgroundColor: '#F5F3FF',
    borderColor: 'rgba(139, 92, 246, 0.42)',
    paddingHorizontal: 9,
  },
  alarmClockBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8B5CF6',
  },

  // Selector de hora en el Modal Programar Alarma
  alarmPickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  alarmTimeUnitCol: {
    alignItems: 'center',
    gap: 5,
  },
  alarmStepBtn: {
    width: 44,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alarmDigitInput: {
    width: 66,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    textAlign: 'center',
    fontSize: 25,
    fontWeight: '900',
    color: C.text,
    paddingVertical: 0,
  },
  alarmUnitCaption: {
    fontSize: 9.5,
    fontWeight: '900',
    color: C.sub,
    letterSpacing: 0.8,
  },
  alarmColonText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#8B5CF6',
    marginBottom: 14,
  },
  alarmPeriodCol: {
    gap: 8,
    marginLeft: 4,
    marginBottom: 12,
  },
  alarmPeriodBtn: {
    width: 52,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  alarmPeriodBtnActive: {
    borderWidth: 0,
  },
  alarmPeriodGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alarmPeriodText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: C.sub,
  },
  alarmPeriodTextActive: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  alarmPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  alarmPresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: C.border,
  },
  alarmPresetChipActive: {
    backgroundColor: '#F5F3FF',
    borderColor: 'rgba(139, 92, 246, 0.45)',
  },
  alarmPresetChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: C.sub,
  },
  alarmPresetChipTextActive: {
    color: '#8B5CF6',
    fontWeight: '900',
  },
  alarmClockBtnPlaceholderText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.sub,
  },

  // Selector de tonos de alarma
  soundHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  soundCountHint: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8B5CF6',
    letterSpacing: 0.5,
  },
  soundListWrap: {
    gap: 7,
  },
  soundItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: C.border,
  },
  soundItemCardActive: {
    backgroundColor: '#FAF5FF',
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  soundRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.6,
    borderColor: 'rgba(148, 163, 184, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  soundRadioCircleActive: {
    borderColor: '#8B5CF6',
  },
  soundRadioInnerDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#8B5CF6',
  },
  soundEmoji: {
    fontSize: 17,
    marginLeft: 8,
  },
  soundNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
  },
  soundNameTextActive: {
    color: '#7C3AED',
  },
  soundDescText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: C.sub,
    marginTop: 1,
  },
  soundPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  soundPlayBtnActive: {
    backgroundColor: '#FDF2F8',
    borderColor: 'rgba(236, 72, 153, 0.4)',
  },
  soundPlayBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: C.sub,
  },
  soundPlayBtnTextActive: {
    color: '#EC4899',
  },
  testAlarmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  testAlarmBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8B5CF6',
  },

  // Modal Alarma Sonando en Vivo
  ringingModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  ringingCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 15,
  },
  ringingHeaderGradient: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringingIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginBottom: 12,
  },
  ringingHeaderTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  ringingHeaderSubtitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'center',
  },
  ringingBody: {
    padding: 20,
    alignItems: 'center',
  },
  ringingSoundTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    marginBottom: 10,
  },
  ringingSoundTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8B5CF6',
  },
  ringingHintText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.sub,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  ringingPrimaryActionBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    marginBottom: 10,
  },
  ringingPrimaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  ringingPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  ringingSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  ringingSecondaryBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: C.sub,
  },
});


/* ==========================================================
   FUNCIÓN DE EVALUACIÓN CLÍNICA DE SALUD (ORIENTATIVA)
========================================================== */
function getHealthStatus(metricId: string, val?: number, val2?: number) {
  if (val === undefined || val === null || val <= 0) return null;
  if (metricId === 'presion') {
    const sys = val;
    const dia = val2 || 0;
    if (sys < 120 && dia < 80) return { label: 'Óptima', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' };
    if (sys <= 129 && dia < 80) return { label: 'Normal', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' };
    if ((sys >= 130 && sys <= 139) || (dia >= 80 && dia <= 89))
      return { label: 'Elevada (HTA 1)', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' };
    return { label: 'Alta (HTA 2)', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' };
  }
  if (metricId === 'azucar') {
    if (val < 70) return { label: 'Baja (Hipoglucemia)', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' };
    if (val <= 100) return { label: 'Normal', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' };
    if (val <= 125) return { label: 'Pre-alerta', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' };
    return { label: 'Elevada', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' };
  }
  if (metricId === 'colesterol') {
    if (val < 200) return { label: 'Deseable', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' };
    if (val <= 239) return { label: 'Límite', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' };
    return { label: 'Alto', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' };
  }
  if (metricId === 'trigliceridos') {
    if (val < 150) return { label: 'Normal', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' };
    if (val <= 199) return { label: 'Límite alto', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' };
    return { label: 'Alto', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' };
  }
  return { label: 'Registrado', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' };
}

/* ==========================================================
   GRÁFICA HISTÓRICA SVG DE SUEÑO Y CALORÍAS (ÚLTIMOS 7 DÍAS)
========================================================== */
function SleepAndCaloriesHistoricalChart({
  logs,
  selectedDateKey,
  onSelectDateKey,
  palette,
  titleFont,
  subtitleFont,
  dataFont,
}: {
  logs: Record<string, SleepLogEntry>;
  selectedDateKey: string;
  onSelectDateKey: (k: string) => void;
  palette: ColorPalette;
  titleFont?: string;
  subtitleFont?: string;
  dataFont?: string;
}) {
  const [chartMode, setChartMode] = useState<'both' | 'sleep' | 'calories'>('both');
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(280, screenWidth - 64);
  const chartHeight = 120;
  const bottomAxisHeight = 32;
  const topPadding = 18;
  const drawHeight = chartHeight - topPadding;

  // Obtenemos los últimos 7 días terminando en HOY (nunca fechas futuras)
  const past7Days = React.useMemo(() => {
    const list: Array<{
      dateKey: string;
      dayName: string;
      dayNum: number;
      sleepHours: number;
      sleepMinutes: number;
      calories: number;
      hasData: boolean;
    }> = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = dateKey(d);
      const entry = logs[k] || SEED_SLEEP_LOGS[k];
      const has = !!entry && (entry.hours > 0 || (entry.activeCaloriesBurned ?? 0) > 0);
      const hours = entry ? entry.hours + (entry.minutes || 0) / 60 : 0;
      const cals = entry ? entry.activeCaloriesBurned || 0 : 0;
      list.push({
        dateKey: k,
        dayName: dayNames[d.getDay()],
        dayNum: d.getDate(),
        sleepHours: hours,
        sleepMinutes: entry?.minutes || 0,
        calories: cals,
        hasData: has,
      });
    }
    return list;
  }, [logs]);

  // Cálculos de promedios para los días con datos
  const daysWithSleep = past7Days.filter((d) => d.sleepHours > 0);
  const avgSleepH =
    daysWithSleep.length > 0
      ? daysWithSleep.reduce((acc, d) => acc + d.sleepHours, 0) / daysWithSleep.length
      : 0;
  const avgSleepHoursInt = Math.floor(avgSleepH);
  const avgSleepMinutesInt = Math.round((avgSleepH - avgSleepHoursInt) * 60);

  const daysWithCal = past7Days.filter((d) => d.calories > 0);
  const avgCalories =
    daysWithCal.length > 0
      ? Math.round(daysWithCal.reduce((acc, d) => acc + d.calories, 0) / daysWithCal.length)
      : 0;

  // Escalas
  const maxSleepScale = 10; // escala de 10 horas
  const maxCaloriesScale = Math.max(800, ...past7Days.map((d) => d.calories)) * 1.15;

  const colWidth = chartWidth / 7;
  const barWidth = chartMode === 'both' ? 10 : 18;

  // Animación de entrada de la gráfica (Crecimiento de barras y elevación fluida de la tarjeta)
  const entryAnim = useRef(new Animated.Value(0)).current;
  const [growProgress, setGrowProgress] = useState(0);

  useEffect(() => {
    entryAnim.setValue(0);
    setGrowProgress(0);
    const listenerId = entryAnim.addListener(({ value }) => {
      setGrowProgress(value);
    });
    Animated.timing(entryAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    return () => {
      entryAnim.removeListener(listenerId);
    };
  }, [chartMode]);

  const cardTranslateY = entryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const cardScale = entryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1],
  });

  return (
    <Animated.View
      style={[
        wellnessStyles.historyChartCard,
        {
          backgroundColor: 'transparent',
          borderColor: getPaletteColorWithAlpha(palette.primary, 0.25),
          opacity: entryAnim,
          transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
        },
      ]}
    >
      <LinearGradient
        colors={
          palette.isDark
            ? ['#1E293B', '#0F172A']
            : ['#FFFFFF', '#F8FAFF']
        }
        style={wellnessStyles.historyChartGradient}
      >
        {/* Encabezado de la gráfica con selector de vista */}
        <View style={wellnessStyles.historyHeaderRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="bar-chart-outline" size={16} color={palette.primary} />
              <Text style={[wellnessStyles.historyTitle, { color: palette.text, fontFamily: titleFont }]}>
                Histórico (7 Días)
              </Text>
            </View>
            <Text style={[wellnessStyles.historySubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
              {chartMode === 'sleep'
                ? `Promedio: ${avgSleepHoursInt}h ${avgSleepMinutesInt}m de sueño`
                : chartMode === 'calories'
                ? `Promedio: ${avgCalories} kcal activas / día`
                : `Promedio: ${avgSleepHoursInt}h ${avgSleepMinutesInt}m · ${avgCalories} kcal`}
            </Text>
          </View>

          {/* Toggle de vistas: Ambos / Sueño / Calorías */}
          <View style={[wellnessStyles.chartToggleContainer, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <Pressable
              onPress={() => setChartMode('both')}
              style={[
                wellnessStyles.chartToggleBtn,
                chartMode === 'both' && { backgroundColor: palette.primary },
              ]}
            >
              <Text
                style={[
                  wellnessStyles.chartToggleBtnText,
                  { color: chartMode === 'both' ? '#FFFFFF' : palette.textSub, fontFamily: subtitleFont },
                ]}
              >
                Ambos
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setChartMode('sleep')}
              style={[
                wellnessStyles.chartToggleBtn,
                chartMode === 'sleep' && { backgroundColor: palette.primary },
              ]}
            >
              <Ionicons
                name="moon"
                size={11}
                color={chartMode === 'sleep' ? '#FFFFFF' : palette.primary}
              />
            </Pressable>

            <Pressable
              onPress={() => setChartMode('calories')}
              style={[
                wellnessStyles.chartToggleBtn,
                chartMode === 'calories' && { backgroundColor: palette.secondary },
              ]}
            >
              <Ionicons
                name="flame"
                size={11}
                color={chartMode === 'calories' ? '#FFFFFF' : palette.secondary}
              />
            </Pressable>
          </View>
        </View>

        {/* Gráfica SVG */}
        <View style={{ width: chartWidth, height: chartHeight + bottomAxisHeight, marginTop: 4 }}>
          <Svg width={chartWidth} height={chartHeight + bottomAxisHeight}>
            <Defs>
              <SvgGradient id="sleepBarGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={palette.primary} stopOpacity="1" />
                <Stop offset="1" stopColor={palette.primary} stopOpacity="0.65" />
              </SvgGradient>
              <SvgGradient id="calBarGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={palette.secondary} stopOpacity="1" />
                <Stop offset="1" stopColor={palette.secondary} stopOpacity="0.65" />
              </SvgGradient>
            </Defs>

            {/* Línea horizontal de meta / promedio de sueño (8h) */}
            {(chartMode === 'sleep' || chartMode === 'both') && (
              <>
                <Line
                  x1={8}
                  y1={topPadding + drawHeight * (1 - 8 / maxSleepScale)}
                  x2={chartWidth - 8}
                  y2={topPadding + drawHeight * (1 - 8 / maxSleepScale)}
                  stroke={palette.border}
                  strokeDasharray="4, 4"
                  strokeWidth={1}
                />
                <SvgText
                  x={chartWidth - 10}
                  y={topPadding + drawHeight * (1 - 8 / maxSleepScale) - 4}
                  fill={palette.textSub}
                  fontSize="8.5"
                  fontWeight="600"
                  textAnchor="end"
                >
                  Meta 8h
                </SvgText>
              </>
            )}

            {/* Línea base */}
            <Line
              x1={4}
              y1={chartHeight}
              x2={chartWidth - 4}
              y2={chartHeight}
              stroke={palette.border}
              strokeWidth={1}
            />

            {/* Columnas por día */}
            {past7Days.map((d, i) => {
              const centerX = i * colWidth + colWidth / 2;
              const isSelected = d.dateKey === selectedDateKey;

              const sleepHeight = Math.max(0, Math.min(drawHeight, (d.sleepHours / maxSleepScale) * drawHeight * Math.max(0.001, growProgress)));
              const sleepY = chartHeight - sleepHeight;

              const calHeight = Math.max(0, Math.min(drawHeight, (d.calories / maxCaloriesScale) * drawHeight * Math.max(0.001, growProgress)));
              const calY = chartHeight - calHeight;

              return (
                <G key={d.dateKey}>
                  {/* Resalte si es el día seleccionado */}
                  {isSelected && (
                    <Rect
                      x={i * colWidth + 2}
                      y={4}
                      width={colWidth - 4}
                      height={chartHeight + bottomAxisHeight - 6}
                      rx={8}
                      fill={`${palette.primary}18`}
                      stroke={palette.primary}
                      strokeWidth={1}
                    />
                  )}

                  {/* Barras según el modo */}
                  {chartMode === 'sleep' && (
                    <>
                      {d.hasData && d.sleepHours > 0 ? (
                        <>
                          <Rect
                            x={centerX - barWidth / 2}
                            y={sleepY}
                            width={barWidth}
                            height={sleepHeight}
                            rx={barWidth / 2}
                            fill="url(#sleepBarGrad)"
                          />
                          <SvgText
                            x={centerX}
                            y={sleepY - 4}
                            fill={isSelected ? palette.primary : palette.text}
                            fontSize="8.5"
                            fontWeight="700"
                            textAnchor="middle"
                          >
                            {d.sleepHours.toFixed(1)}h
                          </SvgText>
                        </>
                      ) : (
                        <Circle cx={centerX} cy={chartHeight - 4} r={3} fill={palette.border} />
                      )}
                    </>
                  )}

                  {chartMode === 'calories' && (
                    <>
                      {d.hasData && d.calories > 0 ? (
                        <>
                          <Rect
                            x={centerX - barWidth / 2}
                            y={calY}
                            width={barWidth}
                            height={calHeight}
                            rx={barWidth / 2}
                            fill="url(#calBarGrad)"
                          />
                          <SvgText
                            x={centerX}
                            y={calY - 4}
                            fill={isSelected ? palette.secondary : palette.text}
                            fontSize="8.5"
                            fontWeight="700"
                            textAnchor="middle"
                          >
                            {d.calories}
                          </SvgText>
                        </>
                      ) : (
                        <Circle cx={centerX} cy={chartHeight - 4} r={3} fill={palette.border} />
                      )}
                    </>
                  )}

                  {chartMode === 'both' && (
                    <>
                      {/* Barra de Sueño */}
                      {d.hasData && d.sleepHours > 0 ? (
                        <Rect
                          x={centerX - barWidth - 1}
                          y={sleepY}
                          width={barWidth}
                          height={sleepHeight}
                          rx={barWidth / 2}
                          fill="url(#sleepBarGrad)"
                        />
                      ) : (
                        <Circle cx={centerX - barWidth / 2 - 1} cy={chartHeight - 4} r={2} fill={palette.border} />
                      )}

                      {/* Barra de Calorías */}
                      {d.hasData && d.calories > 0 ? (
                        <Rect
                          x={centerX + 1}
                          y={calY}
                          width={barWidth}
                          height={calHeight}
                          rx={barWidth / 2}
                          fill="url(#calBarGrad)"
                        />
                      ) : (
                        <Circle cx={centerX + barWidth / 2 + 1} cy={chartHeight - 4} r={2} fill={palette.border} />
                      )}
                    </>
                  )}

                  {/* Etiquetas de día */}
                  <SvgText
                    x={centerX}
                    y={chartHeight + 15}
                    fill={isSelected ? palette.primary : palette.textSub}
                    fontSize="9.5"
                    fontWeight={isSelected ? '800' : '600'}
                    textAnchor="middle"
                  >
                    {d.dayName}
                  </SvgText>

                  <SvgText
                    x={centerX}
                    y={chartHeight + 26}
                    fill={isSelected ? palette.primary : palette.textSub}
                    fontSize="8.5"
                    fontWeight={isSelected ? '800' : '500'}
                    textAnchor="middle"
                  >
                    {d.dayNum}
                  </SvgText>
                </G>
              );
            })}
          </Svg>

          {/* Áreas táctiles transparentes sobre cada columna para seleccionar el día con 1 toque */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <View style={{ flexDirection: 'row', height: '100%' }}>
              {past7Days.map((d) => (
                <Pressable
                  key={d.dateKey}
                  style={{ flex: 1, height: '100%' }}
                  onPress={() => onSelectDateKey(d.dateKey)}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Leyenda en modo Both */}
        {chartMode === 'both' && (
          <View style={[wellnessStyles.historyLegendRow, { borderColor: palette.border }]}>
            <View style={wellnessStyles.historyLegendItem}>
              <View style={[wellnessStyles.historyLegendDot, { backgroundColor: palette.primary }]} />
              <Text style={[wellnessStyles.historyLegendText, { color: palette.textSub, fontFamily: subtitleFont }]}>
                🌙 Sueño (Horas)
              </Text>
            </View>
            <View style={wellnessStyles.historyLegendItem}>
              <View style={[wellnessStyles.historyLegendDot, { backgroundColor: palette.secondary }]} />
              <Text style={[wellnessStyles.historyLegendText, { color: palette.textSub, fontFamily: subtitleFont }]}>
                🔥 Calorías (kcal)
              </Text>
            </View>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

/* ==========================================================
   GRÁFICA SVG DINÁMICA DE SALUD
========================================================== */
function HealthMetricsSVGChart({
  metric,
  logs,
  currentDateKey,
}: {
  metric: HealthMetricDefinition;
  logs: Record<string, Record<string, HealthLogEntry>>;
  currentDateKey: string;
}) {
  const screenWidth = Dimensions.get('window').width;
  const width = Math.max(280, screenWidth - 68);
  const height = 150;
  const paddingX = 26;
  const paddingY = 24;

  const entries: Array<{ dateStr: string; val: number; val2?: number }> = [];
  Object.keys(logs)
    .sort()
    .forEach((d) => {
      const entry = logs[d]?.[metric.id];
      if (entry && entry.value !== undefined && entry.value > 0) {
        entries.push({ dateStr: d, val: entry.value, val2: entry.secondaryValue });
      }
    });

  if (entries.length === 0) {
    return (
      <View style={healthStyles.emptyChartBox}>
        <Ionicons name="pulse-outline" size={34} color="#CBD5E1" />
        <Text style={healthStyles.emptyChartTitle}>Sin registros previos de {metric.name}</Text>
        <Text style={healthStyles.emptyChartSub}>
          Ingresa el valor del día en la lista de abajo para comenzar a graficar la tendencia.
        </Text>
      </View>
    );
  }

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (entries.length > 0) {
      const matchIdx = entries.findIndex((e) => e.dateStr === currentDateKey);
      setSelectedIdx(matchIdx >= 0 ? matchIdx : entries.length - 1);
    } else {
      setSelectedIdx(null);
    }
  }, [entries.length, currentDateKey, metric.id]);

  const allVals = entries.flatMap((e) => [e.val, e.val2 || e.val]);
  const minVal = Math.max(0, Math.min(...allVals) - 10);
  const maxVal = Math.max(...allVals) + 10;
  const range = maxVal - minVal || 1;

  const points = entries.map((e, i) => {
    const x =
      entries.length === 1
        ? width / 2
        : paddingX + (i / (entries.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((e.val - minVal) / range) * (height - paddingY * 2);
    const y2 =
      e.val2 !== undefined
        ? height - paddingY - ((e.val2 - minVal) / range) * (height - paddingY * 2)
        : undefined;
    return { x, y, y2, val: e.val, val2: e.val2, dateStr: e.dateStr };
  });

  const activeIdx =
    selectedIdx !== null && selectedIdx >= 0 && selectedIdx < points.length
      ? selectedIdx
      : points.length > 0
      ? points.length - 1
      : null;

  // Fechas espaciadas uniformemente para el eje inferior (máximo 4 a 5)
  const sampledDateIndices = React.useMemo(() => {
    if (points.length <= 5) {
      return points.map((_, i) => i);
    }
    const count = 4;
    const step = (points.length - 1) / (count - 1);
    const indices: number[] = [];
    for (let i = 0; i < count; i++) {
      indices.push(Math.round(i * step));
    }
    return Array.from(new Set(indices));
  }, [points.length]);

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = prev.x + (curr.x - prev.x) / 2;
    pathD += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const fillD = `${pathD} L ${points[points.length - 1].x} ${height - 18} L ${points[0].x} ${height - 18} Z`;

  let pathD2 = '';
  if (metric.isDualValue && points[0].y2 !== undefined) {
    pathD2 = `M ${points[0].x} ${points[0].y2}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (curr.y2 !== undefined && prev.y2 !== undefined) {
        const cpX = prev.x + (curr.x - prev.x) / 2;
        pathD2 += ` C ${cpX} ${prev.y2}, ${cpX} ${curr.y2}, ${curr.x} ${curr.y2}`;
      }
    }
  }

  return (
    <View style={{ width, height, marginTop: 8 }}>
      {metric.isDualValue && (
        <View style={healthStyles.dualLegendRow}>
          <View style={healthStyles.legendItem}>
            <View style={[healthStyles.legendDot, { backgroundColor: '#EC4899' }]} />
            <Text style={healthStyles.legendText}>Sistólica</Text>
          </View>
          <View style={healthStyles.legendItem}>
            <View style={[healthStyles.legendDot, { backgroundColor: '#8B5CF6' }]} />
            <Text style={healthStyles.legendText}>Diastólica</Text>
          </View>
        </View>
      )}

      <Svg width={width} height={height}>
        <Defs>
          <SvgGradient id="healthCurveGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={metric.color} stopOpacity="0.24" />
            <Stop offset="1" stopColor={metric.color} stopOpacity="0.01" />
          </SvgGradient>
        </Defs>

        {/* Línea base */}
        <Line
          x1={paddingX}
          y1={height - 18}
          x2={width - paddingX}
          y2={height - 18}
          stroke="rgba(203, 213, 225, 0.4)"
          strokeWidth={1}
        />

        {/* Área rellena bajo la curva */}
        {!metric.isDualValue && points.length > 1 && (
          <Path d={fillD} fill="url(#healthCurveGrad)" />
        )}

        {/* Curva principal */}
        {points.length > 1 && (
          <Path
            d={pathD}
            fill="none"
            stroke={metric.color}
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}

        {/* Curva 2 (para Diastólica) */}
        {metric.isDualValue && points.length > 1 && pathD2 ? (
          <Path
            d={pathD2}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ) : null}

        {/* Puntos y valores */}
        {points.map((p, idx) => {
          const isActive = idx === activeIdx;
          const isCrowded = points.length > 12;
          const showValue = points.length <= 6 || isActive;
          const showDate = sampledDateIndices.includes(idx);
          const labelDate = p.dateStr.slice(5).replace('-', '/');

          return (
            <G key={idx} onPress={() => setSelectedIdx(idx)}>
              {/* Área táctil amplia invisible */}
              <Circle cx={p.x} cy={p.y} r={16} fill="transparent" />

              {isActive && (
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={9}
                  fill="none"
                  stroke={metric.color}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                />
              )}
              <Circle
                cx={p.x}
                cy={p.y}
                r={isActive ? 5.5 : isCrowded ? 2.5 : 4}
                fill={isActive ? '#FFFFFF' : metric.color}
                stroke={metric.color}
                strokeWidth={isActive ? 2.5 : 1}
              />

              {showValue && (
                <SvgText
                  x={p.x}
                  y={p.y - 8}
                  fontSize={isActive ? 11 : 9.5}
                  fontWeight={isActive ? '900' : 'bold'}
                  fill={isActive ? metric.color : '#334155'}
                  textAnchor="middle"
                >
                  {p.val}
                </SvgText>
              )}

              {p.y2 !== undefined && (
                <>
                  <Circle
                    cx={p.x}
                    cy={p.y2}
                    r={isActive ? 5.5 : isCrowded ? 2.5 : 4}
                    fill={isActive ? '#FFFFFF' : '#8B5CF6'}
                    stroke="#8B5CF6"
                    strokeWidth={isActive ? 2.5 : 1}
                  />
                  {showValue && (
                    <SvgText
                      x={p.x}
                      y={p.y2 + 14}
                      fontSize={isActive ? 11 : 9.5}
                      fontWeight={isActive ? '900' : 'bold'}
                      fill={isActive ? '#8B5CF6' : '#64748B'}
                      textAnchor="middle"
                    >
                      {p.val2}
                    </SvgText>
                  )}
                </>
              )}

              {showDate && (
                <SvgText
                  x={p.x}
                  y={height - 4}
                  fontSize={8.5}
                  fontWeight={isActive ? '800' : '600'}
                  fill={isActive ? metric.color : '#94A3B8'}
                  textAnchor="middle"
                >
                  {labelDate}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

/* ==========================================================
   MODAL PARA AGREGAR NUEVA MÉTRICA DE SALUD
========================================================== */
function AddHealthMetricModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (m: Omit<HealthMetricDefinition, 'id'>) => void;
}) {
  const palette = getActivePalette(useStore.getState());
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('mg/dL');
  const [idealRange, setIdealRange] = useState('');
  const [isDual, setIsDual] = useState(false);

  const QUICK_UNITS = ['mg/dL', 'mmHg', '%', 'bpm', 'g/dL', 'mmol/L'];
  const COLORS = ['#EC4899', '#06B6D4', '#F59E0B', '#8B5CF6', '#10B981', '#6366F1'];
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={healthStyles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={healthStyles.modalSheet}
        >
          <View style={healthStyles.modalSheetContent}>
            <LinearGradient colors={[getPaletteColorWithAlpha(palette.primary, 0.08), getPaletteColorWithAlpha(palette.primary, 0.02)]} style={{ padding: 20 }}>
              <View style={healthStyles.sheetHandleBar} />

              <View style={healthStyles.modalHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={healthStyles.modalTitle}>NUEVA MÉTRICA DE SALUD</Text>
                  <Text style={healthStyles.modalSubtitle}>
                    Personaliza el biomarcador para tu seguimiento médico
                  </Text>
                </View>
                <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
                  <Ionicons name="close" size={20} color={C.text} />
                </Pressable>
              </View>

              {/* Nombre */}
              <Text style={healthStyles.fieldLabel}>Nombre del biomarcador</Text>
              <View style={[healthStyles.fieldInputBox, { marginBottom: 12 }]}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Ej. Saturación O2, Ácido Úrico, Hemoglobina..."
                  placeholderTextColor="#94A3B8"
                  style={healthStyles.fieldTextInput}
                  autoFocus
                />
              </View>

              {/* Unidad de medida rápida */}
              <Text style={healthStyles.fieldLabel}>Unidad de medida</Text>
              <View style={healthStyles.quickUnitsRow}>
                {QUICK_UNITS.map((u) => {
                  const active = unit === u;
                  return (
                    <Pressable
                      key={u}
                      onPress={() => setUnit(u)}
                      style={[
                        healthStyles.unitChip,
                        active && healthStyles.unitChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          healthStyles.unitChipText,
                          active && healthStyles.unitChipTextActive,
                        ]}
                      >
                        {u}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Rango ideal */}
              <Text style={healthStyles.fieldLabel}>Rango o meta deseable (Opcional)</Text>
              <View style={[healthStyles.fieldInputBox, { marginBottom: 14 }]}>
                <TextInput
                  value={idealRange}
                  onChangeText={setIdealRange}
                  placeholder="Ej. 95 - 100%, < 6 mg/dL..."
                  placeholderTextColor="#94A3B8"
                  style={healthStyles.fieldTextInput}
                />
              </View>

              {/* Selección de color */}
              <Text style={healthStyles.fieldLabel}>Color identificativo</Text>
              <View style={healthStyles.colorRow}>
                {COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setSelectedColor(c)}
                    style={[
                      healthStyles.colorDot,
                      { backgroundColor: c },
                      selectedColor === c && healthStyles.colorDotActive,
                    ]}
                  />
                ))}
              </View>

              {/* Botón Guardar */}
              <View style={{ marginTop: 18 }}>
                <PrimaryButton
                  label="Guardar métrica"
                  icon="checkmark-circle"
                  onPress={() => {
                    if (!name.trim()) {
                      Alert.alert('Nombre requerido', 'Ingresa el nombre del biomarcador o métrica.');
                      return;
                    }
                    onSave({
                      name: name.trim(),
                      unit: unit.trim() || 'mg/dL',
                      idealRange: idealRange.trim() || undefined,
                      icon: 'fitness-outline',
                      color: selectedColor,
                      isDualValue: isDual,
                      custom: true,
                    });
                  }}
                />
              </View>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ==========================================================
   PESTAÑA 3: SECCIÓN SALUD Y BIOMARCADORES
========================================================== */
function HealthSection({
  date,
  setDate,
}: {
  date: Date;
  setDate: (d: Date) => void;
}) {
  const {
    healthMetrics: rawHealthMetrics,
    healthLogs: rawHealthLogs,
    setHealthLog,
    addHealthMetric,
    deleteHealthMetric,
  } = useStore();

  const healthMetrics =
    rawHealthMetrics && Array.isArray(rawHealthMetrics) && rawHealthMetrics.length > 0
      ? rawHealthMetrics
      : SEED_HEALTH_METRICS;
  const healthLogs = rawHealthLogs || SEED_HEALTH_LOGS;

  const activePaletteId = useStore((s) => s.activePaletteId);
  const customPalettes = useStore((s) => s.customPalettes);
  const palette = getActivePalette({ activePaletteId, customPalettes });
  const [selectedChartMetricId, setSelectedChartMetricId] = useState<string>('presion');
  const [modalOpen, setModalOpen] = useState(false);

  const key = dateKey(date);
  const dayData = (healthLogs && healthLogs[key]) || {};
  const selectedMetric =
    (healthMetrics && healthMetrics.find((m) => m.id === selectedChartMetricId)) ||
    (healthMetrics && healthMetrics[0]) ||
    SEED_HEALTH_METRICS[0];

  const updateMetricValue = (
    metricId: string,
    val?: number,
    secondaryVal?: number,
    notes?: string,
  ) => {
    const existing = dayData[metricId] || {};
    setHealthLog(key, metricId, {
      ...existing,
      value: val !== undefined ? val : existing.value,
      secondaryValue: secondaryVal !== undefined ? secondaryVal : existing.secondaryValue,
      notes: notes !== undefined ? notes : existing.notes,
    });
  };

  return (
    <View style={{ marginTop: 2 }}>
      {/* 1. GRÁFICA DE DATOS ARRIBA */}
      <View style={[healthStyles.chartOuterCard, { backgroundColor: 'transparent', borderColor: getPaletteColorWithAlpha(palette.primary, 0.25), shadowColor: palette.primary }]}>
        <LinearGradient
          colors={[getPaletteColorWithAlpha(palette.primary, 0.08), getPaletteColorWithAlpha(palette.primary, 0.02)]}
          style={healthStyles.chartGradientWrap}
        >
          {/* Header de la Gráfica */}
          <View style={healthStyles.chartHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={healthStyles.chartTagBadge}>
                <Ionicons name="analytics-outline" size={12} color={palette.primary} />
                <Text style={[healthStyles.chartTagText, { color: palette.primary }]}>EVOLUCIÓN CLÍNICA Y TENDENCIA</Text>
              </View>
              <Text style={healthStyles.chartTitleText}>{selectedMetric.name}</Text>
            </View>

            <View style={healthStyles.idealPill}>
              <Text style={healthStyles.idealPillLabel}>Meta ideal</Text>
              <Text style={healthStyles.idealPillVal}>{selectedMetric.idealRange || '-'}</Text>
            </View>
          </View>

          {/* Selector de Píldoras para alternar la métrica en la gráfica */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={healthStyles.metricPillsRow}
          >
            {healthMetrics.map((m) => {
              const active = selectedChartMetricId === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setSelectedChartMetricId(m.id)}
                  style={[
                    healthStyles.metricPillBtn,
                    active && {
                      backgroundColor: m.color,
                      borderColor: m.color,
                    },
                  ]}
                >
                  <Ionicons
                    name={m.icon as any}
                    size={13}
                    color={active ? '#FFFFFF' : '#64748B'}
                  />
                  <Text
                    style={[
                      healthStyles.metricPillText,
                      active && healthStyles.metricPillTextActive,
                    ]}
                  >
                    {m.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Gráfica SVG Dinámica */}
          <HealthMetricsSVGChart
            metric={selectedMetric}
            logs={healthLogs}
            currentDateKey={key}
          />
        </LinearGradient>
      </View>

      {/* 2. BOTÓN DE CALENDARIO DEBAJO */}
      <View style={{ marginTop: 8 }}>
        <DateSelector date={date} onChange={setDate} />
      </View>

      {/* 3. LISTADO DE MÉTRICAS */}
      <View style={{ marginTop: 4 }}>
        <View style={healthStyles.listHeaderRow}>
          <Text style={[healthStyles.listHeaderTitle, { color: palette.primary }]}>
            ✦ REGISTRO DEL DÍA (
            {date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()}
            )
          </Text>
          <Text style={healthStyles.listHeaderSub}>Toca los valores para registrar</Text>
        </View>

        {healthMetrics.map((m) => {
          const entry = dayData[m.id];
          const val = entry?.value;
          const val2 = entry?.secondaryValue;
          const status = getHealthStatus(m.id, val, val2);

          return (
            <View key={m.id} style={healthStyles.metricCard}>
              <LinearGradient
                colors={[getPaletteColorWithAlpha(palette.primary, 0.08), getPaletteColorWithAlpha(palette.primary, 0.02)]}
                style={healthStyles.metricCardGradient}
              >
                {/* Cabecera de la Tarjeta */}
                <View style={healthStyles.cardTopRow}>
                  <View style={healthStyles.cardIconTitleWrap}>
                    <View style={[healthStyles.metricIconOrb, { backgroundColor: m.color + '18' }]}>
                      <Ionicons name={m.icon as any} size={18} color={m.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={healthStyles.metricCardName}>{m.name}</Text>
                        {status && (
                          <View style={[healthStyles.statusPill, { backgroundColor: status.bg }]}>
                            <Text style={[healthStyles.statusPillText, { color: status.color }]}>
                              {status.label}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={healthStyles.metricIdealSub}>
                        Meta deseable: <Text style={{ fontWeight: '700' }}>{m.idealRange || '-'}</Text>
                      </Text>
                    </View>
                  </View>

                  {m.custom && (
                    <Pressable
                      onPress={() => {
                        Alert.alert('Eliminar métrica', `¿Eliminar "${m.name}" de tus métricas de salud?`, [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Eliminar', style: 'destructive', onPress: () => deleteHealthMetric(m.id) },
                        ]);
                      }}
                      hitSlop={8}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="trash-outline" size={17} color={C.danger} />
                    </Pressable>
                  )}
                </View>

                {/* Input de valores con el estilo solicitado: SIN COLOR, SOLO BORDE Y GRIS CLARO */}
                {m.isDualValue ? (
                  <View style={healthStyles.dualInputsRow}>
                    <View style={healthStyles.inputWrapBox}>
                      <Text style={healthStyles.inputMiniLabel}>{m.primaryLabel || 'Sistólica'}</Text>
                      <View style={healthStyles.cleanInputBox}>
                        <TextInput
                          value={val !== undefined && val !== null ? String(val) : ''}
                          keyboardType="decimal-pad"
                          placeholder="120"
                          placeholderTextColor="#94A3B8"
                          style={healthStyles.numTextInput}
                          onChangeText={(t) => {
                            const num = parseFloat(t.replace(',', '.')) || 0;
                            updateMetricValue(m.id, num > 0 ? num : undefined, val2);
                          }}
                        />
                        <View style={healthStyles.cleanUnitBadge}>
                          <Text style={healthStyles.cleanUnitText}>{m.unit}</Text>
                        </View>
                      </View>
                    </View>

                    <Text style={healthStyles.slashSeparator}>/</Text>

                    <View style={healthStyles.inputWrapBox}>
                      <Text style={healthStyles.inputMiniLabel}>{m.secondaryLabel || 'Diastólica'}</Text>
                      <View style={healthStyles.cleanInputBox}>
                        <TextInput
                          value={val2 !== undefined && val2 !== null ? String(val2) : ''}
                          keyboardType="decimal-pad"
                          placeholder="80"
                          placeholderTextColor="#94A3B8"
                          style={healthStyles.numTextInput}
                          onChangeText={(t) => {
                            const num = parseFloat(t.replace(',', '.')) || 0;
                            updateMetricValue(m.id, val, num > 0 ? num : undefined);
                          }}
                        />
                        <View style={healthStyles.cleanUnitBadge}>
                          <Text style={healthStyles.cleanUnitText}>{m.unit}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={healthStyles.singleInputRow}>
                    <View style={[healthStyles.cleanInputBox, { flex: 1 }]}>
                      <TextInput
                        value={val !== undefined && val !== null ? String(val) : ''}
                        keyboardType="decimal-pad"
                        placeholder="Ej. 95"
                        placeholderTextColor="#94A3B8"
                        style={healthStyles.numTextInput}
                        onChangeText={(t) => {
                          const num = parseFloat(t.replace(',', '.')) || 0;
                          updateMetricValue(m.id, num > 0 ? num : undefined);
                        }}
                      />
                      <View style={healthStyles.cleanUnitBadge}>
                        <Text style={healthStyles.cleanUnitText}>{m.unit}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </LinearGradient>
            </View>
          );
        })}

        {/* 4. BOTÓN PARA AGREGAR NUEVA MÉTRICA */}
        <Pressable
          onPress={() => setModalOpen(true)}
          style={({ pressed }) => [
            healthStyles.addMetricDashedBtn,
            {
              borderColor: getPaletteColorWithAlpha(palette.primary, 0.45),
              backgroundColor: getPaletteColorWithAlpha(palette.primary, 0.05),
            },
            pressed && s.btnPressed,
          ]}
        >
          <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
          <Text style={[healthStyles.addMetricDashedText, { color: palette.primary }]}>Agregar otra métrica de salud</Text>
        </Pressable>
      </View>

      {/* Modal para agregar métrica personalizada */}
      {modalOpen && (
        <AddHealthMetricModal
          onClose={() => setModalOpen(false)}
          onSave={(newMetric) => {
            addHealthMetric(newMetric);
            setModalOpen(false);
          }}
        />
      )}
    </View>
  );
}

/* ==========================================================
   ESTILOS DE LA SECCIÓN SALUD
========================================================== */
const healthStyles = StyleSheet.create({
  sheetHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  chartOuterCard: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  chartGradientWrap: {
    padding: 16,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  chartTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  chartTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8B5CF6',
    letterSpacing: 0.6,
  },
  chartTitleText: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
  },
  idealPill: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'flex-end',
  },
  idealPillLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  idealPillVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginTop: 1,
  },
  metricPillsRow: {
    gap: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  metricPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  metricPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  emptyChartBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
    marginTop: 8,
  },
  emptyChartSub: {
    fontSize: 11,
    fontWeight: '500',
    color: C.subMuted,
    textAlign: 'center',
    maxWidth: 240,
    marginTop: 3,
  },
  dualLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 6,
    paddingHorizontal: 6,
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
  legendText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  listHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#8B5CF6',
    letterSpacing: 0.6,
  },
  listHeaderSub: {
    fontSize: 10.5,
    fontWeight: '600',
    color: C.subMuted,
  },
  metricCard: {
    borderRadius: 18,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  metricCardGradient: {
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  metricIconOrb: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  metricIdealSub: {
    fontSize: 11,
    fontWeight: '500',
    color: C.subMuted,
    marginTop: 2,
  },
  dualInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputWrapBox: {
    flex: 1,
  },
  inputMiniLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: C.sub,
    marginBottom: 4,
    paddingLeft: 2,
  },
  slashSeparator: {
    fontSize: 20,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 18,
  },
  singleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cleanInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  numTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
    paddingVertical: 4,
  },
  cleanUnitBadge: {
    marginLeft: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cleanUnitText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  addMetricDashedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    backgroundColor: 'rgba(139, 92, 246, 0.04)',
  },
  addMetricDashedText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#8B5CF6',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    width: '100%',
  },
  modalSheetContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: C.text,
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: C.sub,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.sub,
    marginBottom: 6,
  },
  fieldInputBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
  },
  fieldTextInput: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    paddingVertical: 10,
  },
  quickUnitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#94A3B8',
    borderWidth: 1.5,
  },
  unitChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  unitChipTextActive: {
    color: C.text,
    fontWeight: '800',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});

registerThemeSheet(wellnessStyles);
registerThemeSheet(healthStyles);






