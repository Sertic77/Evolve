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
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, GRADIENTS } from './theme';
import { DateSelector, PrimaryButton, s } from './components';
import { useStore, dateKey, Supplement, isSupplementActiveOnDate, HealthMetricDefinition, HealthLogEntry, uid, SEED_HEALTH_METRICS, SEED_HEALTH_LOGS } from './store';
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

/* ==========================================================
   PANTALLA PRINCIPAL: SECCIÓN BIENESTAR (SUEÑO Y SUPLEMENTOS)
========================================================== */
export default function WellnessScreen() {
  // 0: Sueño, 1: Suplementos
  const [tab, setTab] = useState<number>(1);
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
  } = useStore();

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
    <View style={wellnessStyles.rootContainer}>
      <ScrollView
        contentContainerStyle={wellnessStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[1]}
      >
        {/* Cabecera Anime Pastel Claro */}
        <View style={wellnessStyles.topHeader}>
          <View>
            <View style={wellnessStyles.cyberTagRow}>
              <Ionicons name="sparkles" size={11} color={C.pastelPurple} />
              <Text style={wellnessStyles.cyberTagText}>✦ EVOLVE // SALUD & DESCANSO ✦</Text>
            </View>
            <Text style={wellnessStyles.screenTitle}>Bienestar</Text>
          </View>

          <View style={wellnessStyles.headerBadgeMini}>
            <Ionicons
              name={tab === 0 ? 'moon-outline' : tab === 1 ? 'medkit-outline' : 'pulse-outline'}
              size={14}
              color={C.pastelPurple}
            />
            <Text style={wellnessStyles.headerBadgeMiniText}>
              {date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* VARIANT SELECTOR CON DOS BOTONES: SUEÑO Y SUPLEMENTOS (Sticky) */}
        <View style={wellnessStyles.stickyTabsContainer}>
          <WellnessModeSegmented value={tab} onChange={setTab} />
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
               PESTAÑA 1: SUEÑO
            ========================================================== */
            <View style={{ marginTop: 4 }}>
              <DateSelector date={date} onChange={setDate} />

              <View style={wellnessStyles.sleepPlaceholderCard}>
                <LinearGradient
                  colors={['#FFFFFF', '#F8FAFF']}
                  style={wellnessStyles.sleepPlaceholderGradient}
                >
                  <View style={wellnessStyles.sleepBadge}>
                    <Ionicons name="sparkles" size={12} color={C.pastelPurple} />
                    <Text style={wellnessStyles.sleepBadgeText}>✦ MONITOR DE SUEÑO ✦</Text>
                  </View>

                  <View style={wellnessStyles.sleepIconCircle}>
                    <LinearGradient
                      colors={['rgba(167, 139, 250, 0.18)', 'rgba(244, 114, 182, 0.18)']}
                      style={wellnessStyles.sleepIconInner}
                    >
                      <Ionicons name="moon" size={40} color={C.pastelPurple} />
                    </LinearGradient>
                  </View>

                  <Text style={wellnessStyles.sleepTitle}>Registro de Sueño</Text>
                  <Text style={wellnessStyles.sleepSubtitle}>
                    Control de horas de descanso, calidad de sueño y recuperación física diaria.
                  </Text>
                </LinearGradient>
              </View>
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
                    allCompletedToday
                      ? ['rgba(236, 253, 245, 0.96)', 'rgba(209, 250, 229, 0.9)']
                      : GRADIENTS.cardGlass
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={wellnessStyles.progressCardGradient}
                >
                  <View style={wellnessStyles.progressHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <LinearGradient
                        colors={
                          allCompletedToday
                            ? ['#10B981', '#059669']
                            : ['#8B5CF6', '#EC4899']
                        }
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
                        allCompletedToday && wellnessStyles.progressPctPillDone,
                      ]}
                    >
                      <Text
                        style={[
                          wellnessStyles.progressPctText,
                          allCompletedToday && wellnessStyles.progressPctTextDone,
                        ]}
                      >
                        {progressPct}%
                      </Text>
                    </View>
                  </View>

                  <View style={wellnessStyles.progressBarTrack}>
                    <LinearGradient
                      colors={
                        allCompletedToday
                          ? ['#10B981', '#34D399']
                          : ['#8B5CF6', '#EC4899']
                      }
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
                  <Ionicons name="list-outline" size={16} color={C.pastelPurple} />
                  <Text style={wellnessStyles.listSectionTitle}>MIS SUPLEMENTOS DIARIOS</Text>
                </View>

                <Pressable
                  onPress={() => setIsEditingList((prev) => !prev)}
                  style={({ pressed }) => [
                    wellnessStyles.modifyModeBtn,
                    isEditingList && wellnessStyles.modifyModeBtnActive,
                    pressed && s.btnPressed,
                  ]}
                >
                  <Ionicons
                    name={isEditingList ? 'checkmark-circle' : 'options-outline'}
                    size={14}
                    color={isEditingList ? '#FFFFFF' : '#8B5CF6'}
                  />
                  <Text
                    style={[
                      wellnessStyles.modifyModeBtnText,
                      isEditingList && wellnessStyles.modifyModeBtnTextActive,
                    ]}
                  >
                    {isEditingList ? 'Listo' : 'Modificar'}
                  </Text>
                </Pressable>
              </View>

              {isEditingList && (
                <View style={wellnessStyles.editHintBanner}>
                  <Ionicons name="information-circle-outline" size={16} color="#8B5CF6" />
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
                  <Ionicons name="medkit-outline" size={32} color={C.pastelPurple} />
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
                    <Ionicons name="add-circle-outline" size={16} color="#8B5CF6" />
                    <Text style={wellnessStyles.emptyAddBtnText}>Agregar suplemento</Text>
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
                          isAllDone && wellnessStyles.supplementItemCardDone,
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
                                      backgroundColor: isAllDone ? '#10B981' : '#8B5CF6',
                                    },
                                  ]}
                                />
                                <Text
                                  style={[
                                    wellnessStyles.supplementNameText,
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
                                    color: isAllDone ? '#059669' : '#8B5CF6',
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
                                pressed && s.btnPressed,
                              ]}
                            >
                              <Ionicons
                                name={supp.alarmTime ? 'alarm' : 'alarm-outline'}
                                size={14}
                                color={supp.alarmTime ? '#8B5CF6' : C.sub}
                              />
                              {supp.alarmTime ? (
                                <Text style={wellnessStyles.alarmClockBtnText}>
                                  {formatAlarmTime12h(supp.alarmTime)} · {getAlarmSoundById(supp.alarmSound).name}
                                </Text>
                              ) : (
                                <Text style={wellnessStyles.alarmClockBtnPlaceholderText}>
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
                                    checked && wellnessStyles.doseCheckboxBtnActive,
                                    pressed && { transform: [{ scale: 0.92 }] },
                                  ]}
                                  hitSlop={4}
                                >
                                  {checked ? (
                                    <LinearGradient
                                      colors={['#10B981', '#059669']}
                                      start={{ x: 0, y: 0 }}
                                      end={{ x: 1, y: 1 }}
                                      style={wellnessStyles.doseCheckboxGradient}
                                    >
                                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                                    </LinearGradient>
                                  ) : (
                                    <View style={wellnessStyles.doseCheckboxEmptyInner}>
                                      {supp.dailyTarget > 1 && (
                                        <Text style={wellnessStyles.doseCheckboxNumberHint}>
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
                                  <Ionicons name="remove" size={15} color="#8B5CF6" />
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
                                  <Ionicons name="add" size={15} color="#8B5CF6" />
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
                                <Ionicons name="pencil" size={13} color="#8B5CF6" />
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
                  pressed && s.btnPressed,
                ]}
              >
                <Ionicons name="add-circle-outline" size={18} color="#8B5CF6" />
                <Text style={wellnessStyles.bottomAddSuppBtnText}>
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
                    <Ionicons name="medkit" size={19} color="#8B5CF6" />
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
                    <Ionicons name="remove" size={20} color="#8B5CF6" />
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
                    <Ionicons name="add" size={20} color="#8B5CF6" />
                  </Pressable>
                </View>

                {/* Vista previa de las checkboxes que tendrá */}
                <View style={wellnessStyles.previewCheckboxesRow}>
                  {Array.from({ length: formTarget }, (_, idx) => (
                    <View key={idx} style={wellnessStyles.previewCheckboxChip}>
                      <Ionicons name="checkbox-outline" size={15} color="#8B5CF6" />
                      <Text style={wellnessStyles.previewCheckboxChipText}>Toma #{idx + 1}</Text>
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
                    colors={['#8B5CF6', '#EC4899']}
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
                    <Ionicons name="alarm" size={20} color="#8B5CF6" />
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
                    <Ionicons name="chevron-up" size={20} color="#8B5CF6" />
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
                    <Ionicons name="chevron-down" size={20} color="#8B5CF6" />
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
                    <Ionicons name="chevron-up" size={20} color="#8B5CF6" />
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
                    <Ionicons name="chevron-down" size={20} color="#8B5CF6" />
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
                            colors={['#8B5CF6', '#EC4899']}
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
                            color={isPreviewing ? '#EC4899' : isSelected ? '#8B5CF6' : C.sub}
                          />
                          <Text
                            style={[
                              wellnessStyles.soundPlayBtnText,
                              isPreviewing && wellnessStyles.soundPlayBtnTextActive,
                              isSelected && !isPreviewing && { color: '#8B5CF6' },
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
                  <Ionicons name="notifications" size={15} color="#8B5CF6" />
                  <Text style={wellnessStyles.testAlarmBtnText}>
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
                    colors={['#8B5CF6', '#EC4899']}
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
                <Ionicons name="musical-notes" size={15} color="#8B5CF6" />
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
}: {
  value: number;
  onChange: (v: number) => void;
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
              size={15}
              color={active ? '#FFFFFF' : C.sub}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                s.mainSegmentedText,
                active ? s.mainSegmentedTextActive : s.mainSegmentedTextInactive,
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
    backgroundColor: C.bg,
    paddingTop: 4,
    paddingBottom: 10,
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

  // Vista de Sueño
  sleepPlaceholderCard: {
    marginTop: 14,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FFFFFF',
  },
  sleepPlaceholderGradient: {
    padding: 26,
    alignItems: 'center',
  },
  sleepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    marginBottom: 16,
  },
  sleepBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: C.pastelPurple,
    letterSpacing: 1,
  },
  sleepIconCircle: {
    marginBottom: 14,
  },
  sleepIconInner: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: C.text,
    marginBottom: 6,
  },
  sleepSubtitle: {
    fontSize: 13,
    color: C.sub,
    textAlign: 'center',
    lineHeight: 19,
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
          const isSelectedDate = p.dateStr === currentDateKey;
          const labelDate = p.dateStr.slice(5).replace('-', '/');
          return (
            <React.Fragment key={idx}>
              {isSelectedDate && (
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={8}
                  fill="none"
                  stroke={metric.color}
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                />
              )}
              <Circle
                cx={p.x}
                cy={p.y}
                r={isSelectedDate ? 5 : 4}
                fill="#FFFFFF"
                stroke={metric.color}
                strokeWidth={2.5}
              />
              <SvgText
                x={p.x}
                y={p.y - 7}
                fontSize={9.5}
                fontWeight="bold"
                fill="#334155"
                textAnchor="middle"
              >
                {p.val}
              </SvgText>

              {p.y2 !== undefined && (
                <>
                  <Circle
                    cx={p.x}
                    cy={p.y2}
                    r={isSelectedDate ? 5 : 4}
                    fill="#FFFFFF"
                    stroke="#8B5CF6"
                    strokeWidth={2.5}
                  />
                  <SvgText
                    x={p.x}
                    y={p.y2 + 13}
                    fontSize={9.5}
                    fontWeight="bold"
                    fill="#64748B"
                    textAnchor="middle"
                  >
                    {p.val2}
                  </SvgText>
                </>
              )}

              {p.y2 === undefined && (
                <SvgText
                  x={p.x}
                  y={height - 4}
                  fontSize={8.5}
                  fontWeight="600"
                  fill="#94A3B8"
                  textAnchor="middle"
                >
                  {labelDate}
                </SvgText>
              )}
            </React.Fragment>
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
            <LinearGradient colors={['#FFFFFF', '#F8FAFF']} style={{ padding: 20 }}>
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
      <View style={healthStyles.chartOuterCard}>
        <LinearGradient
          colors={['#FFFFFF', '#F8FAFF']}
          style={healthStyles.chartGradientWrap}
        >
          {/* Header de la Gráfica */}
          <View style={healthStyles.chartHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={healthStyles.chartTagBadge}>
                <Ionicons name="analytics-outline" size={12} color="#8B5CF6" />
                <Text style={healthStyles.chartTagText}>EVOLUCIÓN CLÍNICA Y TENDENCIA</Text>
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
          <Text style={healthStyles.listHeaderTitle}>
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
                colors={['#FFFFFF', '#F8FAFF']}
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
          style={({ pressed }) => [healthStyles.addMetricDashedBtn, pressed && s.btnPressed]}
        >
          <Ionicons name="add-circle-outline" size={18} color="#8B5CF6" />
          <Text style={healthStyles.addMetricDashedText}>+ Agregar otra métrica de salud</Text>
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
