import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Animated,
  Easing,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useStore, getActivePalette, GenderOption, calculateAgeFromBirthDate } from './store';
import {
  apiLogin,
  apiRegister,
  apiCheckNickname,
  apiForgotPassword,
  apiResetPassword,
  getServerUrl,
  setServerUrl,
  checkServerHealth,
} from './api';
import EvolveLogo from './EvolveLogo';
import { pullUserDataFromDatabase } from './syncService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AuthScreen() {
  const { activePaletteId, customPalettes, deletedPaletteIds, setAuth, setUserProfile } = useStore();
  const palette = getActivePalette({ activePaletteId, customPalettes, deletedPaletteIds });

  // ==========================================================
  // ESTADO Y ANIMACIÓN DEL INTRO SPLASH INICIAL SUAVE Y ELEGANTE
  // ==========================================================
  const [showIntroSplash, setShowIntroSplash] = useState(true);
  const splashOpacityAnim = useRef(new Animated.Value(1)).current;
  const splashScaleAnim = useRef(new Animated.Value(1)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.82)).current;
  const logoOpacityAnim = useRef(new Animated.Value(0)).current;
  const logoAuraAnim = useRef(new Animated.Value(0)).current;
  const sloganFadeAnim = useRef(new Animated.Value(0)).current;
  const sloganTranslateAnim = useRef(new Animated.Value(12)).current;

  // Animación del formulario principal
  const formEntryOpacity = useRef(new Animated.Value(0)).current;
  const formEntryTranslateY = useRef(new Animated.Value(24)).current;

  const finishSplash = () => {
    Animated.parallel([
      Animated.timing(splashOpacityAnim, {
        toValue: 0,
        duration: 380,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(splashScaleAnim, {
        toValue: 1.05,
        duration: 380,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(formEntryOpacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(formEntryTranslateY, {
        toValue: 0,
        duration: 420,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowIntroSplash(false);
    });
  };

  useEffect(() => {
    // 1. Entrada fluida del Logo con aura y escala elástica
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacityAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.spring(logoScaleAnim, {
          toValue: 1,
          friction: 6.5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoAuraAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ]),
      // 2. Aparición del Slogan
      Animated.parallel([
        Animated.timing(sloganFadeAnim, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(sloganTranslateAnim, {
          toValue: 0,
          duration: 380,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]),
      // 3. Pausa breve y suave (~450ms) antes de la transición
      Animated.delay(450),
    ]).start(() => {
      finishSplash();
    });
  }, []);

  // ==========================================================
  // ESTADOS DEL FORMULARIO DE AUTENTICACIÓN
  // ==========================================================
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Verificación en tiempo real de Nickname como ID único en Registro
  const [nickStatus, setNickStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  // Campos obligatorios de perfil atlético para registro
  const [gender, setGender] = useState<GenderOption>('Masculino');
  const [height, setHeight] = useState('175');
  const [birthDate, setBirthDate] = useState('2000-05-14');
  const calculatedAge = useMemo(() => calculateAgeFromBirthDate(birthDate), [birthDate]);

  // Estados para Recuperación de Contraseña Funcional
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [receivedCodeHint, setReceivedCodeHint] = useState<string | null>(null);

  // Modal para configurar URL del servidor
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [inputServerUrl, setInputServerUrl] = useState(getServerUrl());
  const [testingServer, setTestingServer] = useState(false);

  // Animación para el cambio fluido entre Login y Registro
  const modeFadeAnim = useRef(new Animated.Value(1)).current;
  const modeTranslateAnim = useRef(new Animated.Value(0)).current;

  // Verificación reactiva con debounce de Nickname en formulario de registro
  useEffect(() => {
    if (mode !== 'register') return;
    const clean = nickname.trim().replace('@', '');
    if (!clean) {
      setNickStatus({ checking: false, available: null, message: '' });
      return;
    }
    if (clean.length < 3) {
      setNickStatus({ checking: false, available: false, message: 'El apodo debe tener al menos 3 caracteres.' });
      return;
    }

    setNickStatus((prev) => ({ ...prev, checking: true }));
    const timer = setTimeout(async () => {
      const res = await apiCheckNickname(clean);
      setNickStatus({
        checking: false,
        available: res.available,
        message: res.available ? `✓ @${clean} está disponible` : (res.message || `✕ @${clean} ya está en uso`),
      });
    }, 380);

    return () => clearTimeout(timer);
  }, [nickname, mode]);

  const handleSwitchMode = (nextMode: 'login' | 'register') => {
    if (nextMode === mode) return;
    Animated.parallel([
      Animated.timing(modeFadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(modeTranslateAnim, {
        toValue: nextMode === 'register' ? -8 : 8,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMode(nextMode);
      modeTranslateAnim.setValue(nextMode === 'register' ? 8 : -8);
      Animated.parallel([
        Animated.timing(modeFadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(modeTranslateAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleSubmit = async () => {
    const cleanIdentifier = email.trim();
    if (!cleanIdentifier || !password) {
      Alert.alert(
        'Campos requeridos',
        mode === 'login'
          ? 'Por favor ingresa tu correo o nickname y contraseña.'
          : 'Por favor ingresa tu correo y contraseña.'
      );
      return;
    }

    const cleanEmail = cleanIdentifier.toLowerCase();

    if (mode === 'register') {
      if (!name.trim()) {
        Alert.alert('Nombre requerido', 'Por favor ingresa tu nombre completo.');
        return;
      }
      const cleanNick = nickname.trim().replace('@', '');
      if (!cleanNick || cleanNick.length < 3) {
        Alert.alert('Apodo requerido', 'Por favor define un apodo o nickname de al menos 3 caracteres.');
        return;
      }
      if (nickStatus.available === false) {
        Alert.alert('Apodo no disponible', 'El apodo ingresado ya está en uso. Por favor elige uno diferente.');
        return;
      }
      if (!height.trim() || isNaN(parseFloat(height)) || parseFloat(height) < 80 || parseFloat(height) > 260) {
        Alert.alert('Altura inválida', 'Por favor ingresa tu altura en centímetros (ej. 175).');
        return;
      }
      if (!birthDate.trim() || birthDate.split('-').length !== 3) {
        Alert.alert('Fecha de nacimiento requerida', 'Por favor ingresa tu fecha de nacimiento en formato AAAA-MM-DD.');
        return;
      }
      if (calculatedAge < 10 || calculatedAge > 115) {
        Alert.alert('Fecha inválida', 'Por favor ingresa una fecha de nacimiento válida.');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Contraseñas no coinciden', 'La confirmación de la contraseña no coincide.');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Contraseña corta', 'La contraseña debe tener al menos 6 caracteres.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await apiLogin({ email: cleanEmail, password });
        setAuth(res.token, res.user);
        pullUserDataFromDatabase().catch(() => {});
      } else {
        const heightNum = parseFloat(height) || 175;
        const cleanNick = nickname.trim().replace('@', '');
        const res = await apiRegister({
          email: cleanEmail,
          password,
          name: name.trim(),
          nickname: cleanNick,
          gender,
          height: heightNum,
          birthDate: birthDate.trim(),
          age: calculatedAge,
        });
        setAuth(res.token, res.user);
        setUserProfile({
          name: name.trim(),
          nickname: res.user.nickname || cleanNick,
          gender,
          height: heightNum,
          birthDate: birthDate.trim(),
          age: calculatedAge,
        });
        pullUserDataFromDatabase().catch(() => {});
      }
    } catch (err: any) {
      Alert.alert(
        'Error de Autenticación',
        err.message || 'No fue posible conectar con el servidor. Verifica que esté activo.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRecoveryCode = async () => {
    const clean = recoveryEmail.trim().toLowerCase();
    if (!clean) {
      Alert.alert('Correo requerido', 'Por favor ingresa el correo electrónico de tu cuenta.');
      return;
    }
    setRecoveryLoading(true);
    try {
      const res = await apiForgotPassword(clean);
      setReceivedCodeHint(res.resetCode || null);
      if (res.resetCode) {
        setRecoveryCode(res.resetCode);
      }
      setRecoveryStep(2);
      Alert.alert(
        'Código de Seguridad Generado',
        `Tu código de recuperación es:\n\n🔑 ${res.resetCode || '123456'}\n\nIngrésalo junto a tu nueva contraseña para continuar.`,
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo generar el código.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const clean = recoveryEmail.trim().toLowerCase();
    if (!recoveryCode.trim()) {
      Alert.alert('Código requerido', 'Por favor ingresa el código de 6 dígitos.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Contraseña corta', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('No coinciden', 'La confirmación de la contraseña no coincide.');
      return;
    }

    setRecoveryLoading(true);
    try {
      const res = await apiResetPassword({
        email: clean,
        code: recoveryCode.trim(),
        newPassword,
      });

      Alert.alert('¡Contraseña Restablecida!', res.message);
      setForgotModalOpen(false);
      setEmail(clean);
      setPassword(newPassword);
      setMode('login');
    } catch (err: any) {
      Alert.alert('Error al restablecer', err.message || 'No fue posible restablecer la contraseña.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleTestServer = async () => {
    setTestingServer(true);
    const res = await checkServerHealth(inputServerUrl);
    setTestingServer(false);
    if (res.ok) {
      Alert.alert('Servidor Conectado', '¡Conexión exitosa con el backend de Evolve!');
    } else {
      Alert.alert('Error de Conexión', res.message);
    }
  };

  const handleSaveServerUrl = async () => {
    await setServerUrl(inputServerUrl);
    setServerModalOpen(false);
    Alert.alert('Servidor Actualizado', `Conectando ahora a: ${inputServerUrl}`);
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      {/* ==========================================================
          VISTA DEL FORMULARIO DE LOGIN / REGISTRO
      ========================================================== */}
      <Animated.View
        style={{
          flex: 1,
          opacity: formEntryOpacity,
          transform: [{ translateY: formEntryTranslateY }],
        }}
      >
        {/* Botón flotante superior para ajustar IP/servidor */}
        <Pressable
          style={[
            styles.serverSettingsBtn,
            {
              backgroundColor: palette.cardBg,
              borderColor: palette.border,
            },
          ]}
          onPress={() => {
            setInputServerUrl(getServerUrl());
            setServerModalOpen(true);
          }}
        >
          <Ionicons name="hardware-chip-outline" size={14} color={palette.primary} />
          <Text style={[styles.serverSettingsBtnText, { color: palette.textSub }]}>Servidor</Text>
        </Pressable>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Cabecera / Identidad de Marca */}
            <View style={styles.heroSection}>
              <EvolveLogo width={260} height={80} style={{ alignSelf: 'center' }} />
              <Text style={[styles.brandSubtitle, { color: palette.textSub }]}>
                {mode === 'login'
                  ? 'Eleva tu entrenamiento, supera tus límites y compite con tu comunidad'
                  : 'Únete a la nueva era del fitness: retos, nutrición y comunidad'}
              </Text>
            </View>

            {/* Selector de Pestaña: Login / Registro */}
            <View
              style={[
                styles.segmentedContainer,
                {
                  backgroundColor: palette.cardBg,
                  borderColor: palette.border,
                },
              ]}
            >
              <Pressable
                style={[
                  styles.segmentedBtn,
                  mode === 'login' && { backgroundColor: palette.primary },
                ]}
                onPress={() => handleSwitchMode('login')}
              >
                <Text
                  style={[
                    styles.segmentedBtnText,
                    { color: mode === 'login' ? '#FFFFFF' : palette.textSub },
                    mode === 'login' && { fontWeight: '800' },
                  ]}
                >
                  Iniciar Sesión
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.segmentedBtn,
                  mode === 'register' && { backgroundColor: palette.primary },
                ]}
                onPress={() => handleSwitchMode('register')}
              >
                <Text
                  style={[
                    styles.segmentedBtnText,
                    { color: mode === 'register' ? '#FFFFFF' : palette.textSub },
                    mode === 'register' && { fontWeight: '800' },
                  ]}
                >
                  Registrarse
                </Text>
              </Pressable>
            </View>

            {/* Formulario con animación de transición fluida */}
            <Animated.View
              style={[
                styles.formCard,
                {
                  backgroundColor: palette.cardBg,
                  borderColor: palette.border,
                  opacity: modeFadeAnim,
                  transform: [{ translateY: modeTranslateAnim }],
                },
              ]}
            >
              {mode === 'register' && (
                <>
                  <Text style={[styles.inputLabel, { color: palette.textSub }]}>NOMBRE COMPLETO</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                    <Ionicons name="person-outline" size={17} color={palette.primary} />
                    <TextInput
                      style={[styles.textInput, { color: palette.text }]}
                      placeholder="Ej. Sergio Tamayo"
                      placeholderTextColor={palette.textSub}
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                    />
                  </View>

                  {/* Nickname como ID único con comprobación de disponibilidad */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 6 }}>
                    <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 0, marginBottom: 0 }]}>
                      APODO / NICKNAME (ID ÚNICO)
                    </Text>
                    {nickStatus.checking && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <ActivityIndicator size="small" color={palette.primary} />
                        <Text style={{ fontSize: 11, color: palette.textSub, fontWeight: '600' }}>Verificando...</Text>
                      </View>
                    )}
                    {!nickStatus.checking && nickStatus.available !== null && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons
                          name={nickStatus.available ? 'checkmark-circle' : 'close-circle'}
                          size={14}
                          color={nickStatus.available ? '#10B981' : '#EF4444'}
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '800',
                            color: nickStatus.available ? '#10B981' : '#EF4444',
                          }}
                        >
                          {nickStatus.available ? 'Disponible' : 'No disponible'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: palette.bg,
                        borderColor:
                          nickStatus.available === false
                            ? '#EF4444'
                            : nickStatus.available === true
                            ? '#10B981'
                            : palette.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="at-outline"
                      size={17}
                      color={
                        nickStatus.available === false
                          ? '#EF4444'
                          : nickStatus.available === true
                          ? '#10B981'
                          : palette.primary
                      }
                    />
                    <TextInput
                      style={[styles.textInput, { color: palette.text }]}
                      placeholder="Ej. Sertic78"
                      placeholderTextColor={palette.textSub}
                      value={nickname}
                      onChangeText={(val) => setNickname(val.replace(/\s+/g, ''))}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  {nickStatus.message ? (
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: nickStatus.available ? '#10B981' : '#EF4444',
                        marginTop: 3,
                        marginBottom: 4,
                        marginLeft: 2,
                      }}
                    >
                      {nickStatus.message}
                    </Text>
                  ) : null}

                  {/* Datos Biométricos Requeridos: Género, Altura y Fecha de Nacimiento */}
                  <Text style={[styles.inputLabel, { color: palette.textSub }]}>GÉNERO BIOLÓGICO</Text>
                  <View style={styles.genderRow}>
                    {(['Masculino', 'Femenino'] as GenderOption[]).map((g) => {
                      const isSel = gender === g;
                      return (
                        <Pressable
                          key={g}
                          style={[
                            styles.genderBtn,
                            {
                              backgroundColor: isSel ? palette.primary : palette.bg,
                              borderColor: isSel ? palette.primary : palette.border,
                            },
                          ]}
                          onPress={() => setGender(g)}
                        >
                          <Ionicons
                            name={g === 'Masculino' ? 'male' : 'female'}
                            size={15}
                            color={isSel ? '#FFFFFF' : palette.textSub}
                          />
                          <Text
                            style={[
                              styles.genderBtnText,
                              { color: isSel ? '#FFFFFF' : palette.text },
                            ]}
                          >
                            {g}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { color: palette.textSub }]}>ALTURA (CM)</Text>
                      <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                        <Ionicons name="resize-outline" size={16} color={palette.primary} />
                        <TextInput
                          style={[styles.textInput, { color: palette.text }]}
                          placeholder="Ej. 178"
                          placeholderTextColor={palette.textSub}
                          value={height}
                          onChangeText={setHeight}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <View style={{ flex: 1.35 }}>
                      <Text style={[styles.inputLabel, { color: palette.textSub }]}>
                        FECHA DE NACIMIENTO
                      </Text>
                      <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                        <Ionicons name="calendar-outline" size={16} color={palette.primary} />
                        <TextInput
                          style={[styles.textInput, { color: palette.text }]}
                          placeholder="2000-05-14"
                          placeholderTextColor={palette.textSub}
                          value={birthDate}
                          onChangeText={setBirthDate}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Badge informativo de edad calculada */}
                  <View style={[styles.ageBadgeRow, { backgroundColor: `${palette.primary}15`, borderColor: `${palette.primary}35` }]}>
                    <Ionicons name="sparkles" size={14} color={palette.primary} />
                    <Text style={[styles.ageBadgeText, { color: palette.text }]}>
                      Edad calculada: <Text style={{ fontWeight: '900', color: palette.primary }}>{calculatedAge} años</Text> (se usará en el cálculo calórico de Metas)
                    </Text>
                  </View>
                </>
              )}

              <Text style={[styles.inputLabel, { color: palette.textSub }]}>
                {mode === 'login' ? 'CORREO ELECTRÓNICO O NICKNAME' : 'CORREO ELECTRÓNICO'}
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                <Ionicons
                  name={mode === 'login' ? 'person-circle-outline' : 'mail-outline'}
                  size={17}
                  color={palette.primary}
                />
                <TextInput
                  style={[styles.textInput, { color: palette.text }]}
                  placeholder={mode === 'login' ? 'tu@correo.com o @apodo' : 'tu@correo.com'}
                  placeholderTextColor={palette.textSub}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType={mode === 'login' ? 'default' : 'email-address'}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Fila de Contraseña con enlace '¿Olvidaste tu contraseña?' al lado izquierdo, arriba del input */}
              <View style={styles.passwordHeaderRow}>
                <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 0, marginBottom: 0 }]}>
                  CONTRASEÑA
                </Text>
                {mode === 'login' && (
                  <Pressable
                    style={styles.forgotInlineBtn}
                    onPress={() => {
                      setRecoveryEmail(email.trim());
                      setRecoveryStep(1);
                      setRecoveryCode('');
                      setNewPassword('');
                      setConfirmNewPassword('');
                      setReceivedCodeHint(null);
                      setForgotModalOpen(true);
                    }}
                    hitSlop={8}
                  >
                    <Text style={[styles.forgotInlineDot, { color: palette.textSub }]}>·</Text>
                    <Ionicons name="key-outline" size={12} color={palette.primary} />
                    <Text style={[styles.forgotInlineText, { color: palette.primary }]}>
                      ¿Olvidaste tu contraseña?
                    </Text>
                  </Pressable>
                )}
              </View>

              <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                <Ionicons name="lock-closed-outline" size={17} color={palette.primary} />
                <TextInput
                  style={[styles.textInput, { color: palette.text }]}
                  placeholder="Al menos 6 caracteres"
                  placeholderTextColor={palette.textSub}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowPassword((p) => !p)} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={palette.textSub}
                  />
                </Pressable>
              </View>

              {mode === 'register' && (
                <>
                  <Text style={[styles.inputLabel, { color: palette.textSub }]}>CONFIRMAR CONTRASEÑA</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                    <Ionicons name="shield-checkmark-outline" size={17} color={palette.primary} />
                    <TextInput
                      style={[styles.textInput, { color: palette.text }]}
                      placeholder="Repite tu contraseña"
                      placeholderTextColor={palette.textSub}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                  </View>
                </>
              )}

              {/* Botón de Envío Principal */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && { transform: [{ scale: 0.98 }] },
                  loading && { opacity: 0.7 },
                ]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <LinearGradient
                  colors={[palette.primary, palette.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitBtnGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons
                        name={mode === 'login' ? 'log-in-outline' : 'person-add-outline'}
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.submitBtnText}>
                        {mode === 'login' ? 'Entrar a Evolve' : 'Crear Mi Cuenta'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* ==========================================================
          OVERLAY INTRO SPLASH ANIMADO (SUAVE, PROFESIONAL, CORTO)
      ========================================================== */}
      {showIntroSplash && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.splashOverlay,
            {
              backgroundColor: palette.bg,
              opacity: splashOpacityAnim,
              transform: [{ scale: splashScaleAnim }],
            },
          ]}
          pointerEvents="box-none"
        >
          {/* Fondo con aura y gradiente ambiental */}
          <LinearGradient
            colors={[
              `${palette.primary}25`,
              'transparent',
              `${palette.secondary}15`,
            ]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
          />

          <Pressable style={styles.splashContentCenter} onPress={finishSplash}>
            {/* Halo de luz / aura detrás del logo */}
            <Animated.View
              style={[
                styles.splashLogoAura,
                {
                  backgroundColor: palette.primary,
                  opacity: logoAuraAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.22],
                  }),
                  transform: [
                    {
                      scale: logoAuraAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1.4],
                      }),
                    },
                  ],
                },
              ]}
            />

            {/* Logo de Evolve con animación elástica suave */}
            <Animated.View
              style={{
                opacity: logoOpacityAnim,
                transform: [{ scale: logoScaleAnim }],
              }}
            >
              <EvolveLogo width={280} height={90} />
            </Animated.View>

            {/* Slogan de bienvenida */}
            <Animated.View
              style={{
                alignItems: 'center',
                marginTop: 14,
                opacity: sloganFadeAnim,
                transform: [{ translateY: sloganTranslateAnim }],
              }}
            >
              <View style={[styles.splashBadge, { backgroundColor: `${palette.primary}18`, borderColor: `${palette.primary}35` }]}>
                <Ionicons name="flash" size={13} color={palette.primary} />
                <Text style={[styles.splashBadgeText, { color: palette.primary }]}>
                  ELEVA TU POTENCIAL · SUPERA TUS LÍMITES
                </Text>
              </View>
            </Animated.View>
          </Pressable>
        </Animated.View>
      )}

      {/* MODAL PARA CONFIGURAR URL DEL SERVIDOR BACKEND */}
      {serverModalOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setServerModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
              <View style={styles.modalHeader}>
                <Ionicons name="server-outline" size={20} color={palette.primary} />
                <Text style={[styles.modalTitle, { color: palette.text }]}>SERVIDOR BACKEND</Text>
              </View>

              <Text style={[styles.modalSubtitle, { color: palette.textSub }]}>
                Ajusta la dirección IP de tu servidor si estás probando la app en un dispositivo físico.
              </Text>

              <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 14 }]}>URL DEL SERVIDOR</Text>
              <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                <Ionicons name="link-outline" size={17} color={palette.primary} />
                <TextInput
                  style={[styles.textInput, { color: palette.text }]}
                  placeholder="http://192.168.x.x:3001"
                  placeholderTextColor={palette.textSub}
                  value={inputServerUrl}
                  onChangeText={setInputServerUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Pressable
                  style={[styles.testBtn, { borderColor: palette.primary }]}
                  onPress={handleTestServer}
                  disabled={testingServer}
                >
                  {testingServer ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <>
                      <Ionicons name="pulse-outline" size={15} color={palette.primary} />
                      <Text style={[styles.testBtnText, { color: palette.primary }]}>Probar Conexión</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <View style={styles.modalActionRow}>
                <Pressable
                  style={[styles.modalCancelBtn, { borderColor: palette.border }]}
                  onPress={() => setServerModalOpen(false)}
                >
                  <Text style={[styles.modalCancelText, { color: palette.textSub }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSaveBtn, { backgroundColor: palette.primary }]}
                  onPress={handleSaveServerUrl}
                >
                  <Text style={styles.modalSaveText}>Guardar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* MODAL DE RECUPERACIÓN DE CONTRASEÑA FUNCIONAL */}
      {forgotModalOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setForgotModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
              <View style={styles.modalHeader}>
                <Ionicons name="key" size={20} color={palette.primary} />
                <Text style={[styles.modalTitle, { color: palette.text }]}>RECUPERAR CONTRASEÑA</Text>
              </View>

              <Text style={[styles.modalSubtitle, { color: palette.textSub }]}>
                {recoveryStep === 1
                  ? 'Ingresa tu correo registrado para generar un código seguro de verificación.'
                  : `Ingresa el código de 6 dígitos generado para ${recoveryEmail} y define tu nueva contraseña.`}
              </Text>

              {recoveryStep === 1 ? (
                <>
                  <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 14 }]}>
                    CORREO ELECTRÓNICO REGISTRADO
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                    <Ionicons name="mail-outline" size={17} color={palette.primary} />
                    <TextInput
                      style={[styles.textInput, { color: palette.text }]}
                      placeholder="tu@correo.com"
                      placeholderTextColor={palette.textSub}
                      value={recoveryEmail}
                      onChangeText={setRecoveryEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.modalActionRow}>
                    <Pressable
                      style={[styles.modalCancelBtn, { borderColor: palette.border }]}
                      onPress={() => setForgotModalOpen(false)}
                      disabled={recoveryLoading}
                    >
                      <Text style={[styles.modalCancelText, { color: palette.textSub }]}>Cancelar</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.modalSaveBtn, { backgroundColor: palette.primary }]}
                      onPress={handleRequestRecoveryCode}
                      disabled={recoveryLoading}
                    >
                      {recoveryLoading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.modalSaveText}>Solicitar Código</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  {receivedCodeHint && (
                    <View style={[styles.recoveryCodeCard, { backgroundColor: `${palette.primary}15`, borderColor: `${palette.primary}40` }]}>
                      <Ionicons name="shield-checkmark" size={16} color={palette.primary} />
                      <Text style={[styles.recoveryCodeHint, { color: palette.text }]}>
                        Código de seguridad: <Text style={{ fontWeight: '900', color: palette.primary }}>{receivedCodeHint}</Text>
                      </Text>
                    </View>
                  )}

                  <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 10 }]}>
                    CÓDIGO DE VERIFICACIÓN (6 DÍGITOS)
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                    <Ionicons name="barcode-outline" size={17} color={palette.primary} />
                    <TextInput
                      style={[styles.textInput, { color: palette.text, letterSpacing: 2, fontWeight: '800' }]}
                      placeholder="123456"
                      placeholderTextColor={palette.textSub}
                      value={recoveryCode}
                      onChangeText={setRecoveryCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>

                  <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 10 }]}>
                    NUEVA CONTRASEÑA
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                    <Ionicons name="lock-closed-outline" size={17} color={palette.primary} />
                    <TextInput
                      style={[styles.textInput, { color: palette.text }]}
                      placeholder="Mínimo 6 caracteres"
                      placeholderTextColor={palette.textSub}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showRecoveryPassword}
                      autoCapitalize="none"
                    />
                    <Pressable onPress={() => setShowRecoveryPassword((p) => !p)} hitSlop={8}>
                      <Ionicons
                        name={showRecoveryPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={17}
                        color={palette.textSub}
                      />
                    </Pressable>
                  </View>

                  <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 10 }]}>
                    CONFIRMAR NUEVA CONTRASEÑA
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                    <Ionicons name="shield-checkmark-outline" size={17} color={palette.primary} />
                    <TextInput
                      style={[styles.textInput, { color: palette.text }]}
                      placeholder="Repite la contraseña"
                      placeholderTextColor={palette.textSub}
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      secureTextEntry={!showRecoveryPassword}
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.modalActionRow}>
                    <Pressable
                      style={[styles.modalCancelBtn, { borderColor: palette.border }]}
                      onPress={() => setRecoveryStep(1)}
                      disabled={recoveryLoading}
                    >
                      <Text style={[styles.modalCancelText, { color: palette.textSub }]}>Atrás</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.modalSaveBtn, { backgroundColor: palette.primary }]}
                      onPress={handleResetPassword}
                      disabled={recoveryLoading}
                    >
                      {recoveryLoading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.modalSaveText}>Restablecer</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Splash Overlay
  splashOverlay: {
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContentCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  splashLogoAura: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  splashBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  splashBadgeText: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  passwordHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  forgotInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  forgotInlineDot: {
    fontSize: 12,
    fontWeight: '700',
  },
  forgotInlineText: {
    fontSize: 11,
    fontWeight: '700',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
  },
  genderBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  ageBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 4,
  },
  ageBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  recoveryCodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 4,
  },
  recoveryCodeHint: {
    fontSize: 12,
    fontWeight: '700',
  },
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 48 : 36,
    paddingBottom: 40,
  },
  serverSettingsBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 14 : 10,
    right: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  serverSettingsBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  brandSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    marginBottom: 18,
  },
  segmentedBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  segmentedBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: 20,
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
