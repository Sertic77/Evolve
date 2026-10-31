import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fmt, getPaletteColorWithAlpha } from './theme';
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
} from './store';

const COLOR_SWATCHES = [
  '#8B5CF6', // Lavanda
  '#EC4899', // Rosa Sakura
  '#F43F5E', // Coral Rubí
  '#F97316', // Naranja
  '#F59E0B', // Miel / Ámbar
  '#10B981', // Esmeralda / Verde
  '#14B8A6', // Menta
  '#06B6D4', // Cian
  '#3B82F6', // Azul Real
  '#6366F1', // Índigo Eléctrico
  '#A855F7', // Púrpura Neón
  '#64748B', // Pizarra
];

const FONT_OPTIONS: Array<{ key: FontStyleOption; label: string }> = [
  { key: 'system', label: 'Moderno' },
  { key: 'serif', label: 'Elegante' },
  { key: 'monospace', label: 'Tech / Mono' },
  { key: 'rounded', label: 'Redondeada' },
];

export default function HomeScreen({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const {
    userProfile,
    activePaletteId,
    customPalettes,
    deletedPaletteIds,
    typography,
    homeWidgets,
    logs,
    ingredients,
    workoutLogs,
    supplements,
    supplementLogs,
    healthLogs,
    weightLogs,
  } = useStore();

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const palette = getActivePalette({ activePaletteId, customPalettes, deletedPaletteIds });

  const pColors = palette.colors && palette.colors.length >= 2 ? palette.colors : [palette.primary, palette.secondary];
  const c1 = pColors[0] || palette.primary;
  const c2 = pColors[1] || palette.secondary;
  const c3 = pColors[2] || pColors[0] || palette.primary;
  const c4 = pColors[3] || pColors[1] || palette.secondary;
  const c5 = pColors[4] || pColors[2] || pColors[0] || palette.primary;

  // Fecha de hoy
  const today = new Date();
  const todayKeyStr = dateKey(today);

  const rawDayStr = today.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const dayStrClean = rawDayStr.replace('.', '');

  // Tipografías activas
  const titleFont = getFontFamily(typography?.titles || 'system');
  const subtitleFont = getFontFamily(typography?.subtitles || 'system');
  const bodyFont = getFontFamily(typography?.body || 'system');
  const dataFont = getFontFamily(typography?.data || 'system');

  // Datos de usuario
  const userName = userProfile?.name || 'Sergio Tamayo';
  const userNick = userProfile?.nickname ? `@${userProfile.nickname.replace('@', '')}` : '@Sertic77';

  // Iniciales para el avatar
  const initials = userName
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'ST';

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
      {/* ==========================================================
          ESTRUCTURA DE PERFIL SUPERIOR STICKY (PERMANECE FIJO AL SCROLL):
          - Perfil al lado izquierdo (Avatar + Racha horizontal debajo)
          - Nombre, Nickname, Rango, Barra XP
          - Al lado derecho: Botón de Ajustes
      ========================================================== */}
      <View
        style={[
          styles.userHeroSticky,
          {
            backgroundColor: palette.bg,
            borderBottomColor: palette.isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.6)',
          },
        ]}
      >
        <View style={styles.userHeroRow}>
          {/* Perfil al lado izquierdo (Avatar + Racha horizontal justo debajo) */}
          <View style={{ alignItems: 'center', marginRight: 12 }}>
            <LinearGradient
              colors={[c1, c2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroAvatar}
            >
              <Text style={styles.heroAvatarText}>{initials}</Text>
            </LinearGradient>

            {/* Racha horizontal justo debajo de la foto de perfil */}
            <View
              style={[
                styles.heroStreakHorizontal,
                {
                  borderColor: c2,
                  backgroundColor: `${c2}18`,
                },
              ]}
            >
              <Ionicons name="flame" size={13} color={c2} />
              <Text
                style={[styles.heroStreakNumHorizontal, { color: c2, fontFamily: dataFont }]}
              >
                {Math.max(1, totalDaysLogged)}
              </Text>
              <Text
                style={[styles.heroStreakLabelHorizontal, { color: c2, fontFamily: subtitleFont }]}
              >
                días
              </Text>
            </View>
          </View>

          {/* Bloque Central de Datos */}
          <View style={styles.heroCenterCol}>
            {/* Nombre */}
            <Text
              style={[styles.heroName, { color: palette.text, fontFamily: titleFont }]}
              numberOfLines={1}
            >
              {userName}
            </Text>

            {/* Nickname - Fecha */}
            <Text
              style={[styles.heroNickDate, { color: palette.textSub, fontFamily: bodyFont }]}
              numberOfLines={1}
            >
              <Text style={{ color: c1, fontWeight: '700' }}>{userNick}</Text> - {dayStrClean}
            </Text>

            {/* Rango */}
            <View style={styles.heroRankRow}>
              <Ionicons name="sparkles" size={12} color={c1} />
              <Text
                style={[styles.heroRankText, { color: c1, fontFamily: subtitleFont }]}
              >
                Nivel {userLevel} · Atleta Élite
              </Text>
            </View>

            {/* Barra XP */}
            <View
              style={[
                styles.heroXpTrack,
                {
                  backgroundColor: palette.isDark ? '#334155' : 'rgba(203, 213, 225, 0.4)',
                },
              ]}
            >
              <LinearGradient
                colors={[c1, c2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.heroXpFill, { width: `${xpCurrent}%` }]}
              />
            </View>
          </View>

          {/* Al lado derecho: Botón de Ajustes */}
          <View style={styles.heroRightCol}>
            <Pressable
              style={({ pressed }) => [
                styles.heroSettingsBtn,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.bg,
                },
                pressed && { transform: [{ scale: 0.92 }] },
              ]}
              onPress={() => setSettingsModalOpen(true)}
              hitSlop={8}
            >
              <Ionicons name="options-outline" size={17} color={c1} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ==========================================================
            WIDGET 1: NUTRICIÓN Y MACROS (COLORES ESTRICTOS DE LA PALETA)
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
                  <View style={[styles.iconBoxMini, { backgroundColor: `${palette.primary}18` }]}>
                    <Ionicons name="nutrition-outline" size={18} color={palette.primary} />
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

                {/* Desglose de Macros usando colores de la paleta */}
                <View style={styles.macroPillRow}>
                  <View style={[styles.macroPill, { backgroundColor: `${c3}15` }]}>
                    <Text style={[styles.macroPillLabel, { color: c3 }]}>P</Text>
                    <Text style={[styles.macroPillVal, { color: palette.text, fontFamily: dataFont }]}>
                      {fmt(totalProtein)}g
                    </Text>
                  </View>
                  <View style={[styles.macroPill, { backgroundColor: `${c2}15` }]}>
                    <Text style={[styles.macroPillLabel, { color: c2 }]}>C</Text>
                    <Text style={[styles.macroPillVal, { color: palette.text, fontFamily: dataFont }]}>
                      {fmt(totalCarbs)}g
                    </Text>
                  </View>
                  <View style={[styles.macroPill, { backgroundColor: `${c4}15` }]}>
                    <Text style={[styles.macroPillLabel, { color: c4 }]}>G</Text>
                    <Text style={[styles.macroPillVal, { color: palette.text, fontFamily: dataFont }]}>
                      {fmt(totalFat)}g
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ==========================================================
            WIDGET 2: ENTRENAMIENTO DEL DÍA
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
                  <View style={[styles.iconBoxMini, { backgroundColor: `${c2}18` }]}>
                    <Ionicons name="barbell-outline" size={18} color={c2} />
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
                    <Text style={[styles.linkActionText, { color: c2, fontFamily: subtitleFont }]}>
                      Entreno
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={c2} />
                  </Pressable>
                )}
              </View>

              <View style={styles.statsTwoCol}>
                <View style={[styles.statBox, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.statBoxVal, { color: palette.text, fontFamily: dataFont }]}>
                    {exercisesCount}
                  </Text>
                  <Text style={[styles.statBoxLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                    Ejercicios registrados
                  </Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.statBoxVal, { color: c2, fontFamily: dataFont }]}>
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
            WIDGET 3: SUPLEMENTACIÓN DIARIA
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
                  <View style={[styles.iconBoxMini, { backgroundColor: `${c3}18` }]}>
                    <Ionicons name="medkit-outline" size={18} color={c3} />
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
                    <Text style={[styles.linkActionText, { color: c3, fontFamily: subtitleFont }]}>
                      Bienestar
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={c3} />
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
                        color={isDone ? c3 : palette.textSub}
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
            WIDGET 4: BIOMARCADORES DE SALUD
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
                  <View style={[styles.iconBoxMini, { backgroundColor: `${c4}18` }]}>
                    <Ionicons name="pulse-outline" size={18} color={c4} />
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
                    <Text style={[styles.linkActionText, { color: c4, fontFamily: subtitleFont }]}>
                      Salud
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={c4} />
                  </Pressable>
                )}
              </View>

              <View style={styles.healthRowMini}>
                <View style={[styles.healthBox, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.healthLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                    Presión Arterial
                  </Text>
                  <Text style={[styles.healthVal, { color: palette.text, fontFamily: dataFont }]}>
                    {pressureVal ? `${pressureVal}/${pressureSec || 80}` : '119/78'}{' '}
                    <Text style={{ fontSize: 11, color: palette.textSub }}>mmHg</Text>
                  </Text>
                  <View style={[styles.healthPillMini, { backgroundColor: `${c4}18` }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: c4 }}>Óptima</Text>
                  </View>
                </View>

                <View style={[styles.healthBox, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.healthLabel, { color: palette.textSub, fontFamily: subtitleFont }]}>
                    Glucosa / Azúcar
                  </Text>
                  <Text style={[styles.healthVal, { color: palette.text, fontFamily: dataFont }]}>
                    {glucoseVal || '94'}{' '}
                    <Text style={{ fontSize: 11, color: palette.textSub }}>mg/dL</Text>
                  </Text>
                  <View style={[styles.healthPillMini, { backgroundColor: `${c3}18` }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: c3 }}>Normal</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ==========================================================
            WIDGET 5: PESO Y MEDIDAS
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
                  <View style={[styles.iconBoxMini, { backgroundColor: `${c5}18` }]}>
                    <Ionicons name="body-outline" size={18} color={c5} />
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
                    <Text style={[styles.linkActionText, { color: c5, fontFamily: subtitleFont }]}>
                      Medidas
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={c5} />
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
                <View
                  style={[
                    styles.bodyWeightBadge,
                    {
                      borderColor: c5,
                      backgroundColor: `${c5}15`,
                    },
                  ]}
                >
                  <Ionicons name="trending-down-outline" size={14} color={c5} />
                  <Text style={[styles.bodyWeightBadgeText, { color: c5, fontFamily: dataFont }]}>
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
            Personalizar temas, tipografías y datos del Home
          </Text>
        </Pressable>
      </ScrollView>

      {/* ==========================================================
          MODAL POPUP DE SETTINGS CON MENÚ DESPLEGABLE (ACCORDION):
          - Paleta de color
          - Tipografía
          - Qué datos mostrar en el home
          - Perfil de Usuario
      ========================================================== */}
      <SettingsModal
        visible={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </View>
  );
}

/* ==========================================================
   MODAL PARA SELECCIONAR COLOR PERSONALIZADO
========================================================== */
function ColorPickerModal({
  visible,
  initialColor,
  title = 'Selector de Color',
  onClose,
  onSelectColor,
  palette,
}: {
  visible: boolean;
  initialColor: string;
  title?: string;
  onClose: () => void;
  onSelectColor: (color: string) => void;
  palette: ColorPalette;
}) {
  const [selectedColor, setSelectedColor] = useState(initialColor || '#8B5CF6');
  const [hexInput, setHexInput] = useState(initialColor ? initialColor.replace('#', '') : '8B5CF6');

  useEffect(() => {
    if (initialColor) {
      setSelectedColor(initialColor);
      setHexInput(initialColor.replace('#', ''));
    }
  }, [initialColor]);

  if (!visible) return null;

  const handleHexChange = (text: string) => {
    const cleaned = text.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
    setHexInput(cleaned);
    if (cleaned.length === 6) {
      setSelectedColor(`#${cleaned}`);
    }
  };

  const handlePickPreset = (col: string) => {
    setSelectedColor(col);
    setHexInput(col.replace('#', ''));
  };

  const handleApply = () => {
    let finalCol = hexInput.trim();
    if (finalCol.length === 6) {
      finalCol = `#${finalCol}`;
    } else if (selectedColor) {
      finalCol = selectedColor.startsWith('#') ? selectedColor : `#${selectedColor}`;
    } else {
      finalCol = '#8B5CF6';
    }
    onSelectColor(finalCol);
    onClose();
  };

  const PALETTE_TONES = [
    ['#8B5CF6', '#EC4899', '#F43F5E', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6'],
    ['#C4B5FD', '#FBCFE8', '#FECDD3', '#FFEDD5', '#FEF08A', '#A7F3D0', '#BAE6FD', '#BFDBFE'],
    ['#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#D97706', '#059669', '#0891B2', '#2563EB'],
    ['#4C1D95', '#831843', '#881337', '#7C2D12', '#78350F', '#064E3B', '#164E63', '#1E3A8A'],
    ['#0F172A', '#1E293B', '#334155', '#475569', '#64748B', '#94A3B8', '#CBD5E1', '#FFFFFF'],
  ];

  return (
    <View style={pickerStyles.overlayBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[pickerStyles.container, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
        {/* Header */}
        <View style={pickerStyles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[pickerStyles.title, { color: palette.text }]}>{title.toUpperCase()}</Text>
            <Text style={[pickerStyles.subtitle, { color: palette.textSub }]}>
              Selecciona una muestra o introduce un código hexadecimal
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={palette.textSub} />
          </Pressable>
        </View>

        {/* Visual Preview */}
        <View style={[pickerStyles.previewCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
          <View style={[pickerStyles.previewCircle, { backgroundColor: selectedColor }]}>
            <Ionicons name="color-filter" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[pickerStyles.previewLabel, { color: palette.textSub }]}>COLOR SELECCIONADO</Text>
            <Text style={[pickerStyles.previewHex, { color: palette.text }]}>#{hexInput.toUpperCase()}</Text>
          </View>
          {/* Opacity preview chips */}
          <View style={pickerStyles.opacityChips}>
            <View style={[pickerStyles.opacityChip, { backgroundColor: selectedColor }]} />
            <View style={[pickerStyles.opacityChip, { backgroundColor: getPaletteColorWithAlpha(selectedColor, 0.6) }]} />
            <View style={[pickerStyles.opacityChip, { backgroundColor: getPaletteColorWithAlpha(selectedColor, 0.25) }]} />
          </View>
        </View>

        {/* Hex Input Row */}
        <View style={pickerStyles.hexRow}>
          <View style={[pickerStyles.hexPrefix, { backgroundColor: `${palette.primary}18` }]}>
            <Text style={[pickerStyles.hexPrefixText, { color: palette.primary }]}>#</Text>
          </View>
          <TextInput
            style={[
              pickerStyles.hexInput,
              { backgroundColor: palette.bg, color: palette.text, borderColor: palette.border },
            ]}
            value={hexInput}
            onChangeText={handleHexChange}
            placeholder="8B5CF6"
            placeholderTextColor={palette.textSub}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        {/* Swatches Grid */}
        <Text style={[pickerStyles.sectionLabel, { color: palette.textSub }]}>PALETA DE TONOS RÁPIDOS</Text>
        <ScrollView style={pickerStyles.tonesScroll} showsVerticalScrollIndicator={false}>
          {PALETTE_TONES.map((row, rIdx) => (
            <View key={rIdx} style={pickerStyles.tonesRow}>
              {row.map((col) => {
                const isActive = selectedColor.toLowerCase() === col.toLowerCase();
                return (
                  <Pressable
                    key={col}
                    style={[
                      pickerStyles.toneCircle,
                      { backgroundColor: col },
                      isActive && [pickerStyles.toneCircleActive, { borderColor: palette.text }],
                    ]}
                    onPress={() => handlePickPreset(col)}
                  />
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Actions */}
        <View style={pickerStyles.actionRow}>
          <Pressable style={[pickerStyles.cancelBtn, { borderColor: palette.border }]} onPress={onClose}>
            <Text style={[pickerStyles.cancelBtnText, { color: palette.textSub }]}>Cancelar</Text>
          </Pressable>
          <Pressable style={[pickerStyles.applyBtn, { backgroundColor: palette.primary }]} onPress={handleApply}>
            <Text style={pickerStyles.applyBtnText}>Aplicar Color</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ==========================================================
   MODAL PARA RENOMBRAR PALETA
========================================================== */
function RenamePaletteModal({
  visible,
  initialName,
  onClose,
  onSave,
  palette,
}: {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (newName: string) => void;
  palette: ColorPalette;
}) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  if (!visible) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    onClose();
  };

  return (
    <View style={renameStyles.overlayBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[renameStyles.container, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
        <View style={renameStyles.header}>
          <Ionicons name="pencil" size={17} color={palette.primary} />
          <Text style={[renameStyles.title, { color: palette.text }]}>CAMBIAR NOMBRE DE PALETA</Text>
        </View>
        <Text style={[renameStyles.subtitle, { color: palette.textSub }]}>
          Escribe el nuevo nombre para identificar esta combinación de colores
        </Text>

        <TextInput
          style={[
            renameStyles.input,
            { backgroundColor: palette.bg, color: palette.text, borderColor: palette.border },
          ]}
          value={name}
          onChangeText={setName}
          placeholder="Nombre de la paleta..."
          placeholderTextColor={palette.textSub}
          autoFocus
          maxLength={35}
        />

        <View style={renameStyles.actionRow}>
          <Pressable style={[renameStyles.cancelBtn, { borderColor: palette.border }]} onPress={onClose}>
            <Text style={[renameStyles.cancelBtnText, { color: palette.textSub }]}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[
              renameStyles.saveBtn,
              { backgroundColor: palette.primary },
              !name.trim() && { opacity: 0.5 },
            ]}
            onPress={handleSave}
            disabled={!name.trim()}
          >
            <Text style={renameStyles.saveBtnText}>Guardar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ==========================================================
   COMPONENTE MODAL DE SETTINGS CON MENÚ DESPLEGABLE DIRECTO
========================================================== */
function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const {
    userProfile,
    setUserProfile,
    activePaletteId,
    customPalettes,
    typography,
    homeWidgets,
    setActivePalette,
    addCustomPalette,
    updatePalette,
    deleteCustomPalette,
    deletePalette,
    deletedPaletteIds,
    setTypography,
    toggleHomeWidget,
  } = useStore();

  const palette = getActivePalette({ activePaletteId, customPalettes, deletedPaletteIds });

  // Control de secciones desplegadas (por defecto 'palette' está abierta)
  const [expandedSection, setExpandedSection] = useState<'palette' | 'typography' | 'widgets' | 'profile' | null>('palette');

  const toggleSection = (sec: 'palette' | 'typography' | 'widgets' | 'profile') => {
    setExpandedSection(expandedSection === sec ? null : sec);
  };

  // Creador de paleta nueva (mínimo 2 colores, hasta 5 colores, 2 por defecto)
  const [isCreatingPalette, setIsCreatingPalette] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState('');
  const [newColors, setNewColors] = useState<string[]>(['#8B5CF6', '#F472B6']); // 2 por defecto
  const [newIsDark, setNewIsDark] = useState(false);

  // Estados interactivos para selector de color y renombre
  const [editingPaletteColor, setEditingPaletteColor] = useState<{
    paletteId: string;
    colorIndex: number;
    currentColor: string;
  } | null>(null);

  const [editingPaletteName, setEditingPaletteName] = useState<{
    paletteId: string;
    currentName: string;
  } | null>(null);

  const [pickingCustomColorSlot, setPickingCustomColorSlot] = useState<number | null>(null);

  const handleAddColorSlot = () => {
    if (newColors.length >= 5) return;
    const fallbackList = ['#10B981', '#06B6D4', '#F59E0B', '#F43F5E', '#A855F7', '#3B82F6'];
    const nextColor = fallbackList.find((c) => !newColors.includes(c)) || '#10B981';
    setNewColors([...newColors, nextColor]);
  };

  const handleRemoveColorSlot = (index: number) => {
    if (newColors.length <= 2) return; // Mínimo 2 colores
    setNewColors(newColors.filter((_, i) => i !== index));
  };

  const handleUpdateColorSlot = (index: number, color: string) => {
    const updated = [...newColors];
    updated[index] = color;
    setNewColors(updated);
  };

  const handleColorSelectedForPalette = (newColor: string) => {
    if (!editingPaletteColor) return;
    const { paletteId, colorIndex } = editingPaletteColor;
    const target = allPalettes.find((item) => item.id === paletteId);
    if (!target) return;
    const currentColors =
      target.colors && target.colors.length >= 2
        ? [...target.colors]
        : [target.primary, target.secondary];
    const updatedColors = [...currentColors];
    updatedColors[colorIndex] = newColor;
    updatePalette(paletteId, {
      colors: updatedColors,
      primary: updatedColors[0],
      secondary: updatedColors[1],
    });
    setEditingPaletteColor(null);
  };

  const handleSavePaletteName = (newName: string) => {
    if (!editingPaletteName || !newName.trim()) return;
    updatePalette(editingPaletteName.paletteId, { name: newName.trim() });
    setEditingPaletteName(null);
  };

  // Perfil
  const [editName, setEditName] = useState(userProfile?.name || 'Sergio Tamayo');
  const [editNick, setEditNick] = useState(userProfile?.nickname || 'Sertic77');

  const handleSaveCustomPalette = () => {
    if (!newPaletteName.trim() || newColors.length < 2) return;
    const finalColors = newColors.slice(0, 5);
    const prim = finalColors[0];
    const sec = finalColors[1];
    addCustomPalette({
      name: newPaletteName.trim(),
      colors: finalColors,
      primary: prim,
      secondary: sec,
      isDark: newIsDark,
      bg: newIsDark ? '#0F172A' : '#F8FAFC',
      cardBg: newIsDark ? '#1E293B' : '#FFFFFF',
      text: newIsDark ? '#F8FAFC' : '#0F172A',
      textSub: newIsDark ? '#94A3B8' : '#64748B',
      border: newIsDark ? '#334155' : '#CBD5E1',
      accent: prim,
    });
    setNewPaletteName('');
    setNewColors(['#8B5CF6', '#F472B6']);
    setIsCreatingPalette(false);
  };

  const handleSaveProfile = () => {
    setUserProfile({ name: editName.trim(), nickname: editNick.trim().replace('@', '') });
  };

  const allPalettes: ColorPalette[] = [
    ...PRESET_PALETTES.map((p) => {
      const overridden = customPalettes?.find((cp) => cp.id === p.id);
      return overridden || p;
    }),
    ...(customPalettes || []).filter((cp) => !PRESET_PALETTES.some((p) => p.id === cp.id)),
  ].filter((p) => !(deletedPaletteIds || []).includes(p.id));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        {/* Área superior transparente para descartar al pulsar */}
        <Pressable style={modalStyles.backdropTouchDismiss} onPress={onClose} />

        <View style={[modalStyles.sheetContainer, { backgroundColor: palette.cardBg }]}>
          {/* Barra de agarre superior */}
          <View style={[modalStyles.handleBar, { backgroundColor: palette.border }]} />

          {/* Header del Modal */}
          <View style={modalStyles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[modalStyles.modalTitle, { color: palette.text }]}>
                AJUSTES Y PERSONALIZACIÓN
              </Text>
              <Text style={[modalStyles.modalSubtitle, { color: palette.textSub }]}>
                Toca cada sección para desplegar sus opciones
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={modalStyles.closeBtn}>
              <Ionicons name="close-circle" size={26} color={palette.textSub} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 36 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ==========================================================
                OPCIÓN 1: PALETA DE COLOR (DESPLEGABLE)
            ========================================================== */}
            <View style={[modalStyles.accordionCard, { borderColor: palette.border }]}>
              <Pressable
                style={[
                  modalStyles.accordionHeader,
                  expandedSection === 'palette' && {
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  },
                ]}
                onPress={() => toggleSection('palette')}
              >
                <View style={[modalStyles.accordionIconBox, { backgroundColor: `${palette.primary}18` }]}>
                  <Ionicons name="color-palette-outline" size={20} color={palette.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[modalStyles.accordionTitle, { color: palette.text }]}>
                    Paleta de Color
                  </Text>
                  <Text style={[modalStyles.accordionDesc, { color: palette.textSub }]}>
                    Default, Modo Nocturno, Atardecer, etc. ({allPalettes.length} temas)
                  </Text>
                </View>
                <Ionicons
                  name={expandedSection === 'palette' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={palette.primary}
                />
              </Pressable>

              {expandedSection === 'palette' && (
                <View style={modalStyles.accordionContent}>
                  <Text style={[modalStyles.contentSubNotice, { color: palette.textSub }]}>
                    Elige una paleta con muestras de colores o crea tu propia combinación:
                  </Text>

                  {/* Grid / Lista de Paletas */}
                  <View style={modalStyles.paletteGrid}>
                    {allPalettes.map((p) => {
                      const isSelected = p.id === activePaletteId;
                      const sampleColors = p.colors && p.colors.length >= 2 ? p.colors : [p.primary, p.secondary];
                      return (
                        <Pressable
                          key={p.id}
                          style={[
                            modalStyles.paletteCard,
                            {
                              backgroundColor: p.cardBg,
                              borderColor: isSelected ? palette.primary : palette.border,
                              borderWidth: isSelected ? 2.5 : 1,
                            },
                          ]}
                          onPress={() => setActivePalette(p.id)}
                        >
                          <View style={modalStyles.paletteCardTop}>
                            <Pressable
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
                              onPress={(e) => {
                                e.stopPropagation();
                                setEditingPaletteName({
                                  paletteId: p.id,
                                  currentName: p.name,
                                });
                              }}
                              hitSlop={6}
                            >
                              <Text
                                style={[
                                  modalStyles.paletteCardName,
                                  { color: p.text },
                                  isSelected && { fontWeight: '900' },
                                ]}
                                numberOfLines={1}
                              >
                                {p.name}
                              </Text>
                              <Ionicons name="pencil-sharp" size={11} color={palette.textSub} style={{ opacity: 0.6 }} />
                            </Pressable>
                            {isSelected && (
                              <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
                            )}
                          </View>

                          {/* Muestras de colores */}
                          <View style={modalStyles.swatchesRow}>
                            {sampleColors.map((col, idx) => (
                              <Pressable
                                key={idx}
                                style={[
                                  modalStyles.swatchCircle,
                                  {
                                    backgroundColor: col,
                                    borderColor: '#FFFFFF',
                                    marginLeft: idx > 0 ? -6 : 0,
                                  },
                                ]}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  setEditingPaletteColor({
                                    paletteId: p.id,
                                    colorIndex: idx,
                                    currentColor: col,
                                  });
                                }}
                                hitSlop={6}
                              />
                            ))}

                            {/* Badge de cantidad de colores */}
                            <View
                              style={[
                                modalStyles.paletteColorsBadge,
                                {
                                  backgroundColor: `${p.primary}18`,
                                  borderColor: `${p.primary}35`,
                                },
                              ]}
                            >
                              <Text style={[modalStyles.paletteColorsBadgeText, { color: p.primary }]}>
                                {sampleColors.length === 2 ? '2 colores + opacidades' : `${sampleColors.length} colores`}
                              </Text>
                            </View>

                            {p.isDark && (
                              <View style={modalStyles.darkTagMini}>
                                <Ionicons name="moon" size={11} color={palette.textSub} />
                                <Text style={[modalStyles.darkTagText, { color: palette.textSub }]}>Dark</Text>
                              </View>
                            )}

                            <Pressable
                              style={modalStyles.deleteCustomBtn}
                              onPress={(e) => {
                                e.stopPropagation();
                                deletePalette(p.id);
                              }}
                              hitSlop={8}
                            >
                              <Ionicons name="trash-outline" size={15} color={palette.secondary} />
                            </Pressable>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Formulario de Crear Nueva Paleta */}
                  {!isCreatingPalette ? (
                    <Pressable
                      style={[modalStyles.createPaletteToggleBtn, { borderColor: palette.primary }]}
                      onPress={() => setIsCreatingPalette(true)}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
                      <Text style={[modalStyles.createPaletteToggleText, { color: palette.primary }]}>
                        Crear Nueva Paleta Personalizada (hasta 5 colores)
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={[modalStyles.customPaletteForm, { backgroundColor: palette.cardBg, borderWidth: 0 }]}>
                      <View style={modalStyles.customFormHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[modalStyles.customFormTitle, { color: palette.text }]}>
                            CREAR COMBINACIÓN DE COLORES
                          </Text>
                          <Text style={[modalStyles.customFormSubtitle, { color: palette.textSub }]}>
                            {newColors.length} de 5 colores configurados (mínimo 2, por defecto 2)
                          </Text>
                        </View>
                        <Pressable onPress={() => setIsCreatingPalette(false)}>
                          <Ionicons name="close" size={20} color={palette.textSub} />
                        </Pressable>
                      </View>

                      {/* Explicación de las opacidades */}
                      <View style={[modalStyles.paletteOpacityNotice, { backgroundColor: `${palette.primary}12`, borderColor: `${palette.primary}30` }]}>
                        <Ionicons name="color-filter-outline" size={16} color={palette.primary} />
                        <Text style={[modalStyles.paletteOpacityNoticeText, { color: palette.text }]}>
                          {newColors.length === 2
                            ? 'Con 2 colores, el tema genera automáticamente variaciones de opacidad (15%, 35%, 65%, 85%) para mantener la estética pulida y armónica en toda la app.'
                            : `Con ${newColors.length} colores, cada color se asigna a botones, gráficos, métricas y acentos, complementándose con opacidades.`}
                        </Text>
                      </View>

                      <Text style={[modalStyles.formLabel, { color: palette.textSub, marginTop: 10 }]}>
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
                        placeholderTextColor={palette.textSub}
                        value={newPaletteName}
                        onChangeText={setNewPaletteName}
                      />

                      {/* Lista dinámica de colores (2 a 5 colores) */}
                      {newColors.map((color, index) => {
                        const colorRole =
                          index === 0
                            ? 'Color 1 · Primario (Acentos y Títulos)'
                            : index === 1
                            ? 'Color 2 · Secundario (Botones y Llamas)'
                            : index === 2
                            ? 'Color 3 · Terciario (Métricas y Gráficos)'
                            : index === 3
                            ? 'Color 4 · Cuaternario (Destacados y Tarjetas)'
                            : 'Color 5 · Quinto Color (Detalles y Badges)';

                        return (
                          <View key={index} style={[modalStyles.colorSlotCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                            <View style={modalStyles.colorSlotHeader}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                <View style={[modalStyles.colorSlotNumberBadge, { backgroundColor: color }]}>
                                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>{index + 1}</Text>
                                </View>
                                <Text style={[modalStyles.colorSlotRoleText, { color: palette.text }]}>
                                  {colorRole}
                                </Text>
                              </View>

                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                {/* Muestra de opacidades en tiempo real */}
                                <View style={modalStyles.opacityMiniStrip}>
                                  <View style={[modalStyles.opacityMiniBlock, { backgroundColor: color }]} />
                                  <View style={[modalStyles.opacityMiniBlock, { backgroundColor: getPaletteColorWithAlpha(color, 0.5) }]} />
                                  <View style={[modalStyles.opacityMiniBlock, { backgroundColor: getPaletteColorWithAlpha(color, 0.2) }]} />
                                </View>

                                {/* Botón borrar para colores 3, 4, 5 */}
                                {index >= 2 && (
                                  <Pressable
                                    onPress={() => handleRemoveColorSlot(index)}
                                    hitSlop={8}
                                    style={modalStyles.removeColorBtn}
                                  >
                                    <Ionicons name="trash-outline" size={15} color={palette.secondary} />
                                  </Pressable>
                                )}
                              </View>
                            </View>

                            {/* Selector de muestras para este slot */}
                            <View style={modalStyles.swatchesPickRow}>
                              {COLOR_SWATCHES.map((swatchColor) => (
                                <Pressable
                                  key={swatchColor}
                                  style={[
                                    modalStyles.pickCircle,
                                    { backgroundColor: swatchColor },
                                    color === swatchColor && [modalStyles.pickCircleActive, { borderColor: palette.text }],
                                  ]}
                                  onPress={() => handleUpdateColorSlot(index, swatchColor)}
                                />
                              ))}

                              {/* Opción al final para abrir el selector de color personalizado */}
                              <Pressable
                                style={[
                                  modalStyles.pickCircle,
                                  modalStyles.customPickerBtn,
                                  {
                                    borderColor: palette.primary,
                                    backgroundColor: `${palette.primary}18`,
                                  },
                                  !COLOR_SWATCHES.includes(color) && [
                                    modalStyles.pickCircleActive,
                                    { borderColor: palette.text, backgroundColor: color },
                                  ],
                                ]}
                                onPress={() => setPickingCustomColorSlot(index)}
                                hitSlop={4}
                              >
                                <Ionicons
                                  name="color-palette-outline"
                                  size={16}
                                  color={!COLOR_SWATCHES.includes(color) ? '#FFFFFF' : palette.primary}
                                />
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}

                      {/* Botón para añadir hasta 5 colores */}
                      {newColors.length < 5 && (
                        <Pressable
                          style={({ pressed }) => [
                            modalStyles.addColorSlotBtn,
                            { borderColor: palette.primary, backgroundColor: `${palette.primary}10` },
                            pressed && { transform: [{ scale: 0.98 }] },
                          ]}
                          onPress={handleAddColorSlot}
                        >
                          <Ionicons name="add-circle" size={17} color={palette.primary} />
                          <Text style={[modalStyles.addColorSlotBtnText, { color: palette.primary }]}>
                            + Añadir Color {newColors.length + 1} (hasta 5 colores)
                          </Text>
                        </Pressable>
                      )}

                      <View style={modalStyles.themeSwitchRow}>
                        <Text style={[modalStyles.formLabel, { color: palette.textSub, marginBottom: 0 }]}>
                          Modo Nocturno / Fondo Oscuro
                        </Text>
                        <Switch
                          value={newIsDark}
                          onValueChange={setNewIsDark}
                          trackColor={{ false: palette.border, true: palette.primary }}
                          thumbColor="#FFFFFF"
                        />
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
                        <Text style={modalStyles.savePaletteBtnText}>
                          Guardar y Activar Paleta ({newColors.length} colores)
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* ==========================================================
                OPCIÓN 2: TIPOGRAFÍA (DESPLEGABLE)
            ========================================================== */}
            <View style={[modalStyles.accordionCard, { borderColor: palette.border }]}>
              <Pressable
                style={[
                  modalStyles.accordionHeader,
                  expandedSection === 'typography' && {
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  },
                ]}
                onPress={() => toggleSection('typography')}
              >
                <View style={[modalStyles.accordionIconBox, { backgroundColor: `${palette.secondary}18` }]}>
                  <Ionicons name="text-outline" size={20} color={palette.secondary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[modalStyles.accordionTitle, { color: palette.text }]}>
                    Tipografía
                  </Text>
                  <Text style={[modalStyles.accordionDesc, { color: palette.textSub }]}>
                    Títulos, subtítulos, textos y valores numéricos
                  </Text>
                </View>
                <Ionicons
                  name={expandedSection === 'typography' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={palette.secondary}
                />
              </Pressable>

              {expandedSection === 'typography' && (
                <View style={modalStyles.accordionContent}>
                  <Text style={[modalStyles.contentSubNotice, { color: palette.textSub }]}>
                    Personaliza independientemente el estilo de fuente para cada nivel de texto:
                  </Text>

                  <TypographyCategoryRow
                    categoryTitle="TÍTULOS"
                    categoryDesc="Encabezados grandes y nombres de módulos"
                    currentValue={typography?.titles || 'system'}
                    onSelect={(fontKey) => setTypography({ titles: fontKey })}
                    palette={palette}
                  />

                  <TypographyCategoryRow
                    categoryTitle="SUBTÍTULOS"
                    categoryDesc="Metas, etiquetas y encabezados de sección"
                    currentValue={typography?.subtitles || 'system'}
                    onSelect={(fontKey) => setTypography({ subtitles: fontKey })}
                    palette={palette}
                  />

                  <TypographyCategoryRow
                    categoryTitle="TEXTOS"
                    categoryDesc="Párrafos, notas, descripciones y listas"
                    currentValue={typography?.body || 'system'}
                    onSelect={(fontKey) => setTypography({ body: fontKey })}
                    palette={palette}
                  />

                  <TypographyCategoryRow
                    categoryTitle="DATOS Y NÚMEROS"
                    categoryDesc="Kcal, gramos, series, repeticiones y presión arterial"
                    currentValue={typography?.data || 'system'}
                    onSelect={(fontKey) => setTypography({ data: fontKey })}
                    palette={palette}
                  />

                  {/* VISTA PREVIA EN VIVO */}
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
                      <Ionicons name="sparkles" size={13} color={palette.primary} />
                      <Text style={[modalStyles.typePreviewTag, { color: palette.primary }]}>
                        VISTA PREVIA EN TIEMPO REAL
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
                      Resumen de Progreso
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
                      Estadísticas globales de entrenamiento y salud
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
                      Tu constancia diaria te permite subir de nivel y desbloquear nuevos rangos.
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
                        2,450 kcal · 145g P · 119/78 mmHg · 8 Días
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* ==========================================================
                OPCIÓN 3: QUÉ DATOS MOSTRAR EN EL HOME (DESPLEGABLE)
            ========================================================== */}
            <View style={[modalStyles.accordionCard, { borderColor: palette.border }]}>
              <Pressable
                style={[
                  modalStyles.accordionHeader,
                  expandedSection === 'widgets' && {
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  },
                ]}
                onPress={() => toggleSection('widgets')}
              >
                <View style={[modalStyles.accordionIconBox, { backgroundColor: `${palette.primary}18` }]}>
                  <Ionicons name="grid-outline" size={20} color={palette.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[modalStyles.accordionTitle, { color: palette.text }]}>
                    Qué datos mostrar en el home
                  </Text>
                  <Text style={[modalStyles.accordionDesc, { color: palette.textSub }]}>
                    Activa o desactiva las tarjetas de la pantalla principal
                  </Text>
                </View>
                <Ionicons
                  name={expandedSection === 'widgets' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={palette.primary}
                />
              </Pressable>

              {expandedSection === 'widgets' && (
                <View style={modalStyles.accordionContent}>
                  <Text style={[modalStyles.contentSubNotice, { color: palette.textSub }]}>
                    Enciende o apaga los módulos visibles según tus prioridades:
                  </Text>

                  <WidgetToggleRow
                    icon="nutrition-outline"
                    iconColor={palette.primary}
                    title="Nutrición y Macronutrientes"
                    desc="Calorías consumidas hoy vs meta y desglose de Proteína, Carbos y Grasas."
                    enabled={!!homeWidgets?.calories}
                    onToggle={() => toggleHomeWidget('calories')}
                    palette={palette}
                  />

                  <WidgetToggleRow
                    icon="barbell-outline"
                    iconColor={palette.secondary}
                    title="Entrenamiento del Día"
                    desc="Número de ejercicios registrados y total de series completadas hoy."
                    enabled={!!homeWidgets?.workout}
                    onToggle={() => toggleHomeWidget('workout')}
                    palette={palette}
                  />

                  <WidgetToggleRow
                    icon="medkit-outline"
                    iconColor={palette.primary}
                    title="Suplementación Diaria"
                    desc="Lista de suplementos del día y tomas completadas."
                    enabled={!!homeWidgets?.supplements}
                    onToggle={() => toggleHomeWidget('supplements')}
                    palette={palette}
                  />

                  <WidgetToggleRow
                    icon="pulse-outline"
                    iconColor={palette.secondary}
                    title="Biomarcadores de Salud"
                    desc="Últimos registros de Presión Arterial, Glucosa y semáforo clínico."
                    enabled={!!homeWidgets?.health}
                    onToggle={() => toggleHomeWidget('health')}
                    palette={palette}
                  />

                  <WidgetToggleRow
                    icon="body-outline"
                    iconColor={palette.primary}
                    title="Peso y Medidas Corporales"
                    desc="Último peso registrado en báscula y control antropométrico."
                    enabled={!!homeWidgets?.body}
                    onToggle={() => toggleHomeWidget('body')}
                    palette={palette}
                  />
                </View>
              )}
            </View>

            {/* ==========================================================
                OPCIÓN 4: PERFIL DE USUARIO
            ========================================================== */}
            <View style={[modalStyles.accordionCard, { borderColor: palette.border }]}>
              <Pressable
                style={[
                  modalStyles.accordionHeader,
                  expandedSection === 'profile' && {
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  },
                ]}
                onPress={() => toggleSection('profile')}
              >
                <View style={[modalStyles.accordionIconBox, { backgroundColor: `${palette.secondary}18` }]}>
                  <Ionicons name="person-outline" size={20} color={palette.secondary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[modalStyles.accordionTitle, { color: palette.text }]}>
                    Perfil de Usuario
                  </Text>
                  <Text style={[modalStyles.accordionDesc, { color: palette.textSub }]}>
                    {editName} (@{editNick.replace('@', '')})
                  </Text>
                </View>
                <Ionicons
                  name={expandedSection === 'profile' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={palette.secondary}
                />
              </Pressable>

              {expandedSection === 'profile' && (
                <View style={modalStyles.accordionContent}>
                  <Text style={[modalStyles.formLabel, { color: palette.textSub }]}>
                    Nombre completo
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
                    value={editName}
                    onChangeText={setEditName}
                    onBlur={handleSaveProfile}
                  />

                  <Text style={[modalStyles.formLabel, { color: palette.textSub, marginTop: 8 }]}>
                    Nickname / Usuario
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
                    value={editNick}
                    onChangeText={setEditNick}
                    onBlur={handleSaveProfile}
                    autoCapitalize="none"
                  />
                </View>
              )}
            </View>
          </ScrollView>

          {/* Botón inferior para cerrar */}
          <View style={[modalStyles.modalFooter, { borderTopColor: palette.border }]}>
            <Pressable
              style={[modalStyles.doneBtn, { backgroundColor: palette.primary }]}
              onPress={() => {
                handleSaveProfile();
                onClose();
              }}
            >
              <Text style={modalStyles.doneBtnText}>Guardar y Listo</Text>
            </Pressable>
          </View>
        </View>

        {/* Modal para Editar Nombre de Paleta */}
        <RenamePaletteModal
          visible={editingPaletteName !== null}
          initialName={editingPaletteName?.currentName || ''}
          onClose={() => setEditingPaletteName(null)}
          onSave={handleSavePaletteName}
          palette={palette}
        />

        {/* Modal para Cambiar Color de una Paleta Existente */}
        <ColorPickerModal
          visible={editingPaletteColor !== null}
          initialColor={editingPaletteColor?.currentColor || '#8B5CF6'}
          title={editingPaletteColor ? `Cambiar Color ${editingPaletteColor.colorIndex + 1}` : 'Elegir Color'}
          onClose={() => setEditingPaletteColor(null)}
          onSelectColor={handleColorSelectedForPalette}
          palette={palette}
        />

        {/* Modal para Seleccionar Color Personalizado en Nueva Paleta */}
        <ColorPickerModal
          visible={pickingCustomColorSlot !== null}
          initialColor={pickingCustomColorSlot !== null ? newColors[pickingCustomColorSlot] : '#8B5CF6'}
          title={pickingCustomColorSlot !== null ? `Color ${pickingCustomColorSlot + 1} Personalizado` : 'Color Personalizado'}
          onClose={() => setPickingCustomColorSlot(null)}
          onSelectColor={(selectedColor) => {
            if (pickingCustomColorSlot !== null) {
              handleUpdateColorSlot(pickingCustomColorSlot, selectedColor);
              setPickingCustomColorSlot(null);
            }
          }}
          palette={palette}
        />
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
                    fontWeight: isSelected ? '800' : '600',
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
        trackColor={{ false: palette.border, true: palette.primary }}
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
    paddingTop: 12,
    paddingBottom: 110,
  },

  // Perfil superior sticky fijo
  userHeroSticky: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 14 : 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 20,
    elevation: 3,
  },
  userHeroTransparent: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 16,
  },
  userHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroCenterCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  heroName: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroNickDate: {
    fontSize: 11,
    marginTop: 1,
  },
  heroRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  heroRankText: {
    fontSize: 11,
    fontWeight: '800',
  },
  heroXpTrack: {
    height: 5,
    borderRadius: 3,
    marginTop: 6,
    overflow: 'hidden',
  },
  heroXpFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Lado derecho del héroe: Ajustes y Racha
  heroRightCol: {
    alignItems: 'center',
    gap: 6,
  },
  heroSettingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroStreakBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 42,
  },
  heroStreakNum: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 15,
  },
  heroStreakLabel: {
    fontSize: 9,
    fontWeight: '800',
  },
  heroStreakHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  heroStreakNumHorizontal: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
  heroStreakLabelHorizontal: {
    fontSize: 9,
    fontWeight: '800',
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
    alignItems: 'center',
  },
  macroPillLabel: {
    fontSize: 10,
    fontWeight: '800',
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
   ESTILOS DEL MODAL DE SETTINGS CON MENÚ DESPLEGABLE
========================================================== */
const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  backdropTouchDismiss: {
    flex: 1,
  },
  sheetContainer: {
    maxHeight: '90%',
    minHeight: '65%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 12,
  },
  handleBar: {
    width: 44,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },

  // Tarjetas del Acordeón Desplegable
  accordionCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  accordionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accordionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  accordionDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  accordionContent: {
    padding: 14,
  },
  contentSubNotice: {
    fontSize: 12,
    marginBottom: 12,
  },

  // Grid de Paletas
  paletteGrid: {
    gap: 10,
    marginBottom: 14,
  },
  paletteCard: {
    padding: 14,
    borderRadius: 14,
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
  paletteColorsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 6,
  },
  paletteColorsBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  swatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swatchCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  darkTagMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  darkTagText: {
    fontSize: 10,
    fontWeight: '700',
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
    marginBottom: 6,
  },
  createPaletteToggleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  customPaletteForm: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 0,
    marginTop: 4,
    marginBottom: 6,
  },
  customFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customFormTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  customFormSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  paletteOpacityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  paletteOpacityNoticeText: {
    fontSize: 11.5,
    flex: 1,
    lineHeight: 16,
  },
  colorSlotCard: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  colorSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  colorSlotNumberBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSlotRoleText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  opacityMiniStrip: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  opacityMiniBlock: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  removeColorBtn: {
    padding: 4,
  },
  addColorSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  addColorSlotBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
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
    marginBottom: 6,
  },
  pickCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  pickCircleActive: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  customPickerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  themeSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  savePaletteBtn: {
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  savePaletteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // Tipografía
  typeCategoryCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  typeCategoryTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  typeCategoryDesc: {
    fontSize: 10,
    marginBottom: 8,
  },
  typeOptionsGrid: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  typePillOption: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  typePillOptionLabel: {
    fontSize: 12,
  },

  // Vista previa tipografía
  typePreviewCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  typePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  typePreviewTag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  typePreviewTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  typePreviewSub: {
    fontSize: 12,
    marginBottom: 4,
  },
  typePreviewBody: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  typePreviewDataRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(203, 213, 225, 0.4)',
  },
  typePreviewDataVal: {
    fontSize: 12,
    fontWeight: '800',
  },

  // Toggle de Widgets
  widgetToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  widgetIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  widgetTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  widgetDesc: {
    fontSize: 10,
    lineHeight: 14,
  },

  // Footer modal
  modalFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  doneBtn: {
    height: 46,
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

/* ==========================================================
   ESTILOS PARA SELECTOR DE COLOR Y RENOMBRAR PALETA
========================================================== */
const pickerStyles = StyleSheet.create({
  overlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 9999,
    elevation: 20,
  },
  container: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  previewCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewHex: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 1,
  },
  opacityChips: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  opacityChip: {
    width: 12,
    height: 22,
    borderRadius: 4,
  },
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  hexPrefix: {
    height: 40,
    width: 40,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexPrefixText: {
    fontSize: 16,
    fontWeight: '900',
  },
  hexInput: {
    flex: 1,
    height: 40,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  tonesScroll: {
    maxHeight: 160,
    marginBottom: 14,
  },
  tonesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toneCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  toneCircleActive: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  applyBtn: {
    flex: 1.4,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
});

const renameStyles = StyleSheet.create({
  overlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 9999,
    elevation: 20,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    marginBottom: 12,
    lineHeight: 15,
  },
  input: {
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1.2,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
});
