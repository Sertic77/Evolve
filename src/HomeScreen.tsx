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
import { C, fmt } from './theme';
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
  const palette = getActivePalette({ activePaletteId, customPalettes });

  // Fecha de hoy
  const today = new Date();
  const todayKeyStr = dateKey(today);

  const rawDayStr = today.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const dayStrClean = rawDayStr.replace('.', '');
  const weekdayStr = today.toLocaleDateString('es-ES', { weekday: 'long' });
  const capitalizedWeekday = weekdayStr.charAt(0).toUpperCase() + weekdayStr.slice(1);

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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ==========================================================
            HEADER PRINCIPAL: NOMBRE Y NICKNAME (ARRIBA A LA IZQUIERDA)
            + BOTÓN DE AJUSTES (ARRIBA A LA DERECHA)
        ========================================================== */}
        <View style={styles.topHeaderRow}>
          <View style={styles.userInfoLeft}>
            {/* Avatar con iniciales */}
            <LinearGradient
              colors={[palette.primary, palette.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarInitials}>{initials}</Text>
            </LinearGradient>

            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={styles.nameRow}>
                <Text
                  style={[styles.userNameText, { color: palette.text, fontFamily: titleFont }]}
                  numberOfLines={1}
                >
                  {userName}
                </Text>
              </View>
              <View style={styles.subUserRow}>
                <Text
                  style={[styles.userNickText, { color: palette.primary, fontFamily: subtitleFont }]}
                >
                  {userNick}
                </Text>
                <Text style={[styles.dateDot, { color: palette.textSub }]}>·</Text>
                <Text
                  style={[styles.dateSmallText, { color: palette.textSub, fontFamily: bodyFont }]}
                >
                  {capitalizedWeekday}, {dayStrClean}
                </Text>
              </View>
            </View>
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
            WIDGET 1: BLOQUE DE NIVEL RPG CON NOMBRE Y NICKNAME INTEGRADO
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
                <View style={styles.rpgIdentityBlock}>
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
                  <Text
                    style={[styles.rpgHeroName, { color: palette.text, fontFamily: titleFont }]}
                  >
                    {userName}{' '}
                    <Text style={{ fontSize: 13, color: palette.textSub, fontWeight: '500' }}>
                      ({userNick})
                    </Text>
                  </Text>
                </View>

                <View style={[styles.streakPill, { borderColor: palette.secondary }]}>
                  <Ionicons name="flame" size={16} color={palette.secondary} />
                  <Text
                    style={[
                      styles.streakText,
                      { color: palette.secondary, fontFamily: dataFont },
                    ]}
                  >
                    {Math.max(1, totalDaysLogged)} Días
                  </Text>
                </View>
              </View>

              <View style={styles.xpInfoRow}>
                <Text style={[styles.rpgSubtitle, { color: palette.textSub, fontFamily: bodyFont }]}>
                  Rango Élite · Experiencia
                </Text>
                <Text style={[styles.xpCountText, { color: palette.text, fontFamily: dataFont }]}>
                  {xpCurrent * 30} / 3,000 XP
                </Text>
              </View>

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
            Personalizar temas, tipografías y datos del Home
          </Text>
        </Pressable>
      </ScrollView>

      {/* ==========================================================
          MODAL POPUP DE SETTINGS CON MENÚ DESPLEGABLE (ACCORDION):
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
    deleteCustomPalette,
    setTypography,
    toggleHomeWidget,
  } = useStore();

  const palette = getActivePalette({ activePaletteId, customPalettes });

  // Control de secciones desplegadas (por defecto 'palette' está abierta)
  const [expandedSection, setExpandedSection] = useState<'palette' | 'typography' | 'widgets' | 'profile' | null>('palette');

  const toggleSection = (sec: 'palette' | 'typography' | 'widgets' | 'profile') => {
    setExpandedSection(expandedSection === sec ? null : sec);
  };

  // Creador de paleta nueva
  const [isCreatingPalette, setIsCreatingPalette] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState('');
  const [newPrimaryColor, setNewPrimaryColor] = useState('#8B5CF6');
  const [newSecondaryColor, setNewSecondaryColor] = useState('#F472B6');
  const [newIsDark, setNewIsDark] = useState(false);

  // Perfil
  const [editName, setEditName] = useState(userProfile?.name || 'Sergio Tamayo');
  const [editNick, setEditNick] = useState(userProfile?.nickname || 'Sertic77');

  const handleSaveCustomPalette = () => {
    if (!newPaletteName.trim()) return;
    addCustomPalette({
      name: newPaletteName.trim(),
      colors: [newPrimaryColor, newSecondaryColor],
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

  const handleSaveProfile = () => {
    setUserProfile({ name: editName.trim(), nickname: editNick.trim().replace('@', '') });
  };

  const allPalettes: ColorPalette[] = [...PRESET_PALETTES, ...(customPalettes || [])];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        {/* Área superior transparente que cierra al pulsar (sin robar toques de la hoja) */}
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
                <View style={[modalStyles.accordionIconBox, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
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
                    Elige una paleta con muestras de mínimo 2 colores o crea una propia:
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
                            {isSelected && (
                              <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
                            )}
                          </View>

                          {/* Muestras de colores (mínimo 2 colores variables) + muestra de fondo */}
                          <View style={modalStyles.swatchesRow}>
                            {sampleColors.map((col, idx) => (
                              <View
                                key={idx}
                                style={[
                                  modalStyles.swatchCircle,
                                  {
                                    backgroundColor: col,
                                    borderColor: '#FFFFFF',
                                    marginLeft: idx > 0 ? -6 : 0,
                                  },
                                ]}
                              />
                            ))}

                            <View
                              style={[
                                modalStyles.swatchCircle,
                                {
                                  backgroundColor: p.bg,
                                  borderColor: p.border,
                                  marginLeft: 6,
                                },
                              ]}
                            />

                            {p.isDark && (
                              <View style={modalStyles.darkTagMini}>
                                <Ionicons name="moon" size={11} color="#94A3B8" />
                                <Text style={modalStyles.darkTagText}>Dark</Text>
                              </View>
                            )}

                            {p.custom && (
                              <Pressable
                                style={modalStyles.deleteCustomBtn}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  deleteCustomPalette(p.id);
                                }}
                                hitSlop={8}
                              >
                                <Ionicons name="trash-outline" size={15} color="#EF4444" />
                              </Pressable>
                            )}
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
                        + Crear Nueva Paleta Personalizada
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={[modalStyles.customPaletteForm, { borderColor: palette.border }]}>
                      <View style={modalStyles.customFormHeader}>
                        <Text style={[modalStyles.customFormTitle, { color: palette.text }]}>
                          CREAR COMBINACIÓN DE COLORES
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

                      <Text style={[modalStyles.formLabel, { color: palette.textSub, marginTop: 10 }]}>
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

                      <View style={modalStyles.themeSwitchRow}>
                        <Text style={[modalStyles.formLabel, { color: palette.textSub, marginBottom: 0 }]}>
                          Modo Nocturno / Fondo Oscuro
                        </Text>
                        <Switch
                          value={newIsDark}
                          onValueChange={setNewIsDark}
                          trackColor={{ false: '#CBD5E1', true: palette.primary }}
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
                        <Text style={modalStyles.savePaletteBtnText}>Guardar y Activar Paleta</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* ==========================================================
                OPCIÓN 2: TIPOGRAFÍA (DESPLEGABLE)
                - Títulos
                - Subtítulos
                - Textos
                - Datos
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
                <View style={[modalStyles.accordionIconBox, { backgroundColor: 'rgba(236, 72, 153, 0.12)' }]}>
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

                  {/* 1. TÍTULOS */}
                  <TypographyCategoryRow
                    categoryTitle="TÍTULOS"
                    categoryDesc="Encabezados grandes y nombres de módulos"
                    currentValue={typography?.titles || 'system'}
                    onSelect={(fontKey) => setTypography({ titles: fontKey })}
                    palette={palette}
                  />

                  {/* 2. SUBTÍTULOS */}
                  <TypographyCategoryRow
                    categoryTitle="SUBTÍTULOS"
                    categoryDesc="Metas, etiquetas y encabezados de sección"
                    currentValue={typography?.subtitles || 'system'}
                    onSelect={(fontKey) => setTypography({ subtitles: fontKey })}
                    palette={palette}
                  />

                  {/* 3. TEXTOS */}
                  <TypographyCategoryRow
                    categoryTitle="TEXTOS"
                    categoryDesc="Párrafos, notas, descripciones y listas"
                    currentValue={typography?.body || 'system'}
                    onSelect={(fontKey) => setTypography({ body: fontKey })}
                    palette={palette}
                  />

                  {/* 4. DATOS / NÚMEROS */}
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
                <View style={[modalStyles.accordionIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                  <Ionicons name="grid-outline" size={20} color="#10B981" />
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
                  color="#10B981"
                />
              </Pressable>

              {expandedSection === 'widgets' && (
                <View style={modalStyles.accordionContent}>
                  <Text style={[modalStyles.contentSubNotice, { color: palette.textSub }]}>
                    Enciende o apaga los módulos visibles según tus prioridades:
                  </Text>

                  <WidgetToggleRow
                    icon="sparkles-outline"
                    iconColor={palette.primary}
                    title="Nivel RPG y Racha de Días"
                    desc="Tu nivel de atleta, experiencia y racha de hábitos activa."
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
                    desc="Lista de suplementos del día y tomas completadas."
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
                    desc="Último peso registrado en báscula y control antropométrico."
                    enabled={!!homeWidgets?.body}
                    onToggle={() => toggleHomeWidget('body')}
                    palette={palette}
                  />
                </View>
              )}
            </View>

            {/* ==========================================================
                OPCIÓN 4: PERFIL DEL USUARIO (NOMBRE Y NICKNAME)
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
                <View style={[modalStyles.accordionIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                  <Ionicons name="person-outline" size={20} color="#3B82F6" />
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
                  color="#3B82F6"
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
  userInfoLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  subUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  userNickText: {
    fontSize: 12,
    fontWeight: '800',
  },
  dateDot: {
    marginHorizontal: 5,
    fontSize: 12,
  },
  dateSmallText: {
    fontSize: 12,
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
    marginLeft: 12,
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
  rpgIdentityBlock: {
    flex: 1,
    marginRight: 10,
  },
  rpgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  rpgBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  rpgHeroName: {
    fontSize: 16,
    fontWeight: '800',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(244, 114, 182, 0.08)',
  },
  streakText: {
    fontSize: 12,
    fontWeight: '800',
  },
  xpInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rpgSubtitle: {
    fontSize: 11,
  },
  xpCountText: {
    fontSize: 11,
    fontWeight: '700',
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
   ESTILOS DEL MODAL DE SETTINGS CON MENÚ DESPLEGABLE
========================================================== */
const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  backdropTouchDismiss: {
    flex: 1, // Cubre únicamente la zona superior transparente
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
    color: '#94A3B8',
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
    borderWidth: 1,
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
