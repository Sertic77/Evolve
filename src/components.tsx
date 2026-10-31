import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, GRADIENTS, fmt, registerThemeSheet, getPaletteColorWithAlpha } from './theme';
import { FoodUnit, Ingredient, Macros, MealBlock, MealItem, scaleMacros, itemsTotal, uid, useStore, getActivePalette, ColorPalette } from './store';

/* ---------------- Resumen de Macros (Animado con Fondo Flotante Anime) ---------------- */
export function MacroSummary({ m }: { m: Macros }) {
  const activePaletteId = useStore((st) => st.activePaletteId);
  const customPalettes = useStore((st) => st.customPalettes);
  const homeWidgets = useStore((st) => st.homeWidgets);
  const palette = getActivePalette({ activePaletteId, customPalettes });

  const size = 152;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  // Valores de Animación Anime
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flameTranslateY = useRef(new Animated.Value(0)).current;
  const flameRotate = useRef(new Animated.Value(0)).current;
  const flameAura = useRef(new Animated.Value(0.4)).current;
  const ringScaleAnim = useRef(new Animated.Value(0.88)).current;
  const barsAnim = useRef(new Animated.Value(0)).current;
  const cardEntryAnim = useRef(new Animated.Value(0)).current;
  const [ringProgress, setRingProgress] = useState(0);

  // Animación del Fondo de Energía Flotante Anime
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;

  const flameRotateDeg = flameRotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-6deg', '6deg'],
  });

  useEffect(() => {
    // 1. Animación de Entrada coordinada de la tarjeta, anillo de macros y barras
    cardEntryAnim.setValue(0);
    setRingProgress(0);
    barsAnim.setValue(0);
    ringScaleAnim.setValue(0.88);

    const listenerId = cardEntryAnim.addListener(({ value }) => {
      setRingProgress(value);
    });

    Animated.parallel([
      Animated.timing(cardEntryAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.spring(ringScaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.timing(barsAnim, {
        toValue: 1,
        duration: 1250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    // 2. Pulso expresivo continuo de la llama de Kcal ganadas (pulso, movimiento y brillo verde)
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 750,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(flameAura, {
            toValue: 0.85,
            duration: 750,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.94,
            duration: 750,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(flameAura, {
            toValue: 0.35,
            duration: 750,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    pulseLoop.start();

    const bobbingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameTranslateY, {
          toValue: -3.5,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flameTranslateY, {
          toValue: 2,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    bobbingLoop.start();

    const tiltLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameRotate, {
          toValue: 1,
          duration: 480,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(flameRotate, {
          toValue: -1,
          duration: 480,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    tiltLoop.start();

    // 4. Animación continua de fondo flotante anime (ondas de maná/energía)
    const bgLoop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim1, {
          toValue: 1,
          duration: 4500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim1, {
          toValue: 0,
          duration: 4500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const bgLoop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim2, {
          toValue: 1,
          duration: 6000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim2, {
          toValue: 0,
          duration: 6000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    bgLoop1.start();
    bgLoop2.start();

    return () => {
      cardEntryAnim.removeListener(listenerId);
      pulseLoop.stop();
      bobbingLoop.stop();
      tiltLoop.stop();
      bgLoop1.stop();
      bgLoop2.stop();
    };
  }, [m.kcal, m.protein, m.carbs, m.fat]);

  const kc = {
    carbs: (m.carbs || 0) * 4,
    protein: (m.protein || 0) * 4,
    fat: (m.fat || 0) * 9,
  };
  const totalMacrosKcal = kc.carbs + kc.protein + kc.fat;

  const paletteColors =
    palette.colors && palette.colors.length >= 2
      ? palette.colors
      : [palette.primary, palette.secondary];

  const c1 = paletteColors[0] || palette.primary;
  const c2 = paletteColors[1] || palette.secondary;
  const c3 =
    paletteColors[2] ||
    (palette.accent && palette.accent !== c1 && palette.accent !== c2
      ? palette.accent
      : (c1.startsWith('#8') || c1.startsWith('#6') || c1.startsWith('#3') || c1.startsWith('#4'))
      ? '#F59E0B'
      : '#06B6D4');

  const colorProtein = c1;
  const colorCarbs = c2;
  const colorFat = c3;
  const colorSugar = paletteColors[4] || palette.accent || palette.primary;

  const macroColors = {
    protein: colorProtein,
    carbs: colorCarbs,
    fat: colorFat,
  };

  let offset = 0;
  const segs = (['protein', 'carbs', 'fat'] as const).map((k) => {
    const len = totalMacrosKcal > 0 ? (kc[k] / totalMacrosKcal) * circ : 0;
    const s = { k, len, offset, color: macroColors[k] };
    offset += len;
    return s;
  });

  // Interpolaciones para el fondo animado
  const transX1 = floatAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 25],
  });
  const transY1 = floatAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 15],
  });

  const transX2 = floatAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [20, -25],
  });
  const transY2 = floatAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [15, -15],
  });

  const cardTranslateY = cardEntryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const cardScale = cardEntryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1],
  });

  return (
    <Animated.View
      style={[
        s.glassCard,
        {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderColor: 'transparent',
          shadowOpacity: 0,
          elevation: 0,
          opacity: cardEntryAnim,
          transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
        },
      ]}
    >
      {/* CAPA DE FONDO ANIMADO ANIME (Orbes de Energía Flotante) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none" />

      <LinearGradient
        colors={['transparent', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.cardGradient, { borderWidth: 0 }]}
      >
        {/* Cabecera estilo Anime */}
        <View style={s.hudHeader}>
          <View
            style={[
              s.hudBadge,
              {
                backgroundColor: getPaletteColorWithAlpha(palette.primary, 0.12),
                borderColor: getPaletteColorWithAlpha(palette.primary, 0.28),
              },
            ]}
          >
            <Ionicons name="sparkles" size={11} color={palette.primary} />
            <Text style={[s.hudBadgeText, { color: palette.primary }]}>✦ BALANCE DEL DÍA ✦</Text>
          </View>
          <Text style={s.kanjiDecor}>栄養ログ</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
          {/* Anillo de Calorías con Animación de Escala y Pulso */}
          <Animated.View
            style={[
              { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
              { transform: [{ scale: ringScaleAnim }] },
            ]}
          >
            <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
              {/* Fondo del anillo */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke="rgba(203, 213, 225, 0.35)"
                strokeWidth={stroke}
                fill="none"
              />

              {/* Segmentos de Macros Pastel */}
              {segs.map((g) =>
                g.len > 0 ? (
                  <Circle
                    key={g.k}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={g.color || C[g.k]}
                    strokeWidth={stroke}
                    fill="none"
                    strokeDasharray={`${g.len * Math.max(0.001, ringProgress)} ${circ}`}
                    strokeDashoffset={-g.offset * ringProgress}
                    strokeLinecap="round"
                  />
                ) : null,
              )}
            </Svg>

            {/* Centro del Anillo: LLAMA DE FUEGO VERDE (KCAL GANADAS) CON AURA Y ANIMACIÓN */}
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
              <View
                style={[
                  s.ringCenterGlow,
                  {
                    backgroundColor: getPaletteColorWithAlpha(palette.primary, 0.08),
                    borderColor: getPaletteColorWithAlpha(palette.primary, 0.25),
                  },
                ]}
              >
                <View style={{ width: 44, height: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
                  <Animated.View
                    style={[
                      s.flameHaloGlowGreen,
                      {
                        transform: [{ scale: pulseAnim }],
                        opacity: flameAura,
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      s.flameContainer,
                      {
                        transform: [
                          { translateY: flameTranslateY },
                          { rotate: flameRotateDeg },
                          { scale: pulseAnim },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name="flame" size={32} color={palette.primary} />
                  </Animated.View>
                </View>
                <Text style={[s.kcalBigNumber, palette.isDark && { color: '#FFFFFF' }]}>{Math.round((m.kcal || 0) * ringProgress)}</Text>
                <Text style={[s.kcalUnit, { color: palette.primary }]}>KCAL GANADAS</Text>
              </View>
            </View>
          </Animated.View>

          {/* Barras de Macros Anime Pastel Animadas */}
          <View style={{ flex: 1, marginLeft: 18, gap: homeWidgets?.sugar ? 8 : 11 }}>
            {[
              { label: 'Proteína', icon: 'flash' as const, color: colorProtein, val: m.protein, pct: totalMacrosKcal > 0 ? Math.round((kc.protein / totalMacrosKcal) * 100) : 0 },
              { label: 'Carbos', icon: 'leaf' as const, color: colorCarbs, val: m.carbs, pct: totalMacrosKcal > 0 ? Math.round((kc.carbs / totalMacrosKcal) * 100) : 0 },
              { label: 'Grasas', icon: 'water' as const, color: colorFat, val: m.fat, pct: totalMacrosKcal > 0 ? Math.round((kc.fat / totalMacrosKcal) * 100) : 0 },
              ...(homeWidgets?.sugar
                ? [{ label: 'Azúcar', icon: 'cube-outline' as const, color: colorSugar, val: m.sugar || 0, pct: m.carbs > 0 ? Math.min(100, Math.round(((m.sugar || 0) / m.carbs) * 100)) : 0 }]
                : []),
            ].map(({ label, icon, color, val, pct }) => {
              return (
                <View key={label}>
                  <View style={s.statRowHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name={icon} size={12} color={color} />
                      <Text style={s.statLabel}>{label}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[s.statValue, { color }]}>{fmt(val * ringProgress)}g</Text>
                      <Text style={s.statPct}>{Math.round(pct * ringProgress)}%</Text>
                    </View>
                  </View>
                  <View style={s.statTrack}>
                    <Animated.View
                      style={[
                        s.statFill,
                        {
                          backgroundColor: color,
                          width: barsAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', `${pct}%`],
                          }),
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

/* ---------------- Selector Maestro Principal con Píldora Deslizante Animada (Nivel 1) ---------------- */
export function MainNavigationSegmented({
  value,
  onChange,
}: {
  value: number;
  onChange: (i: number) => void;
}) {
  const options = [
    { label: 'Registrar comidas', icon: 'restaurant-outline' },
    { label: 'Ingredientes y comidas', icon: 'library-outline' },
  ];

  const activePaletteId = useStore((st) => st.activePaletteId);
  const customPalettes = useStore((st) => st.customPalettes);
  const palette = getActivePalette({ activePaletteId, customPalettes });

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
      style={[
        s.mainSegmentedContainer,
        {
          borderColor: getPaletteColorWithAlpha(palette.primary, 0.25),
          shadowColor: palette.primary,
          backgroundColor: palette.bg,
          marginBottom: 4,
        },
      ]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Píldora Deslizante Animada Ultra Smooth */}
      {containerWidth > 0 && (
        <Animated.View
          style={[
            s.slidingPill,
            {
              width: pillWidth,
              transform: [{ translateX }],
              shadowColor: palette.primary,
            },
          ]}
        >
          <LinearGradient
            colors={[palette.primary, palette.secondary]}
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
              color={active ? '#FFFFFF' : palette.textSub}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                s.mainSegmentedText,
                active ? s.mainSegmentedTextActive : [s.mainSegmentedTextInactive, { color: palette.textSub }],
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

/* ---------------- Selector Segmentado Tradicional con Píldora Deslizante Animada ---------------- */
export function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: number;
  onChange: (i: number) => void;
}) {
  const activePaletteId = useStore((st) => st.activePaletteId);
  const customPalettes = useStore((st) => st.customPalettes);
  const palette = getActivePalette({ activePaletteId, customPalettes });

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
    inputRange: options.map((_, idx) => idx),
    outputRange: options.map((_, idx) => 4 + idx * pillWidth),
  });

  return (
    <View
      style={[
        s.segmentedContainer,
        {
          borderColor: getPaletteColorWithAlpha(palette.primary, 0.25),
          shadowColor: palette.primary,
          backgroundColor: 'transparent',
        },
      ]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Píldora Deslizante Animada Pastel */}
      {containerWidth > 0 && (
        <Animated.View
          style={[
            s.segmentedSlidingPill,
            {
              width: pillWidth,
              transform: [{ translateX }],
              shadowColor: palette.primary,
            },
          ]}
        >
          <LinearGradient
            colors={[palette.primary, palette.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.segmentedSlidingPillGradient}
          />
        </Animated.View>
      )}

      {options.map((opt, i) => {
        const active = value === i;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(i)}
            style={s.segmentedBtn}
          >
            <Text
              style={[
                s.segmentedText,
                active ? s.segmentedTextActive : [s.segmentedTextInactive, { color: palette.textSub }],
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------------- Selector de Fecha (Date Bar Anime) ---------------- */
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  try {
    DateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch (e) {
    DateTimePicker = null;
  }
}

export function DateSelector({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const activePaletteId = useStore((st) => st.activePaletteId);
  const customPalettes = useStore((st) => st.customPalettes);
  const palette = getActivePalette({ activePaletteId, customPalettes });

  const [open, setOpen] = useState(false);

  // Valores de animación notoria para cambio de fecha (Slide, Fade, Scale y Glow Flash)
  const slideX = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowFlash = useRef(new Animated.Value(0)).current;

  // Botones de navegación con rebote elástico táctil
  const leftBounce = useRef(new Animated.Value(1)).current;
  const rightBounce = useRef(new Animated.Value(1)).current;

  const triggerDateTransition = (direction: -1 | 1) => {
    // 1. Rebote en el botón presionado
    const targetBounce = direction === -1 ? leftBounce : rightBounce;
    Animated.sequence([
      Animated.timing(targetBounce, {
        toValue: 0.76,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(targetBounce, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Transición marcada de deslizamiento, escala y destello de confirmación
    slideX.setValue(direction === 1 ? 48 : -48);
    fadeAnim.setValue(0.15);
    scaleAnim.setValue(0.86);
    glowFlash.setValue(1);

    Animated.parallel([
      Animated.spring(slideX, {
        toValue: 0,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(glowFlash, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.sin),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const shift = (n: number) => {
    const dir = n < 0 ? -1 : 1;
    triggerDateTransition(dir);
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    onChange(d);
  };

  const isToday = new Date().toDateString() === date.toDateString();
  const rawDateStr = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const label = rawDateStr.replace('.', '');

  return (
    <View style={s.dateSelectorRow}>
      <Animated.View style={{ transform: [{ scale: leftBounce }] }}>
        <Pressable
          onPress={() => shift(-1)}
          style={({ pressed }) => [
            s.dateNavBtn,
            {
              borderColor: getPaletteColorWithAlpha(palette.primary, 0.25),
              backgroundColor: palette.isDark ? '#1E293B' : '#FFFFFF',
            },
            pressed && s.btnPressed,
          ]}
          hitSlop={4}
        >
          <Ionicons name="chevron-back" size={20} color={palette.primary} />
        </Pressable>
      </Animated.View>

      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          s.dateCenterBtn,
          {
            borderColor: getPaletteColorWithAlpha(palette.primary, 0.25),
          },
          pressed && s.btnPressed,
        ]}
      >
        <LinearGradient
          colors={
            palette.isDark
              ? ['#1E293B', '#0F172A']
              : ['rgba(255, 255, 255, 0.98)', 'rgba(245, 248, 255, 0.96)']
          }
          style={s.dateCenterGradient}
        >
          {/* Destello de color anime pastel que confirma claramente el cambio de día */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: getPaletteColorWithAlpha(palette.primary, 0.22),
                opacity: glowFlash,
              },
            ]}
          />

          <Animated.View
            style={[
              s.dateAnimatedContentWrap,
              {
                opacity: fadeAnim,
                transform: [{ translateX: slideX }, { scale: scaleAnim }],
              },
            ]}
          >
            <Ionicons name="calendar" size={17} color={isToday ? palette.primary : palette.secondary} />
            <Text style={[s.dateLabelText, { color: palette.text }, isToday && { color: palette.primary, fontWeight: '900' }]}>
              {label}
            </Text>
            {isToday && (
              <View
                style={[
                  s.todayTag,
                  {
                    backgroundColor: getPaletteColorWithAlpha(palette.primary, 0.12),
                    borderColor: getPaletteColorWithAlpha(palette.primary, 0.25),
                  },
                ]}
              >
                <Text style={[s.todayTagText, { color: palette.primary }]}>HOY</Text>
              </View>
            )}
          </Animated.View>
        </LinearGradient>
      </Pressable>

      <Animated.View style={{ transform: [{ scale: rightBounce }] }}>
        <Pressable
          onPress={() => shift(1)}
          style={({ pressed }) => [
            s.dateNavBtn,
            {
              borderColor: getPaletteColorWithAlpha(palette.primary, 0.25),
              backgroundColor: palette.isDark ? '#1E293B' : '#FFFFFF',
            },
            pressed && s.btnPressed,
          ]}
          hitSlop={4}
        >
          <Ionicons name="chevron-forward" size={20} color={palette.primary} />
        </Pressable>
      </Animated.View>

      {open && DateTimePicker && (
        <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={s.modalBackdrop} onPress={() => setOpen(false)}>
            <Pressable
              style={[
                s.datePickerCard,
                {
                  backgroundColor: palette.isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: getPaletteColorWithAlpha(palette.primary, 0.35),
                },
              ]}
            >
              <DateTimePicker
                value={date}
                mode="date"
                display="inline"
                themeVariant={palette.isDark ? 'dark' : 'light'}
                accentColor={palette.primary}
                locale="es-ES"
                onChange={(_: any, d?: Date) => {
                  if (d) {
                    triggerDateTransition(d.getTime() >= date.getTime() ? 1 : -1);
                    onChange(d);
                  }
                  setOpen(false);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

/* ---------------- Chips de Macros Pastel con Alto Contraste ---------------- */
function getAccessibleMacroColor(hex: string, isDark: boolean): string {
  if (!hex) return isDark ? '#F8FAFC' : '#0F172A';
  const clean = hex.startsWith('#') ? hex.slice(0, 7) : `#${hex.slice(0, 6)}`;
  if (clean.length < 7) return hex;

  const r = parseInt(clean.slice(1, 3), 16) || 0;
  const g = parseInt(clean.slice(3, 5), 16) || 0;
  const b = parseInt(clean.slice(5, 7), 16) || 0;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  if (!isDark) {
    // En modo claro, si el color es muy claro (amarillo, menta pálida, cian claro, naranja claro)
    // oscurecemos armónicamente para garantizar un contraste nítido y legible
    if (brightness > 130) {
      const factor = brightness > 180 ? 0.52 : 0.65;
      const dr = Math.floor(r * factor);
      const dg = Math.floor(g * factor);
      const db = Math.floor(b * factor);
      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      return `#${toHex(dr)}${toHex(dg)}${toHex(db)}`;
    }
  } else {
    // En modo oscuro, si el color es muy oscuro lo aclaramos para que destaque
    if (brightness < 100) {
      const factor = 1.6;
      const lr = Math.min(255, Math.floor(r * factor + 45));
      const lg = Math.min(255, Math.floor(g * factor + 45));
      const lb = Math.min(255, Math.floor(b * factor + 45));
      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      return `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
    }
  }
  return clean;
}

export function MacroChips({ m, small }: { m: Macros; small?: boolean }) {
  const activePaletteId = useStore((st) => st.activePaletteId);
  const customPalettes = useStore((st) => st.customPalettes);
  const deletedPaletteIds = useStore((st) => st.deletedPaletteIds);
  const homeWidgets = useStore((st) => st.homeWidgets);
  const palette = getActivePalette({ activePaletteId, customPalettes, deletedPaletteIds });

  const pColors = palette.colors && palette.colors.length >= 2 ? palette.colors : [palette.primary, palette.secondary];
  const colorKcal = pColors[0] || palette.primary;
  const colorCarbs = pColors[1] || palette.secondary;
  const colorProtein = pColors[2] || pColors[0] || palette.primary;
  const colorFat = pColors[3] || pColors[1] || palette.secondary;
  const colorSugar = pColors[4] || palette.accent || palette.primary;

  return (
    <View style={s.chipsRow}>
      <MacroBadge icon="flame" color={colorKcal} text={`${Math.round(m.kcal || 0)} kcal`} small={small} palette={palette} />
      <MacroBadge icon="leaf" color={colorCarbs} text={`C ${fmt(m.carbs)}g`} small={small} palette={palette} />
      <MacroBadge icon="flash" color={colorProtein} text={`P ${fmt(m.protein)}g`} small={small} palette={palette} />
      <MacroBadge icon="water" color={colorFat} text={`G ${fmt(m.fat)}g`} small={small} palette={palette} />
      {homeWidgets?.sugar && (
        <MacroBadge icon="cube-outline" color={colorSugar} text={`Az ${fmt(m.sugar || 0)}g`} small={small} palette={palette} />
      )}
    </View>
  );
}

function MacroBadge({
  icon,
  color,
  text,
  small,
  palette,
}: {
  icon: any;
  color: string;
  text: string;
  small?: boolean;
  palette?: ColorPalette;
}) {
  const isDark = palette?.isDark ?? false;
  const accessibleColor = getAccessibleMacroColor(color, isDark);
  return (
    <View
      style={[
        s.macroBadgeContainer,
        {
          borderColor: `${accessibleColor}40`,
          backgroundColor: isDark ? `${accessibleColor}22` : `${accessibleColor}12`,
        },
        small && { paddingHorizontal: 7, paddingVertical: 3 },
      ]}
    >
      <Ionicons name={icon} size={small ? 10 : 12} color={accessibleColor} style={{ marginRight: 4 }} />
      <Text
        style={[
          s.macroBadgeText,
          { color: accessibleColor, fontWeight: '800' },
          small && { fontSize: 11 },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

/* ---------------- MODAL ROBUSTO DE BÚSQUEDA DE INGREDIENTES ---------------- */
export function IngredientPickerModal({
  visible,
  ingredients,
  onSelect,
  onClose,
  onCreateNew,
}: {
  visible: boolean;
  ingredients: Ingredient[];
  onSelect: (ing: Ingredient) => void;
  onClose: () => void;
  onCreateNew?: (initialName: string) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return ingredients;
    const q = query.toLowerCase().trim();
    return ingredients.filter((i) => i.name.toLowerCase().includes(q));
  }, [ingredients, query]);

  const exactMatch = ingredients.some(
    (i) => i.name.toLowerCase().trim() === query.toLowerCase().trim(),
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.modalOverlay}>
        {/* Fondo táctil para cerrar */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.pickerSheetContainer}
        >
          <View style={s.pickerSheetContent}>
            <LinearGradient
              colors={['#FFFFFF', '#F8FAFF']}
              style={{ flex: 1 }}
            >
              {/* Barra superior / Tirador */}
              <View style={s.sheetHandleBar} />

              {/* Encabezado visible garantizado */}
              <View style={s.sheetHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={s.hudIconOrb}>
                    <Ionicons name="sparkles" size={16} color={C.pastelPurple} />
                  </View>
                  <View>
                    <Text style={s.sheetTitle}>BUSCAR INGREDIENTE</Text>
                    <Text style={s.sheetSubtitle}>Selecciona un alimento para tu comida</Text>
                  </View>
                </View>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [s.sheetCloseBtn, pressed && s.btnPressed]}
                >
                  <Ionicons name="close" size={20} color={C.sub} />
                </Pressable>
              </View>

              {/* Cuadro de texto interactivo SIEMPRE VISIBLE */}
              <View style={s.searchBarContainer}>
                <Ionicons name="search" size={18} color={C.pastelPurple} style={{ marginLeft: 12 }} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Escribe el nombre del alimento..."
                  placeholderTextColor={C.subMuted}
                  style={s.searchInput}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                {query.length > 0 && Platform.OS !== 'ios' && (
                  <Pressable onPress={() => setQuery('')} style={{ padding: 8 }}>
                    <Ionicons name="close-circle" size={18} color={C.sub} />
                  </Pressable>
                )}
              </View>

              {/* Botón rápido para crear si no existe */}
              {query.trim().length > 0 && !exactMatch && onCreateNew && (
                <Pressable
                  onPress={() => {
                    onCreateNew(query.trim());
                    onClose();
                  }}
                  style={({ pressed }) => [s.quickCreateCard, pressed && s.btnPressed]}
                >
                  <LinearGradient
                    colors={['rgba(167, 139, 250, 0.15)', 'rgba(244, 114, 182, 0.15)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.quickCreateGradient}
                  >
                    <Ionicons name="add-circle" size={20} color={C.pastelPurple} />
                    <Text style={s.quickCreateText}>
                      Crear nuevo ingrediente: <Text style={{ color: C.text, fontWeight: '800' }}>"{query.trim()}"</Text>
                    </Text>
                  </LinearGradient>
                </Pressable>
              )}

              {/* Lista con FlatList de resultados con scroll amplio */}
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="always"
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 36 }}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                ListEmptyComponent={
                  <View style={s.emptySearchContainer}>
                    <Ionicons name="nutrition-outline" size={44} color={C.subMuted} />
                    <Text style={s.emptySearchText}>No encontramos ingredientes con ese nombre</Text>
                    {onCreateNew && (
                      <Pressable
                        onPress={() => {
                          onCreateNew(query.trim());
                          onClose();
                        }}
                        style={s.emptyCreateBtn}
                      >
                        <Text style={s.emptyCreateBtnText}>+ Crear ingrediente nuevo</Text>
                      </Pressable>
                    )}
                  </View>
                }
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                    style={({ pressed }) => [s.ingredientItemCard, pressed && s.btnPressed]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={s.ingredientItemName}>{item.name}</Text>
                      <View style={s.servingPill}>
                        <Text style={s.servingPillText}>{item.servingGrams}{item.unit || 'g'} base</Text>
                      </View>
                    </View>
                    <View style={{ marginTop: 8 }}>
                      <MacroChips m={item} small />
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

const FOOD_UNITS: FoodUnit[] = ['g', 'ml', 'ud'];

/* ---------------- Fila de Ingrediente en la Comida ---------------- */
function ItemRow({
  item,
  ingredients,
  onChange,
  onDelete,
  onOpenPicker,
}: {
  item: MealItem;
  ingredients: Ingredient[];
  onChange: (i: MealItem) => void;
  onDelete: () => void;
  onOpenPicker: () => void;
}) {
  const activePaletteId = useStore((st) => st.activePaletteId);
  const customPalettes = useStore((st) => st.customPalettes);
  const deletedPaletteIds = useStore((st) => st.deletedPaletteIds);
  const palette = getActivePalette({ activePaletteId, customPalettes, deletedPaletteIds });

  const ing = ingredients.find((i) => i.id === item.ingredientId);
  const m = scaleMacros(ing, item.grams);
  const currentUnit: FoodUnit = item.unit || ing?.unit || 'g';

  const cycleUnit = () => {
    const nextIdx = (FOOD_UNITS.indexOf(currentUnit) + 1) % FOOD_UNITS.length;
    onChange({ ...item, unit: FOOD_UNITS[nextIdx] });
  };

  return (
    <View style={s.itemRowContainer}>
      <View style={s.itemRowTop}>
        {/* Botón selector de ingrediente que abre el modal seguro */}
        <Pressable
          onPress={onOpenPicker}
          style={({ pressed }) => [
            s.ingredientPickerButton,
            {
              borderColor: !ing
                ? getPaletteColorWithAlpha(palette.primary, 0.38)
                : getPaletteColorWithAlpha(palette.primary, 0.22),
            },
            palette.isDark && {
              backgroundColor: palette.primary,
              borderColor: palette.primary,
            },
            !ing && s.ingredientPickerButtonEmpty,
            pressed && s.btnPressed,
          ]}
        >
          <Ionicons
            name={ing ? 'sparkles' : 'search-outline'}
            size={16}
            color={palette.isDark ? '#FFFFFF' : ing ? palette.primary : C.sub}
          />
          <Text
            numberOfLines={1}
            style={[
              s.ingredientPickerButtonText,
              palette.isDark && { color: '#FFFFFF' },
              !ing && { color: palette.isDark ? 'rgba(255, 255, 255, 0.8)' : C.subMuted },
            ]}
          >
            {ing ? ing.name : '✦ Toca para buscar ingrediente...'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={palette.isDark ? '#FFFFFF' : C.sub}
            style={{ marginLeft: 'auto' }}
          />
        </Pressable>

        {/* Input de Cantidad con selector interactivo de unidad */}
        <View
          style={[
            s.gramsInputContainer,
            { borderColor: getPaletteColorWithAlpha(palette.primary, 0.22) },
            palette.isDark && {
              backgroundColor: palette.primary,
              borderColor: palette.primary,
            },
          ]}
        >
          <TextInput
            value={item.grams ? String(item.grams) : ''}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={palette.isDark ? 'rgba(255, 255, 255, 0.7)' : C.subMuted}
            style={[s.gramsTextInput, palette.isDark && { color: '#FFFFFF' }]}
            onChangeText={(t) =>
              onChange({ ...item, grams: parseFloat(t.replace(',', '.')) || 0 })
            }
          />
          <Pressable
            onPress={cycleUnit}
            hitSlop={8}
            style={({ pressed }) => [s.gramsUnitBadge, pressed && s.btnPressed]}
          >
            <Text style={[s.gramsUnitText, palette.isDark && { color: '#FFFFFF' }]}>{currentUnit}</Text>
            <Ionicons name="swap-vertical" size={10} color={palette.isDark ? '#FFFFFF' : '#94A3B8'} />
          </Pressable>
        </View>

        {/* Botón eliminar item */}
        <Pressable
          onPress={onDelete}
          hitSlop={10}
          style={({ pressed }) => [s.deleteItemBtn, pressed && s.btnPressed]}
        >
          <Ionicons name="close-circle-outline" size={20} color={C.danger} />
        </Pressable>
      </View>

      {/* Macros escalados en tiempo real */}
      {ing && (
        <View style={{ marginTop: 8 }}>
          <MacroChips m={m} small />
        </View>
      )}
    </View>
  );
}

/* ---------------- Tarjeta de Bloque de Comida ---------------- */
export function MealBlockCard({
  block,
  ingredients,
  onChange,
  onDelete,
  onSaveAsRecipe,
  extra,
  onOpenPickerForItem,
}: {
  block: MealBlock;
  ingredients: Ingredient[];
  onChange: (b: MealBlock) => void;
  onDelete?: () => void;
  onSaveAsRecipe?: () => void;
  extra?: React.ReactNode;
  onOpenPickerForItem: (itemId: string) => void;
}) {
  const activePaletteId = useStore((st) => st.activePaletteId);
  const customPalettes = useStore((st) => st.customPalettes);
  const deletedPaletteIds = useStore((st) => st.deletedPaletteIds);
  const palette = getActivePalette({ activePaletteId, customPalettes, deletedPaletteIds });

  const total = itemsTotal(block.items, ingredients);

  const setItem = (it: MealItem) =>
    onChange({ ...block, items: block.items.map((x) => (x.id === it.id ? it : x)) });

  const getMealIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('desayun')) return 'sunny-outline';
    if (n.includes('almuer') || n.includes('comida')) return 'restaurant-outline';
    if (n.includes('cena')) return 'moon-outline';
    if (n.includes('snack') || n.includes('merien')) return 'cafe-outline';
    return 'nutrition-outline';
  };

  return (
    <View style={[s.mealBlockWrapper, { borderColor: palette.border }]}>
      <LinearGradient
        colors={palette.isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFF']}
        style={s.mealBlockGradient}
      >
        {/* Barra decorativa lateral izquierda con color de paleta */}
        <View style={[s.mealBlockAccentBar, { backgroundColor: palette.primary }]} />

        {/* Header del bloque */}
        <View style={s.mealBlockHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
            <View
              style={[
                s.mealIconBadge,
                {
                  backgroundColor: `${palette.primary}18`,
                  borderColor: `${palette.primary}35`,
                },
              ]}
            >
              <Ionicons name={getMealIcon(block.name)} size={16} color={palette.primary} />
            </View>
            <TextInput
              value={block.name}
              onChangeText={(name) => onChange({ ...block, name })}
              style={[s.mealNameInput, { color: palette.text }]}
              placeholder="Nombre de la comida"
              placeholderTextColor={palette.textSub}
            />
          </View>

          {/* BOTÓN PARA GUARDAR DIRECTAMENTE COMO COMIDA GUARDADA / RECETA */}
          {onSaveAsRecipe && (
            <Pressable
              onPress={onSaveAsRecipe}
              hitSlop={8}
              style={({ pressed }) => [
                s.saveRecipeBtn,
                {
                  backgroundColor: `${palette.primary}18`,
                  borderColor: `${palette.primary}35`,
                },
                pressed && s.btnPressed,
              ]}
            >
              <Ionicons name="bookmark-outline" size={15} color={palette.primary} />
              <Text style={[s.saveRecipeBtnText, { color: palette.primary }]}>Guardar</Text>
            </Pressable>
          )}

          {extra}

          {onDelete && (
            <Pressable
              onPress={onDelete}
              hitSlop={8}
              style={({ pressed }) => [s.deleteBlockBtn, pressed && s.btnPressed]}
            >
              <Ionicons name="trash-outline" size={18} color={C.danger} />
            </Pressable>
          )}
        </View>

        {/* Subtotales del bloque */}
        <View style={{ marginVertical: 8 }}>
          <MacroChips m={total} />
        </View>

        {/* Filas de Ingredientes */}
        <View style={{ marginTop: 6 }}>
          {block.items.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              ingredients={ingredients}
              onChange={setItem}
              onDelete={() =>
                onChange({ ...block, items: block.items.filter((x) => x.id !== it.id) })
              }
              onOpenPicker={() => onOpenPickerForItem(it.id)}
            />
          ))}
        </View>

        {/* Botón Agregar Ingrediente */}
        <Pressable
          style={({ pressed }) => [
            s.addIngredientDashedBtn,
            {
              backgroundColor: `${palette.primary}10`,
              borderColor: `${palette.primary}50`,
            },
            pressed && s.btnPressed,
          ]}
          onPress={() => {
            const newItemId = uid();
            onChange({
              ...block,
              items: [...block.items, { id: newItemId, ingredientId: null, grams: 0 }],
            });
            onOpenPickerForItem(newItemId);
          }}
        >
          <Ionicons name="add" size={17} color={palette.primary} />
          <Text style={[s.addIngredientDashedText, { color: palette.primary }]}>Agregar ingrediente</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

/* ---------------- Botón de Acción Anime Pastel ---------------- */
export function PrimaryButton({
  icon,
  label,
  onPress,
  ghost,
  danger,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  ghost?: boolean;
  danger?: boolean;
}) {
  const activePaletteId = useStore((st) => st.activePaletteId);
  const customPalettes = useStore((st) => st.customPalettes);
  const palette = getActivePalette({ activePaletteId, customPalettes });

  if (ghost) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.ghostButton,
          {
            borderColor: danger ? C.danger : getPaletteColorWithAlpha(palette.primary, 0.35),
            shadowColor: danger ? C.danger : palette.primary,
            backgroundColor: danger ? C.dangerBg : (palette.isDark ? '#1E293B' : '#FFFFFF'),
          },
          pressed && s.btnPressed,
        ]}
      >
        <Ionicons name={icon} size={18} color={danger ? C.danger : palette.primary} />
        <Text style={[s.ghostButtonText, { color: danger ? C.danger : palette.primary }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.primaryButtonContainer,
        { shadowColor: danger ? C.danger : palette.primary },
        pressed && s.btnPressed,
      ]}
    >
      <LinearGradient
        colors={danger ? [C.danger, '#FF758F'] : [palette.primary, palette.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.primaryButtonGradient}
      >
        <Ionicons name={icon} size={18} color="#FFFFFF" />
        <Text style={s.primaryButtonText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/* ---------------- Estilos Anime Pastel Claro Glassmorphism ---------------- */
export const s = StyleSheet.create({
  // Tarjetas Glass Pastel
  glassCard: {
    borderRadius: 22,
    marginBottom: 8, // <--- Gap disminuido para acercarlo al selector
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
  cardGradient: {
    padding: 16,
  },

  // ORBES DE FONDO ANIMADO ANIME
  floatingOrb1: {
    position: 'absolute',
    top: -30,
    left: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(167, 139, 250, 0.22)',
  },
  floatingOrb2: {
    position: 'absolute',
    bottom: -40,
    right: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(244, 114, 182, 0.18)',
  },
  floatingOrb3: {
    position: 'absolute',
    top: 30,
    right: 40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(20, 184, 166, 0.12)',
  },

  hudHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  hudBadgeText: {
    color: C.pastelPurple,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kanjiDecor: {
    color: C.subMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Anillo de Kcal y Llama
  ringCenterGlow: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
    shadowColor: C.kcal,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  flameHaloGlowGreen: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  flameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
    shadowColor: C.kcal,
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  kcalBigNumber: {
    color: C.text,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  kcalUnit: {
    color: C.kcal,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Stats
  statRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statLabel: {
    color: C.textSub,
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  statPct: {
    color: C.subMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  statTrack: {
    height: 6,
    backgroundColor: 'rgba(203, 213, 225, 0.4)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statFill: {
    height: 6,
    borderRadius: 3,
  },

  // Selector Maestro Principal (Nivel 1 con Píldora Deslizante)
  mainSegmentedContainer: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 13, // <--- Border radius más pequeño pedido por el usuario
    padding: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.22)',
    marginTop: 0, // <--- Gap pegado a la gráfica
    marginBottom: 10,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    position: 'relative',
    height: 48,
    alignItems: 'center',
  },
  slidingPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 9.5, // <--- Radio interior proporcional
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  slidingPillGradient: {
    flex: 1,
    borderRadius: 9.5,
  },
  mainSegmentedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    zIndex: 2,
  },
  mainSegmentedText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  mainSegmentedTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  mainSegmentedTextInactive: {
    color: '#475569',
    fontWeight: '700',
  },

  // Segmented Tradicional con Píldora Deslizante Pastel
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: C.borderLight,
    marginVertical: 12,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    position: 'relative',
    height: 44,
    alignItems: 'center',
  },
  segmentedSlidingPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  segmentedSlidingPillGradient: {
    flex: 1,
    borderRadius: 12,
  },
  segmentedBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    zIndex: 2,
  },
  segmentedText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  segmentedTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  segmentedTextInactive: {
    color: C.sub,
    fontWeight: '600',
  },

  // Date Selector
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  dateNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  dateCenterBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  dateCenterGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  dateAnimatedContentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dateLabelText: {
    color: C.text,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  todayTag: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  todayTagText: {
    color: C.pastelPurple,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  datePickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: C.borderPastelPurple,
  },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  macroBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  macroBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },

  // Bloques de Comida
  mealBlockWrapper: {
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.borderLight,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  mealBlockGradient: {
    padding: 16,
  },
  mealBlockAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: C.pastelPurple,
  },
  mealBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 4,
    gap: 8,
  },
  mealIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  mealNameInput: {
    color: C.text,
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
    paddingVertical: 4,
  },
  saveRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  saveRecipeBtnText: {
    color: C.pastelPurple,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBlockBtn: {
    padding: 6,
  },
  addIngredientDashedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
    gap: 6,
  },
  addIngredientDashedText: {
    color: C.pastelPurple,
    fontWeight: '700',
    fontSize: 13,
  },

  // Filas de Items
  itemRowContainer: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.8)',
  },
  itemRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ingredientPickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
    gap: 8,
  },
  ingredientPickerButtonEmpty: {
    borderStyle: 'dashed',
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  ingredientPickerButtonText: {
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  gramsInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  gramsTextInput: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    width: 48,
    textAlign: 'right',
    paddingVertical: 9,
  },
  gramsUnitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  gramsUnitText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteItemBtn: {
    padding: 6,
  },

  // MODAL DE BÚSQUEDA ROBUSTO
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheetContainer: {
    width: '100%',
    height: '80%',
    maxHeight: 650,
  },
  pickerSheetContent: {
    flex: 1,
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
    width: 42,
    height: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  hudIconOrb: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  sheetTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sheetSubtitle: {
    color: C.sub,
    fontSize: 11,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderPastelPurple,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  quickCreateCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.5)',
  },
  quickCreateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  quickCreateText: {
    color: C.pastelPurple,
    fontSize: 13,
    fontWeight: '600',
  },
  ingredientItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ingredientItemName: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  servingPill: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  servingPillText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '600',
  },
  emptySearchContainer: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptySearchText: {
    color: C.subMuted,
    fontSize: 13,
    marginTop: 8,
  },
  emptyCreateBtn: {
    marginTop: 12,
    backgroundColor: C.pastelPurple,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  emptyCreateBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },

  // Botones
  primaryButtonContainer: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  ghostButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: C.borderPastelPurple,
    gap: 6,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  ghostButtonText: {
    color: C.pastelPurple,
    fontWeight: '800',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});

registerThemeSheet(s);
