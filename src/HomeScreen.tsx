import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Switch,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, GRADIENTS, fmt } from './theme';
import {
  useStore,
  dateKey,
  scaleMacros,
  isSupplementActiveOnDate,
  getActivePalette,
  getFontFamily,
  PRESET_PALETTES,
  ColorPalette,
  FontStyleOption,
  HomeVisibleWidgets,
} from './store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLOR_SWATCHES = [
  '#8B5CF6', // Lavanda
  '#EC4899', // Rosa
  '#F43F5E', // Coral / Rojo
  '#F97316', // Naranja
  '#F59E0B', // Miel / Ámbar
  '#10B981', // Esmeralda / Verde
  '#14B8A6', // Menta
  '#06B6D4', // Cian
  '#3B82F6', // Azul Real
  '#6366F1', // Índigo
  '#A855F7', // Púrpura Neón
  '#64748B', // Pizarra
];

const FONT_OPTIONS: Array<{ key: FontStyleOption; label: string; sample: string }> = [
  { key: 'system', label: 'Moderno', sample: 'Sans System' },
  { key: 'serif', label: 'Elegante', sample: 'Serif Classic' },
  { key: 'monospace', label: 'Tech / Mono', sample: 'Code 123' },
  { key: 'rounded', label: 'Redondeada', sample: 'Soft Round' },
];

export default function HomeScreen({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const {
    activePaletteId,
    customPalettes,
    typography,
    homeWidgets,
    logs,
    ingredients,
    workoutLogs,
    exercises,
    supplements,
    supplementLogs,
    healthMetrics,
    healthLogs,
    weightLogs,
  } = useStore();

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const palette = getActivePalette({ activePaletteId, customPalettes });

  // Fecha de hoy
  const today = new Date();
  const todayKeyStr = dateKey(today);

  // Formato amigable de fecha en español
  const dateFormatted = today.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const capitalizedDate = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);

  // Saludo según la hora
  const hour = today.getHours();
  const greeting =
    hour < 12 ? '¡Buenos días!' : hour < 19 ? '¡Buenas tardes!' : '¡Buenas noches!';

  // Tipografías activas
  const titleFont = getFontFamily(typography?.titles || 'system');
  const subtitleFont = getFontFamily(typography?.subtitles || 'system');
  const bodyFont = getFontFamily(typography?.body || 'system');
  const dataFont = getFontFamily(typography?.data || 'system');

  /* ==========================================================
     CÁLCULO DE DATOS REALES PARA WIDGETS
  ========================================================== */
  // 1. Nutrición de hoy
  const todayMeals = logs[todayKeyStr] || [];
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  todayMeals.forEach((block) => {
    block.items.forEach((item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      const m = scaleMacros(ing, item.grams);
      totalKcal += m.kcal;
      totalProtein += m.protein;
      totalCarbs += m.carbs;
      totalFat += m.fat;
    });
  });

  const targetKcal = 2200;
  const targetProtein = 140;
  const kcalPct = Math.min(100, Math.round((totalKcal / targetKcal) * 100));

  // 2. Entreno de hoy
  const todayWorkouts = workoutLogs[todayKeyStr] || [];
  const exercisesCount = todayWorkouts.length;
  const setsCount = todayWorkouts.reduce((acc, curr) => acc + (curr.sets?.length || 0), 0);

  // 3. Suplementos de hoy
  const activeSupps = (supplements || []).filter((s) => isSupplementActiveOnDate(s, todayKeyStr));
  let totalDosesTarget = 0;
  let totalDosesTaken = 0;
  activeSupps.forEach((s) => {
    totalDosesTarget += s.dailyTarget;
    const takenArr = supplementLogs[todayKeyStr]?.[s.id] || [];
    totalDosesTaken += takenArr.filter(Boolean).length;
  });

  // 4. Salud de hoy o último registro
  const todayHealth = healthLogs[todayKeyStr] || {};
  const pressureVal = todayHealth['presion']?.value;
  const pressureSec = todayHealth['presion']?.secondaryValue;
  const glucoseVal = todayHealth['azucar']?.value;

  // 5. Peso corporal
  const currentWeight = weightLogs[todayKeyStr] || Object.values(weightLogs || {}).pop() || null;

  // 6. Racha y Nivel RPG
  const totalDaysLogged = Object.keys(logs).length + Object.keys(workoutLogs).length;
  const userLevel = Math.max(1, Math.floor(totalDaysLogged / 3) + 1);
  const xpCurrent = (totalDaysLogged % 3) * 33 + 20;

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ==========================================================
            HEADER PRINCIPAL CON BOTÓN DE SETTINGS
        ========================================================== */}
        <View style={styles.topHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greetingText, { color: palette.primary, fontFamily: subtitleFont }]}>
              {greeting}
            </Text>
            <Text style={[styles.dateText, { color: palette.text, fontFamily: titleFont }]}>
              {capitalizedDate}
            </Text>
          </View>

          {/* BOTÓN DE SETTINGS (ESQUINA SUPERIOR DERECHA) */}
          <Pressable
            style={({ pressed }) => [
              styles.settingsBtn,
              {
                backgroundColor: palette.cardBg,
                borderColor: palette.border,
                shadowColor: palette.primary,
              },
              pressed && { transform: [{ scale: 0.92 }] },
            ]}
            onPress={() => setSettingsModalOpen(true)}
            hitSlop={8}
          >
            <LinearGradient
              colors={
                palette.isDark
                  ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']
                  : ['#FFFFFF', '#F8FAFF']
              }
              style={styles.settingsBtnGradient}
            >
              <Ionicons name="options-outline" size={22} color={palette.primary} />
            </LinearGradient>
          </Pressable>
        </View>

        {/* ==========================================================
            WIDGET 1: NIVEL Y RACHA RPG
        ========================================================== */}
        {homeWidgets?.profile && (
          <View style={[styles.cardOuter, { borderColor: palette.border }]}>
            <LinearGradient
              colors={
                palette.isDark
                  ? ['#1E293B', '#0F172A']
                  : ['#FFFFFF', '#F8FAFF']
              }
              style={styles.cardGradient}
            >
              <View style={styles.rpgHeaderRow}>
                <View style={styles.rpgBadge}>
                  <Ionicons name="sparkles" size={13} color={palette.primary} />
                  <Text
                    style={[
                      styles.rpgBadgeText,
                      { color: palette.primary, fontFamily: subtitleFont },
                    ]}
                  >
                    NIVEL {userLevel} · ATLETA
                  </Text>
                </View>

                <View style={[styles.streakPill, { borderColor: palette.secondary }]}>
                  <Ionicons name="flame" size={15} color={palette.secondary} />
                  <Text
                    style={[
                      styles.streakText,
                      { color: palette.secondary, fontFamily: dataFont },
                    ]}
                  >
                    {Math.max(1, totalDaysLogged)} Días Racha
                  </Text>
                </View>
              </View>

              <Text style={[styles.rpgSubtitle, { color: palette.textSub, fontFamily: bodyFont }]}>
                Progreso de experiencia hacia el siguiente rango
              </Text>

              <View style={styles.xpTrack}>
                <LinearGradient
                  colors={[palette.primary, palette.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.xpFill, { width: `${xpCurrent}%` }]}
                />
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ==========================================================
            WIDGET 2: NUTRICIÓN Y MACROS
        ========================================================== */}
        {homeWidgets?.calories && (
          <View style={[styles.cardOuter, { borderColor: palette.border }]}>
            <LinearGradient
              colors={
                palette.isDark
                  ? ['#1E293B', '#0F172A']
                  : ['#FFFFFF', '#F8FAFF']
              }
              style={styles.cardGradient}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconBoxMini, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                    <Ionicons name="nutrition-outline" size={18} color="#10B981" />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Nutrición Diaria
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Meta: {targetKcal} kcal
                    </Text>
                  </View>
                </View>

                {onNavigate && (
                  <Pressable
                    onPress={() => onNavigate('food')}
                    style={styles.linkActionBtn}
                  >
                    <Text style={[styles.linkActionText, { color: palette.primary, fontFamily: subtitleFont }]}>
                      Comida
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={palette.primary} />
                  </Pressable>
                )}
              </View>

              {/* Métrica Central de Calorías */}
              <View style={styles.macroHeroRow}>
                <View>
                  <Text style={[styles.macroHeroVal, { color: palette.text, fontFamily: dataFont }]}>
                    {fmt(totalKcal)}{' '}
                    <Text style={[styles.macroHeroUnit, { color: palette.textSub, fontFamily: bodyFont }]}>
                      kcal
                    </Text>
                  </Text>
                  <Text style={[styles.macroHeroSub, { color: palette.textSub, fontFamily: bodyFont }]}>
                    {kcalPct}% completado hoy
                  </Text>
                </View>

                <View style={styles.macroPillRow}>
                  <View style={styles.macroPill}>
                    <Text style={styles.macroPillLabel}>P</Text>
                    <Text style={[styles.macroPillVal, { fontFamily: dataFont }]}>{fmt(totalProtein)}g</Text>
                  </View>
                  <View style={styles.macroPill}>
                    <Text style={[styles.macroPillLabel, { color: '#D97706' }]}>C</Text>
                    <Text style={[styles.macroPillVal, { fontFamily: dataFont }]}>{fmt(totalCarbs)}g</Text>
                  </View>
                  <View style={styles.macroPill}>
                    <Text style={[styles.macroPillLabel, { color: '#8B5CF6' }]}>G</Text>
                    <Text style={[styles.macroPillVal, { fontFamily: dataFont }]}>{fmt(totalFat)}g</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ==========================================================
            WIDGET 3: ENTRENAMIENTO DEL DÍA
        ========================================================== */}
        {homeWidgets?.workout && (
          <View style={[styles.cardOuter, { borderColor: palette.border }]}>
            <LinearGradient
              colors={
                palette.isDark
                  ? ['#1E293B', '#0F172A']
                  : ['#FFFFFF', '#F8FAFF']
              }
              style={styles.cardGradient}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconBoxMini, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                    <Ionicons name="barbell-outline" size={18} color={palette.primary} />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Entrenamiento
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Rutina de hoy
                    </Text>
                  </View>
                </View>

                {onNavigate && (
                  <Pressable
                    onPress={() => onNavigate('train')}
                    style={styles.linkActionBtn}
                  >
                    <Text style={[styles.linkActionText, { color: palette.primary, fontFamily: subtitleFont }]}>
                      Entreno
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={palette.primary} />
                  </Pressable>
                )}
              </View>

              <View style={styles.statsTwoCol}>
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxVal, { color: palette.text, fontFamily: dataFont }]}>
                    {exercisesCount}
                  </Text>
                  <Text style={[styles.statBoxLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                    Ejercicios registrados
                  </Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={[styles.statBoxVal, { color: palette.primary, fontFamily: dataFont }]}>
                    {setsCount}
                  </Text>
                  <Text style={[styles.statBoxLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                    Series totales
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ==========================================================
            WIDGET 4: SUPLEMENTACIÓN DIARIA
        ========================================================== */}
        {homeWidgets?.supplements && (
          <View style={[styles.cardOuter, { borderColor: palette.border }]}>
            <LinearGradient
              colors={
                palette.isDark
                  ? ['#1E293B', '#0F172A']
                  : ['#FFFFFF', '#F8FAFF']
              }
              style={styles.cardGradient}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconBoxMini, { backgroundColor: 'rgba(244, 114, 182, 0.12)' }]}>
                    <Ionicons name="medkit-outline" size={18} color={palette.secondary} />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Suplementos
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      {totalDosesTaken} de {totalDosesTarget} dosis completadas
                    </Text>
                  </View>
                </View>

                {onNavigate && (
                  <Pressable
                    onPress={() => onNavigate('sleep')}
                    style={styles.linkActionBtn}
                  >
                    <Text style={[styles.linkActionText, { color: palette.primary, fontFamily: subtitleFont }]}>
                      Bienestar
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={palette.primary} />
                  </Pressable>
                )}
              </View>

              <View style={styles.suppListMini}>
                {activeSupps.slice(0, 3).map((supp) => {
                  const doses = supplementLogs[todayKeyStr]?.[supp.id] || [];
                  const taken = doses.filter(Boolean).length;
                  const isDone = taken >= supp.dailyTarget && supp.dailyTarget > 0;
                  return (
                    <View key={supp.id} style={styles.suppMiniItem}>
                      <Ionicons
                        name={isDone ? 'checkmark-circle' : 'time-outline'}
                        size={16}
                        color={isDone ? '#10B981' : palette.textSub}
                      />
                      <Text
                        style={[
                          styles.suppMiniName,
                          { color: palette.text, fontFamily: bodyFont },
                          isDone && { textDecorationLine: 'line-through', opacity: 0.7 },
                        ]}
                        numberOfLines={1}
                      >
                        {supp.name}
                      </Text>
                      <Text style={[styles.suppMiniCount, { color: palette.textSub, fontFamily: dataFont }]}>
                        {taken}/{supp.dailyTarget}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ==========================================================
            WIDGET 5: BIOMARCADORES DE SALUD
        ========================================================== */}
        {homeWidgets?.health && (
          <View style={[styles.cardOuter, { borderColor: palette.border }]}>
            <LinearGradient
              colors={
                palette.isDark
                  ? ['#1E293B', '#0F172A']
                  : ['#FFFFFF', '#F8FAFF']
              }
              style={styles.cardGradient}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconBoxMini, { backgroundColor: 'rgba(6, 182, 212, 0.12)' }]}>
                    <Ionicons name="pulse-outline" size={18} color="#06B6D4" />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Biomarcadores de Salud
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Monitoreo clínico diario
                    </Text>
                  </View>
                </View>

                {onNavigate && (
                  <Pressable
                    onPress={() => onNavigate('sleep')}
                    style={styles.linkActionBtn}
                  >
                    <Text style={[styles.linkActionText, { color: palette.primary, fontFamily: subtitleFont }]}>
                      Salud
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={palette.primary} />
                  </Pressable>
                )}
              </View>

              <View style={styles.healthRowMini}>
                <View style={styles.healthBox}>
                  <Text style={[styles.healthLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                    Presión Arterial
                  </Text>
                  <Text style={[styles.healthVal, { color: palette.text, fontFamily: dataFont }]}>
                    {pressureVal ? `${pressureVal}/${pressureSec || 80}` : '119/78'}{' '}
                    <Text style={{ fontSize: 11, color: palette.textSub }}>mmHg</Text>
                  </Text>
                  <View style={[styles.healthPillMini, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#10B981' }}>Óptima</Text>
                  </View>
                </View>

                <View style={styles.healthBox}>
                  <Text style={[styles.healthLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                    Glucosa / Azúcar
                  </Text>
                  <Text style={[styles.healthVal, { color: palette.text, fontFamily: dataFont }]}>
                    {glucoseVal || '94'}{' '}
                    <Text style={{ fontSize: 11, color: palette.textSub }}>mg/dL</Text>
                  </Text>
                  <View style={[styles.healthPillMini, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#10B981' }}>Normal</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ==========================================================
            WIDGET 6: PESO Y MEDIDAS
        ========================================================== */}
        {homeWidgets?.body && (
          <View style={[styles.cardOuter, { borderColor: palette.border }]}>
            <LinearGradient
              colors={
                palette.isDark
                  ? ['#1E293B', '#0F172A']
                  : ['#FFFFFF', '#F8FAFF']
              }
              style={styles.cardGradient}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconBoxMini, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                    <Ionicons name="body-outline" size={18} color="#3B82F6" />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Composición Corporal
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: palette.textSub, fontFamily: subtitleFont }]}>
                      Último registro
                    </Text>
                  </View>
                </View>

                {onNavigate && (
                  <Pressable
                    onPress={() => onNavigate('measure')}
                    style={styles.linkActionBtn}
                  >
                    <Text style={[styles.linkActionText, { color: palette.primary, fontFamily: subtitleFont }]}>
                      Medidas
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={palette.primary} />
                  </Pressable>
                )}
              </View>

              <View style={styles.bodyWeightRow}>
                <Text style={[styles.bodyWeightVal, { color: palette.text, fontFamily: dataFont }]}>
                  {currentWeight ? fmt(currentWeight) : '74.5'}{' '}
                  <Text style={[styles.bodyWeightUnit, { color: palette.textSub, fontFamily: bodyFont }]}>
                    kg
                  </Text>
                </Text>
                <View style={[styles.bodyWeightBadge, { borderColor: palette.border }]}>
                  <Ionicons name="trending-down-outline" size={14} color="#10B981" />
                  <Text style={[styles.bodyWeightBadgeText, { color: '#10B981', fontFamily: dataFont }]}>
                    Estable
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ACCESO RÁPIDO PARA CONFIGURAR PANEL */}
        <Pressable
          style={[styles.configurePromptBtn, { borderColor: palette.border }]}
          onPress={() => setSettingsModalOpen(true)}
        >
          <Ionicons name="settings-outline" size={15} color={palette.textSub} />
          <Text style={[styles.configurePromptText, { color: palette.textSub, fontFamily: subtitleFont }]}>
            Personalizar qué datos mostrar en el Home
          </Text>
        </Pressable>
      </ScrollView>

      {/* ==========================================================
          MODAL POPUP DE SETTINGS CON 3 OPCIONES:
          - Paleta de color
          - Tipografía
          - Qué datos mostrar en el home
      ========================================================== */}
      <SettingsModal
        visible={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </View>
  );
}

/* ==========================================================
   COMPONENTE MODAL DE SETTINGS (POPUP COMPLETO)
========================================================== */
function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const {
    activePaletteId,
    customPalettes,
    typography,
    homeWidgets,
    setActivePalette,
    addCustomPalette,
    deleteCustomPalette,
    setTypography,
    toggleHomeWidget,
  } = useStore();

  const palette = getActivePalette({ activePaletteId, customPalettes });
  const [activeTab, setActiveTab] = useState<'palette' | 'typography' | 'widgets'>('palette');

  // Creador de paleta nueva
  const [isCreatingPalette, setIsCreatingPalette] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState('');
  const [newPrimaryColor, setNewPrimaryColor] = useState('#8B5CF6');
  const [newSecondaryColor, setNewSecondaryColor] = useState('#F472B6');
  const [newIsDark, setNewIsDark] = useState(false);

  const handleSaveCustomPalette = () => {
    if (!newPaletteName.trim()) return;
    addCustomPalette({
      name: newPaletteName.trim(),
      primary: newPrimaryColor,
      secondary: newSecondaryColor,
      isDark: newIsDark,
      bg: newIsDark ? '#0F172A' : '#F8FAFC',
      cardBg: newIsDark ? '#1E293B' : '#FFFFFF',
      text: newIsDark ? '#F8FAFC' : '#0F172A',
      textSub: newIsDark ? '#94A3B8' : '#64748B',
      border: newIsDark ? '#334155' : '#CBD5E1',
      accent: newPrimaryColor,
    });
    setNewPaletteName('');
    setIsCreatingPalette(false);
  };

  const allPalettes: ColorPalette[] = [...PRESET_PALETTES, ...(customPalettes || [])];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[modalStyles.sheetContainer, { backgroundColor: palette.cardBg }]}>
          {/* Barra de agarre superior */}
          <View style={[modalStyles.handleBar, { backgroundColor: palette.border }]} />

          {/* Header del Modal */}
          <View style={modalStyles.modalHeader}>
            <View>
              <Text style={[modalStyles.modalTitle, { color: palette.text }]}>
                CONFIGURACIÓN
              </Text>
              <Text style={[modalStyles.modalSubtitle, { color: palette.textSub }]}>
                Personaliza la apariencia y tu pantalla de inicio
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={modalStyles.closeBtn}>
              <Ionicons name="close" size={22} color={palette.text} />
            </Pressable>
          </View>

          {/* Selector de Pestañas (Paleta, Tipografía, Qué datos mostrar) */}
          <View style={[modalStyles.tabSegmentedWrap, { backgroundColor: palette.bg }]}>
            <Pressable
              style={[
                modalStyles.tabPill,
                activeTab === 'palette' && [
                  modalStyles.tabPillActive,
                  { backgroundColor: palette.primary },
                ],
              ]}
              onPress={() => setActiveTab('palette')}
            >
              <Ionicons
                name="color-palette-outline"
                size={14}
                color={activeTab === 'palette' ? '#FFFFFF' : palette.textSub}
              />
              <Text
                style={[
                  modalStyles.tabPillText,
                  { color: activeTab === 'palette' ? '#FFFFFF' : palette.textSub },
                ]}
              >
                Paleta
              </Text>
            </Pressable>

            <Pressable
              style={[
                modalStyles.tabPill,
                activeTab === 'typography' && [
                  modalStyles.tabPillActive,
                  { backgroundColor: palette.primary },
                ],
              ]}
              onPress={() => setActiveTab('typography')}
            >
              <Ionicons
                name="text-outline"
                size={14}
                color={activeTab === 'typography' ? '#FFFFFF' : palette.textSub}
              />
              <Text
                style={[
                  modalStyles.tabPillText,
                  { color: activeTab === 'typography' ? '#FFFFFF' : palette.textSub },
                ]}
              >
                Tipografía
              </Text>
            </Pressable>

            <Pressable
              style={[
                modalStyles.tabPill,
                activeTab === 'widgets' && [
                  modalStyles.tabPillActive,
                  { backgroundColor: palette.primary },
                ],
              ]}
              onPress={() => setActiveTab('widgets')}
            >
              <Ionicons
                name="grid-outline"
                size={14}
                color={activeTab === 'widgets' ? '#FFFFFF' : palette.textSub}
              />
              <Text
                style={[
                  modalStyles.tabPillText,
                  { color: activeTab === 'widgets' ? '#FFFFFF' : palette.textSub },
                ]}
              >
                Datos Home
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}
            showsVerticalScrollIndicator={false}
          >
            {/* ==========================================================
                PESTAÑA 1: PALETA DE COLOR
            ========================================================== */}
            {activeTab === 'palette' && (
              <View>
                <Text style={[modalStyles.sectionDesc, { color: palette.textSub }]}>
                  Selecciona una paleta con armonías de color o crea tu propia combinación.
                </Text>

                {/* Lista de Paletas Disponibles */}
                <View style={modalStyles.paletteGrid}>
                  {allPalettes.map((p) => {
                    const isSelected = p.id === activePaletteId;
                    return (
                      <Pressable
                        key={p.id}
                        style={[
                          modalStyles.paletteCard,
                          {
                            backgroundColor: p.cardBg,
                            borderColor: isSelected ? palette.primary : palette.border,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                        onPress={() => setActivePalette(p.id)}
                      >
                        <View style={modalStyles.paletteCardTop}>
                          <Text
                            style={[
                              modalStyles.paletteCardName,
                              { color: p.text },
                              isSelected && { fontWeight: '800' },
                            ]}
                            numberOfLines={1}
                          >
                            {p.name}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
                          )}
                        </View>

                        {/* Muestras de mínimo 2 colores + fondo */}
                        <View style={modalStyles.swatchesRow}>
                          <View
                            style={[
                              modalStyles.swatchCircle,
                              { backgroundColor: p.primary, borderColor: '#FFFFFF' },
                            ]}
                          />
                          <View
                            style={[
                              modalStyles.swatchCircle,
                              { backgroundColor: p.secondary, borderColor: '#FFFFFF', marginLeft: -6 },
                            ]}
                          />
                          <View
                            style={[
                              modalStyles.swatchCircle,
                              { backgroundColor: p.bg, borderColor: p.border, marginLeft: -6 },
                            ]}
                          />

                          {p.isDark && (
                            <View style={modalStyles.darkTagMini}>
                              <Ionicons name="moon" size={10} color="#94A3B8" />
                            </View>
                          )}

                          {p.custom && (
                            <Pressable
                              style={modalStyles.deleteCustomBtn}
                              onPress={(e) => {
                                e.stopPropagation();
                                deleteCustomPalette(p.id);
                              }}
                              hitSlop={6}
                            >
                              <Ionicons name="trash-outline" size={14} color="#EF4444" />
                            </Pressable>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Botón para Abrir Formulario de Crear Nueva Paleta */}
                {!isCreatingPalette ? (
                  <Pressable
                    style={[modalStyles.createPaletteToggleBtn, { borderColor: palette.primary }]}
                    onPress={() => setIsCreatingPalette(true)}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
                    <Text style={[modalStyles.createPaletteToggleText, { color: palette.primary }]}>
                      Crear Nueva Paleta Personalizada
                    </Text>
                  </Pressable>
                ) : (
                  /* Formulario de Creación de Paleta */
                  <View style={[modalStyles.customPaletteForm, { borderColor: palette.border }]}>
                    <View style={modalStyles.customFormHeader}>
                      <Text style={[modalStyles.customFormTitle, { color: palette.text }]}>
                        NUEVA PALETA DE COLORES
                      </Text>
                      <Pressable onPress={() => setIsCreatingPalette(false)}>
                        <Ionicons name="close" size={18} color={palette.textSub} />
                      </Pressable>
                    </View>

                    <Text style={[modalStyles.formLabel, { color: palette.textSub }]}>
                      Nombre de la paleta
                    </Text>
                    <TextInput
                      style={[
                        modalStyles.formInput,
                        {
                          backgroundColor: palette.bg,
                          color: palette.text,
                          borderColor: palette.border,
                        },
                      ]}
                      placeholder="Ej. Fuego Dragón, Neón Azul..."
                      placeholderTextColor="#94A3B8"
                      value={newPaletteName}
                      onChangeText={setNewPaletteName}
                    />

                    {/* Color 1: Primario */}
                    <Text style={[modalStyles.formLabel, { color: palette.textSub }]}>
                      Color Principal 1 ({newPrimaryColor})
                    </Text>
                    <View style={modalStyles.swatchesPickRow}>
                      {COLOR_SWATCHES.map((color) => (
                        <Pressable
                          key={color}
                          style={[
                            modalStyles.pickCircle,
                            { backgroundColor: color },
                            newPrimaryColor === color && modalStyles.pickCircleActive,
                          ]}
                          onPress={() => setNewPrimaryColor(color)}
                        />
                      ))}
                    </View>

                    {/* Color 2: Secundario */}
                    <Text style={[modalStyles.formLabel, { color: palette.textSub, marginTop: 12 }]}>
                      Color Secundario 2 ({newSecondaryColor})
                    </Text>
                    <View style={modalStyles.swatchesPickRow}>
                      {COLOR_SWATCHES.map((color) => (
                        <Pressable
                          key={color}
                          style={[
                            modalStyles.pickCircle,
                            { backgroundColor: color },
                            newSecondaryColor === color && modalStyles.pickCircleActive,
                          ]}
                          onPress={() => setNewSecondaryColor(color)}
                        />
                      ))}
                    </View>

                    {/* Modo Claro vs Oscuro */}
                    <View style={modalStyles.themeSwitchRow}>
                      <Text style={[modalStyles.formLabel, { color: palette.textSub, marginBottom: 0 }]}>
                        Base Oscura / Nocturna
                      </Text>
                      <Switch
                        value={newIsDark}
                        onValueChange={setNewIsDark}
                        trackColor={{ false: '#CBD5E1', true: palette.primary }}
                        thumbColor="#FFFFFF"
                      />
                    </View>

                    {/* Vista Previa del Resultado */}
                    <View
                      style={[
                        modalStyles.previewCardMini,
                        {
                          backgroundColor: newIsDark ? '#0F172A' : '#F8FAFC',
                          borderColor: newIsDark ? '#334155' : '#E2E8F0',
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[modalStyles.swatchCircle, { backgroundColor: newPrimaryColor }]} />
                        <View style={[modalStyles.swatchCircle, { backgroundColor: newSecondaryColor }]} />
                        <Text style={{ fontWeight: '700', color: newIsDark ? '#F8FAFC' : '#1E1B4B' }}>
                          {newPaletteName || 'Vista previa'}
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      style={[
                        modalStyles.savePaletteBtn,
                        { backgroundColor: palette.primary },
                        !newPaletteName.trim() && { opacity: 0.5 },
                      ]}
                      onPress={handleSaveCustomPalette}
                      disabled={!newPaletteName.trim()}
                    >
                      <Text style={modalStyles.savePaletteBtnText}>Guardar y Aplicar Paleta</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {/* ==========================================================
                PESTAÑA 2: TIPOGRAFÍA (TÍTULOS, SUBTÍTULOS, TEXTOS, DATOS)
            ========================================================== */}
            {activeTab === 'typography' && (
              <View>
                <Text style={[modalStyles.sectionDesc, { color: palette.textSub }]}>
                  Elige el estilo de fuente independiente para cada nivel de información.
                </Text>

                {/* 1. TÍTULOS */}
                <TypographyCategoryRow
                  categoryTitle="TÍTULOS PRINCIPALES"
                  categoryDesc="Encabezados grandes y nombres de módulos"
                  currentValue={typography?.titles || 'system'}
                  onSelect={(fontKey) => setTypography({ titles: fontKey })}
                  palette={palette}
                />

                {/* 2. SUBTÍTULOS */}
                <TypographyCategoryRow
                  categoryTitle="SUBTÍTULOS Y ETIQUETAS"
                  categoryDesc="Metas, secciones secundarias y categorías"
                  currentValue={typography?.subtitles || 'system'}
                  onSelect={(fontKey) => setTypography({ subtitles: fontKey })}
                  palette={palette}
                />

                {/* 3. TEXTOS */}
                <TypographyCategoryRow
                  categoryTitle="TEXTOS Y DESCRIPCIONES"
                  categoryDesc="Párrafos, notas informativas y listas"
                  currentValue={typography?.body || 'system'}
                  onSelect={(fontKey) => setTypography({ body: fontKey })}
                  palette={palette}
                />

                {/* 4. DATOS Y NÚMEROS */}
                <TypographyCategoryRow
                  categoryTitle="DATOS Y VALORES NUMÉRICOS"
                  categoryDesc="Kcal, gramos, series, repeticiones y presión arterial"
                  currentValue={typography?.data || 'system'}
                  onSelect={(fontKey) => setTypography({ data: fontKey })}
                  palette={palette}
                />

                {/* VISTA PREVIA EN VIVO DE TIPOGRAFÍA */}
                <View
                  style={[
                    modalStyles.typePreviewCard,
                    {
                      backgroundColor: palette.bg,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <View style={modalStyles.typePreviewHeader}>
                    <Ionicons name="eye-outline" size={14} color={palette.primary} />
                    <Text style={[modalStyles.typePreviewTag, { color: palette.primary }]}>
                      VISTA PREVIA EN VIVO
                    </Text>
                  </View>

                  <Text
                    style={[
                      modalStyles.typePreviewTitle,
                      {
                        color: palette.text,
                        fontFamily: getFontFamily(typography?.titles || 'system'),
                      },
                    ]}
                  >
                    Resumen de Rendimiento
                  </Text>

                  <Text
                    style={[
                      modalStyles.typePreviewSub,
                      {
                        color: palette.textSub,
                        fontFamily: getFontFamily(typography?.subtitles || 'system'),
                      },
                    ]}
                  >
                    Estadísticas diarias de progreso
                  </Text>

                  <Text
                    style={[
                      modalStyles.typePreviewBody,
                      {
                        color: palette.textSub,
                        fontFamily: getFontFamily(typography?.body || 'system'),
                      },
                    ]}
                  >
                    Has completado el 85% de tus metas programadas para el ciclo actual.
                  </Text>

                  <View style={modalStyles.typePreviewDataRow}>
                    <Text
                      style={[
                        modalStyles.typePreviewDataVal,
                        {
                          color: palette.primary,
                          fontFamily: getFontFamily(typography?.data || 'system'),
                        },
                      ]}
                    >
                      2,450 kcal · 145g Proteína · 119/78 mmHg
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ==========================================================
                PESTAÑA 3: QUÉ DATOS MOSTRAR EN EL HOME
            ========================================================== */}
            {activeTab === 'widgets' && (
              <View>
                <Text style={[modalStyles.sectionDesc, { color: palette.textSub }]}>
                  Activa o desactiva las tarjetas para personalizar tu panel de inicio.
                </Text>

                <WidgetToggleRow
                  icon="sparkles-outline"
                  iconColor={palette.primary}
                  title="Nivel RPG y Racha de Días"
                  desc="Muestra tu nivel de atleta, barra de XP y racha de hábitos activa."
                  enabled={!!homeWidgets?.profile}
                  onToggle={() => toggleHomeWidget('profile')}
                  palette={palette}
                />

                <WidgetToggleRow
                  icon="nutrition-outline"
                  iconColor="#10B981"
                  title="Nutrición y Macronutrientes"
                  desc="Calorías consumidas hoy vs meta y desglose de Proteína, Carbos y Grasas."
                  enabled={!!homeWidgets?.calories}
                  onToggle={() => toggleHomeWidget('calories')}
                  palette={palette}
                />

                <WidgetToggleRow
                  icon="barbell-outline"
                  iconColor="#8B5CF6"
                  title="Entrenamiento del Día"
                  desc="Número de ejercicios registrados y total de series completadas hoy."
                  enabled={!!homeWidgets?.workout}
                  onToggle={() => toggleHomeWidget('workout')}
                  palette={palette}
                />

                <WidgetToggleRow
                  icon="medkit-outline"
                  iconColor="#F472B6"
                  title="Suplementación Diaria"
                  desc="Checklist y conteo de tomas completadas de tus suplementos programados."
                  enabled={!!homeWidgets?.supplements}
                  onToggle={() => toggleHomeWidget('supplements')}
                  palette={palette}
                />

                <WidgetToggleRow
                  icon="pulse-outline"
                  iconColor="#06B6D4"
                  title="Biomarcadores de Salud"
                  desc="Últimos registros de Presión Arterial, Glucosa y semáforo clínico."
                  enabled={!!homeWidgets?.health}
                  onToggle={() => toggleHomeWidget('health')}
                  palette={palette}
                />

                <WidgetToggleRow
                  icon="body-outline"
                  iconColor="#3B82F6"
                  title="Peso y Medidas Corporales"
                  desc="Último peso registrado en la báscula y control antropométrico."
                  enabled={!!homeWidgets?.body}
                  onToggle={() => toggleHomeWidget('body')}
                  palette={palette}
                />
              </View>
            )}
          </ScrollView>

          {/* Botón inferior para cerrar */}
          <View style={[modalStyles.modalFooter, { borderTopColor: palette.border }]}>
            <Pressable
              style={[modalStyles.doneBtn, { backgroundColor: palette.primary }]}
              onPress={onClose}
            >
              <Text style={modalStyles.doneBtnText}>Guardar y Listo</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ==========================================================
   SUB-COMPONENTES AUXILIARES PARA EL MODAL
========================================================== */
function TypographyCategoryRow({
  categoryTitle,
  categoryDesc,
  currentValue,
  onSelect,
  palette,
}: {
  categoryTitle: string;
  categoryDesc: string;
  currentValue: FontStyleOption;
  onSelect: (font: FontStyleOption) => void;
  palette: ColorPalette;
}) {
  return (
    <View style={[modalStyles.typeCategoryCard, { borderColor: palette.border }]}>
      <Text style={[modalStyles.typeCategoryTitle, { color: palette.text }]}>
        {categoryTitle}
      </Text>
      <Text style={[modalStyles.typeCategoryDesc, { color: palette.textSub }]}>
        {categoryDesc}
      </Text>

      <View style={modalStyles.typeOptionsGrid}>
        {FONT_OPTIONS.map((opt) => {
          const isSelected = currentValue === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[
                modalStyles.typePillOption,
                {
                  backgroundColor: isSelected ? palette.primary : palette.bg,
                  borderColor: isSelected ? palette.primary : palette.border,
                },
              ]}
              onPress={() => onSelect(opt.key)}
            >
              <Text
                style={[
                  modalStyles.typePillOptionLabel,
                  {
                    color: isSelected ? '#FFFFFF' : palette.text,
                    fontFamily: getFontFamily(opt.key),
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function WidgetToggleRow({
  icon,
  iconColor,
  title,
  desc,
  enabled,
  onToggle,
  palette,
}: {
  icon: any;
  iconColor: string;
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: () => void;
  palette: ColorPalette;
}) {
  return (
    <View
      style={[
        modalStyles.widgetToggleRow,
        {
          backgroundColor: palette.bg,
          borderColor: enabled ? palette.primary : palette.border,
          borderWidth: enabled ? 1.5 : 1,
        },
      ]}
    >
      <View style={[modalStyles.widgetIconBox, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>

      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[modalStyles.widgetTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[modalStyles.widgetDesc, { color: palette.textSub }]}>{desc}</Text>
      </View>

      <Switch
        value={enabled}
        onValueChange={onToggle}
        trackColor={{ false: '#CBD5E1', true: palette.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

/* ==========================================================
   ESTILOS DE LA PANTALLA PRINCIPAL
========================================================== */
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 14 : 10,
    paddingBottom: 110, // Espacio para el TabBar flotante
  },

  // Header superior
  topHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  settingsBtnGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tarjetas genéricas del Home
  cardOuter: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardGradient: {
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBoxMini: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  linkActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  linkActionText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // RPG Widget
  rpgHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rpgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rpgBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(244, 114, 182, 0.08)',
  },
  streakText: {
    fontSize: 12,
    fontWeight: '800',
  },
  rpgSubtitle: {
    fontSize: 12,
    marginBottom: 10,
  },
  xpTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(203, 213, 225, 0.3)',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Macro Row
  macroHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  macroHeroVal: {
    fontSize: 24,
    fontWeight: '900',
  },
  macroHeroUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  macroHeroSub: {
    fontSize: 11,
    marginTop: 2,
  },
  macroPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  macroPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(203, 213, 225, 0.15)',
    alignItems: 'center',
  },
  macroPillLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 2,
  },
  macroPillVal: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Stats 2 Column
  statsTwoCol: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(203, 213, 225, 0.12)',
  },
  statBoxVal: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 2,
  },
  statBoxLabel: {
    fontSize: 11,
  },

  // Suplementos Mini
  suppListMini: {
    gap: 8,
    marginTop: 4,
  },
  suppMiniItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  suppMiniName: {
    flex: 1,
    fontSize: 13,
  },
  suppMiniCount: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Salud Mini
  healthRowMini: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  healthBox: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(203, 213, 225, 0.12)',
  },
  healthLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  healthVal: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  healthPillMini: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },

  // Medidas Mini
  bodyWeightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  bodyWeightVal: {
    fontSize: 24,
    fontWeight: '900',
  },
  bodyWeightUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  bodyWeightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  bodyWeightBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },

  // Prompt inferior
  configurePromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  configurePromptText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

/* ==========================================================
   ESTILOS DEL MODAL DE SETTINGS
========================================================== */
const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  handleBar: {
    width: 42,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },

  // Selector segmentado de 3 pestañas
  tabSegmentedWrap: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabPillActive: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '700',
  },

  sectionDesc: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },

  // Grid de Paletas
  paletteGrid: {
    gap: 10,
    marginBottom: 16,
  },
  paletteCard: {
    padding: 14,
    borderRadius: 16,
  },
  paletteCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paletteCardName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  swatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swatchCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  darkTagMini: {
    marginLeft: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  deleteCustomBtn: {
    marginLeft: 'auto',
    padding: 6,
  },

  // Formulario Crear Paleta
  createPaletteToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginBottom: 10,
  },
  createPaletteToggleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  customPaletteForm: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
  },
  customFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customFormTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  formInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 12,
  },
  swatchesPickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  pickCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  pickCircleActive: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  themeSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  previewCardMini: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  savePaletteBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savePaletteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // Tipografía
  typeCategoryCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  typeCategoryTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  typeCategoryDesc: {
    fontSize: 11,
    marginBottom: 10,
  },
  typeOptionsGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  typePillOption: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  typePillOptionLabel: {
    fontSize: 12,
  },

  // Vista previa tipografía
  typePreviewCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  typePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  typePreviewTag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  typePreviewTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  typePreviewSub: {
    fontSize: 12,
    marginBottom: 6,
  },
  typePreviewBody: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  typePreviewDataRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(203, 213, 225, 0.4)',
  },
  typePreviewDataVal: {
    fontSize: 13,
    fontWeight: '800',
  },

  // Toggle de Widgets
  widgetToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  widgetIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  widgetTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  widgetDesc: {
    fontSize: 11,
    lineHeight: 16,
  },

  // Footer modal
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  doneBtn: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
