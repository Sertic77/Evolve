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
  Image,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useStore, getActivePalette, GenderOption, calculateAgeFromBirthDate } from './store';
import {
  apiLogin,
  apiRegister,
  apiSocialLogin,
  apiSocialRegister,
  apiCheckNickname,
  apiForgotPassword,
  apiResetPassword,
  getServerUrl,
  setServerUrl,
  checkServerHealth,
} from './api';
import EvolveLogo from './EvolveLogo';
import { pullUserDataFromDatabase } from './syncService';

const STORAGE_SAVED_GOOGLE_ACCOUNTS = '@evolve_saved_google_accs';
const STORAGE_SAVED_APPLE_ACCOUNTS = '@evolve_saved_apple_accs';

export default function AuthScreen() {
  const { activePaletteId, customPalettes, deletedPaletteIds, setAuth, setUserProfile } = useStore();
  const palette = getActivePalette({ activePaletteId, customPalettes, deletedPaletteIds });

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

  // Cuentas de Google y Apple
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [appleModalOpen, setAppleModalOpen] = useState(false);
  const [savedGoogleAccounts, setSavedGoogleAccounts] = useState<Array<{ name: string; email: string }>>([
    { name: 'Sergio Tamayo', email: 'sergiotacu77@gmail.com' },
  ]);
  const [savedAppleAccounts, setSavedAppleAccounts] = useState<Array<{ name: string; email: string }>>([
    { name: 'Sergio Tamayo', email: 'sergiotacu77@icloud.com' },
  ]);

  // Agregar otra cuenta Google / Apple
  const [addingCustomGoogle, setAddingCustomGoogle] = useState(false);
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');

  const [addingCustomApple, setAddingCustomApple] = useState(false);
  const [customAppleName, setCustomAppleName] = useState('');
  const [customAppleEmail, setCustomAppleEmail] = useState('');

  // Formulario Modal para completar datos requeridos de Registro Social
  const [socialRegOpen, setSocialRegOpen] = useState(false);
  const [socialRegProvider, setSocialRegProvider] = useState<'google' | 'apple'>('google');
  const [socialRegEmail, setSocialRegEmail] = useState('');
  const [socialRegName, setSocialRegName] = useState('');
  const [socialRegNickname, setSocialRegNickname] = useState('');
  const [socialRegGender, setSocialRegGender] = useState<GenderOption>('Masculino');
  const [socialRegHeight, setSocialRegHeight] = useState('175');
  const [socialRegBirthDate, setSocialRegBirthDate] = useState('2000-05-14');
  const socialRegAge = useMemo(() => calculateAgeFromBirthDate(socialRegBirthDate), [socialRegBirthDate]);
  const [socialRegNickStatus, setSocialRegNickStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });
  const [socialRegLoading, setSocialRegLoading] = useState(false);

  // Cargar cuentas guardadas de storage al iniciar
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_SAVED_GOOGLE_ACCOUNTS).then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSavedGoogleAccounts(parsed);
          }
        } catch {}
      }
    });
    AsyncStorage.getItem(STORAGE_SAVED_APPLE_ACCOUNTS).then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSavedAppleAccounts(parsed);
          }
        } catch {}
      }
    });
  }, []);

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

  // Verificación reactiva con debounce de Nickname en registro social
  useEffect(() => {
    if (!socialRegOpen) return;
    const clean = socialRegNickname.trim().replace('@', '');
    if (!clean) {
      setSocialRegNickStatus({ checking: false, available: null, message: '' });
      return;
    }
    if (clean.length < 3) {
      setSocialRegNickStatus({ checking: false, available: false, message: 'El apodo debe tener al menos 3 caracteres.' });
      return;
    }

    setSocialRegNickStatus((prev) => ({ ...prev, checking: true }));
    const timer = setTimeout(async () => {
      const res = await apiCheckNickname(clean);
      setSocialRegNickStatus({
        checking: false,
        available: res.available,
        message: res.available ? `✓ @${clean} está disponible` : (res.message || `✕ @${clean} ya está en uso`),
      });
    }, 380);

    return () => clearTimeout(timer);
  }, [socialRegNickname, socialRegOpen]);

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
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      Alert.alert('Campos requeridos', 'Por favor ingresa tu correo y contraseña.');
      return;
    }

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
      // Prellenar en el formulario principal para entrar con un toque
      setEmail(clean);
      setPassword(newPassword);
      setMode('login');
    } catch (err: any) {
      Alert.alert('Error al restablecer', err.message || 'No fue posible restablecer la contraseña.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  // Selección de Cuenta Social (Google o Apple)
  const handleSelectSocialAccount = async (
    provider: 'google' | 'apple',
    selectedEmail: string,
    selectedName: string,
  ) => {
    setGoogleModalOpen(false);
    setAppleModalOpen(false);
    setLoading(true);

    try {
      const cleanEmail = selectedEmail.trim().toLowerCase();
      const res = await apiSocialLogin({
        provider,
        providerId: `social_${provider}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: cleanEmail,
        name: selectedName.trim(),
      });

      if (res.isNewUser) {
        // Usuario nuevo: abrir formulario para completar datos obligatorios de atleta
        setSocialRegProvider(provider);
        setSocialRegEmail(cleanEmail);
        setSocialRegName(selectedName.trim());
        const suggestedNick = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
        setSocialRegNickname(suggestedNick);
        setSocialRegGender('Masculino');
        setSocialRegHeight('175');
        setSocialRegBirthDate('2000-05-14');
        setSocialRegOpen(true);
      } else {
        // Usuario ya registrado previamente: entrar directamente
        if (res.token && res.user) {
          setAuth(res.token, res.user as any);
          if (res.userProfile) {
            setUserProfile(res.userProfile);
          }
          pullUserDataFromDatabase().catch(() => {});
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || `Error al conectar con ${provider}.`);
    } finally {
      setLoading(false);
    }
  };

  // Agregar y seleccionar cuenta personalizada de Google
  const handleAddCustomGoogleAccount = async () => {
    const cleanMail = customGoogleEmail.trim().toLowerCase();
    const cleanName = customGoogleName.trim() || cleanMail.split('@')[0];
    if (!cleanMail || !cleanMail.includes('@')) {
      Alert.alert('Correo inválido', 'Por favor ingresa un correo de Google válido.');
      return;
    }
    const updated = [...savedGoogleAccounts.filter((a) => a.email.toLowerCase() !== cleanMail), { name: cleanName, email: cleanMail }];
    setSavedGoogleAccounts(updated);
    AsyncStorage.setItem(STORAGE_SAVED_GOOGLE_ACCOUNTS, JSON.stringify(updated)).catch(() => {});
    setAddingCustomGoogle(false);
    setCustomGoogleName('');
    setCustomGoogleEmail('');
    handleSelectSocialAccount('google', cleanMail, cleanName);
  };

  // Agregar y seleccionar cuenta personalizada de Apple
  const handleAddCustomAppleAccount = async () => {
    const cleanMail = customAppleEmail.trim().toLowerCase();
    const cleanName = customAppleName.trim() || cleanMail.split('@')[0];
    if (!cleanMail || !cleanMail.includes('@')) {
      Alert.alert('Correo inválido', 'Por favor ingresa un Apple ID válido.');
      return;
    }
    const updated = [...savedAppleAccounts.filter((a) => a.email.toLowerCase() !== cleanMail), { name: cleanName, email: cleanMail }];
    setSavedAppleAccounts(updated);
    AsyncStorage.setItem(STORAGE_SAVED_APPLE_ACCOUNTS, JSON.stringify(updated)).catch(() => {});
    setAddingCustomApple(false);
    setCustomAppleName('');
    setCustomAppleEmail('');
    handleSelectSocialAccount('apple', cleanMail, cleanName);
  };

  // Completar el registro de atleta para cuentas sociales (Google / Apple)
  const handleCompleteSocialRegistration = async () => {
    if (!socialRegName.trim()) {
      Alert.alert('Nombre requerido', 'Por favor ingresa tu nombre completo.');
      return;
    }
    const cleanNick = socialRegNickname.trim().replace('@', '');
    if (!cleanNick || cleanNick.length < 3) {
      Alert.alert('Apodo requerido', 'El apodo o nickname debe tener al menos 3 caracteres.');
      return;
    }
    if (socialRegNickStatus.available === false) {
      Alert.alert('Apodo no disponible', 'El apodo ingresado ya está en uso. Por favor elige uno diferente.');
      return;
    }
    if (!socialRegHeight.trim() || isNaN(parseFloat(socialRegHeight)) || parseFloat(socialRegHeight) < 80 || parseFloat(socialRegHeight) > 260) {
      Alert.alert('Altura inválida', 'Por favor ingresa una altura válida en centímetros (ej. 175).');
      return;
    }
    if (!socialRegBirthDate.trim() || socialRegBirthDate.split('-').length !== 3) {
      Alert.alert('Fecha inválida', 'Por favor ingresa tu fecha de nacimiento en formato AAAA-MM-DD.');
      return;
    }

    setSocialRegLoading(true);
    try {
      const heightNum = parseFloat(socialRegHeight) || 175;
      const res = await apiSocialRegister({
        provider: socialRegProvider,
        providerId: `social_${socialRegProvider}_${socialRegEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: socialRegEmail,
        name: socialRegName.trim(),
        nickname: cleanNick,
        gender: socialRegGender,
        height: heightNum,
        birthDate: socialRegBirthDate.trim(),
        age: socialRegAge,
      });

      setAuth(res.token, res.user);
      if (res.userProfile) {
        setUserProfile(res.userProfile);
      }
      setSocialRegOpen(false);
      pullUserDataFromDatabase().catch(() => {});
    } catch (err: any) {
      Alert.alert('Error en registro', err.message || 'No fue posible completar el registro.');
    } finally {
      setSocialRegLoading(false);
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

            <Text style={[styles.inputLabel, { color: palette.textSub }]}>CORREO ELECTRÓNICO</Text>
            <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <Ionicons name="mail-outline" size={17} color={palette.primary} />
              <TextInput
                style={[styles.textInput, { color: palette.text }]}
                placeholder="tu@correo.com"
                placeholderTextColor={palette.textSub}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
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

          {/* Divisor 'O continúa con' */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
            <Text style={[styles.dividerText, { color: palette.textSub }]}>O CONTINÚA CON</Text>
            <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
          </View>

          {/* Botones Sociales (Google y Apple) */}
          <View style={styles.socialRow}>
            <Pressable
              style={({ pressed }) => [
                styles.socialBtn,
                { backgroundColor: palette.cardBg, borderColor: palette.border },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setGoogleModalOpen(true)}
              disabled={loading}
            >
              <Ionicons name="logo-google" size={18} color="#EA4335" />
              <Text style={[styles.socialBtnText, { color: palette.text }]}>Google</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.socialBtn,
                { backgroundColor: palette.cardBg, borderColor: palette.border },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setAppleModalOpen(true)}
              disabled={loading}
            >
              <Ionicons name="logo-apple" size={19} color={palette.text} />
              <Text style={[styles.socialBtnText, { color: palette.text }]}>Apple</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* POPUP 1: SELECTOR DE CUENTAS DE GOOGLE */}
      {googleModalOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setGoogleModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
              <View style={styles.modalHeader}>
                <Ionicons name="logo-google" size={24} color="#EA4335" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.modalTitle, { color: palette.text }]}>Elegir una cuenta</Text>
                  <Text style={[styles.modalSubtitle, { color: palette.textSub }]}>para continuar en Evolve</Text>
                </View>
              </View>

              <ScrollView style={{ maxHeight: 280, marginVertical: 10 }} showsVerticalScrollIndicator={false}>
                {savedGoogleAccounts.map((acc, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.socialAccountItem, { backgroundColor: palette.bg, borderColor: palette.border }]}
                    onPress={() => handleSelectSocialAccount('google', acc.email, acc.name)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.socialAccountAvatar, { backgroundColor: `${palette.primary}25` }]}>
                      <Text style={{ fontWeight: '800', color: palette.primary, fontSize: 16 }}>
                        {acc.name ? acc.name.charAt(0).toUpperCase() : 'G'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.socialAccountName, { color: palette.text }]}>{acc.name}</Text>
                      <Text style={[styles.socialAccountEmail, { color: palette.textSub }]}>{acc.email}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={palette.textSub} />
                  </TouchableOpacity>
                ))}

                {!addingCustomGoogle ? (
                  <TouchableOpacity
                    style={[styles.addAccountToggleBtn, { borderColor: palette.primary, backgroundColor: `${palette.primary}10` }]}
                    onPress={() => setAddingCustomGoogle(true)}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
                    <Text style={[styles.addAccountToggleText, { color: palette.primary }]}>
                      Usar o agregar otra cuenta de Google
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.customAccountBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                    <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 0 }]}>NOMBRE EN GOOGLE</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: palette.cardBg, borderColor: palette.border, height: 40 }]}>
                      <Ionicons name="person-outline" size={15} color={palette.primary} />
                      <TextInput
                        style={[styles.textInput, { color: palette.text }]}
                        placeholder="Ej. Juan Pérez"
                        placeholderTextColor={palette.textSub}
                        value={customGoogleName}
                        onChangeText={setCustomGoogleName}
                      />
                    </View>

                    <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 8 }]}>CORREO DE GOOGLE</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: palette.cardBg, borderColor: palette.border, height: 40 }]}>
                      <Ionicons name="mail-outline" size={15} color={palette.primary} />
                      <TextInput
                        style={[styles.textInput, { color: palette.text }]}
                        placeholder="usuario@gmail.com"
                        placeholderTextColor={palette.textSub}
                        value={customGoogleEmail}
                        onChangeText={setCustomGoogleEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                      <Pressable
                        style={[styles.modalCancelBtn, { borderColor: palette.border, paddingVertical: 8 }]}
                        onPress={() => setAddingCustomGoogle(false)}
                      >
                        <Text style={[styles.modalCancelText, { color: palette.textSub, fontSize: 12 }]}>Cancelar</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.modalSaveBtn, { backgroundColor: palette.primary, paddingVertical: 8 }]}
                        onPress={handleAddCustomGoogleAccount}
                      >
                        <Text style={[styles.modalSaveText, { fontSize: 12 }]}>Continuar</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </ScrollView>

              <Pressable
                style={[styles.modalCancelBtn, { borderColor: palette.border, marginTop: 6 }]}
                onPress={() => {
                  setGoogleModalOpen(false);
                  setAddingCustomGoogle(false);
                }}
              >
                <Text style={[styles.modalCancelText, { color: palette.textSub }]}>Cerrar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* POPUP 2: SELECTOR DE CUENTAS DE APPLE */}
      {appleModalOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setAppleModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
              <View style={styles.modalHeader}>
                <Ionicons name="logo-apple" size={24} color={palette.text} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.modalTitle, { color: palette.text }]}>Iniciar sesión con Apple ID</Text>
                  <Text style={[styles.modalSubtitle, { color: palette.textSub }]}>para entrenar en Evolve</Text>
                </View>
              </View>

              <ScrollView style={{ maxHeight: 280, marginVertical: 10 }} showsVerticalScrollIndicator={false}>
                {savedAppleAccounts.map((acc, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.socialAccountItem, { backgroundColor: palette.bg, borderColor: palette.border }]}
                    onPress={() => handleSelectSocialAccount('apple', acc.email, acc.name)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.socialAccountAvatar, { backgroundColor: `${palette.text}18` }]}>
                      <Ionicons name="logo-apple" size={18} color={palette.text} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.socialAccountName, { color: palette.text }]}>{acc.name}</Text>
                      <Text style={[styles.socialAccountEmail, { color: palette.textSub }]}>{acc.email}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={palette.textSub} />
                  </TouchableOpacity>
                ))}

                {!addingCustomApple ? (
                  <TouchableOpacity
                    style={[styles.addAccountToggleBtn, { borderColor: palette.primary, backgroundColor: `${palette.primary}10` }]}
                    onPress={() => setAddingCustomApple(true)}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={palette.primary} />
                    <Text style={[styles.addAccountToggleText, { color: palette.primary }]}>
                      Usar o agregar otro Apple ID
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.customAccountBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                    <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 0 }]}>NOMBRE EN APPLE</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: palette.cardBg, borderColor: palette.border, height: 40 }]}>
                      <Ionicons name="person-outline" size={15} color={palette.primary} />
                      <TextInput
                        style={[styles.textInput, { color: palette.text }]}
                        placeholder="Ej. Sergio Tamayo"
                        placeholderTextColor={palette.textSub}
                        value={customAppleName}
                        onChangeText={setCustomAppleName}
                      />
                    </View>

                    <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 8 }]}>APPLE ID / CORREO</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: palette.cardBg, borderColor: palette.border, height: 40 }]}>
                      <Ionicons name="mail-outline" size={15} color={palette.primary} />
                      <TextInput
                        style={[styles.textInput, { color: palette.text }]}
                        placeholder="usuario@icloud.com"
                        placeholderTextColor={palette.textSub}
                        value={customAppleEmail}
                        onChangeText={setCustomAppleEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                      <Pressable
                        style={[styles.modalCancelBtn, { borderColor: palette.border, paddingVertical: 8 }]}
                        onPress={() => setAddingCustomApple(false)}
                      >
                        <Text style={[styles.modalCancelText, { color: palette.textSub, fontSize: 12 }]}>Cancelar</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.modalSaveBtn, { backgroundColor: palette.primary, paddingVertical: 8 }]}
                        onPress={handleAddCustomAppleAccount}
                      >
                        <Text style={[styles.modalSaveText, { fontSize: 12 }]}>Continuar</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </ScrollView>

              <Pressable
                style={[styles.modalCancelBtn, { borderColor: palette.border, marginTop: 6 }]}
                onPress={() => {
                  setAppleModalOpen(false);
                  setAddingCustomApple(false);
                }}
              >
                <Text style={[styles.modalCancelText, { color: palette.textSub }]}>Cerrar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* POPUP 3: FORMULARIO PARA COMPLETAR REGISTRO SOCIAL DE ATLETA */}
      {socialRegOpen && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSocialRegOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: palette.cardBg, borderColor: palette.border, maxHeight: '90%' }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Ionicons
                    name={socialRegProvider === 'google' ? 'logo-google' : 'logo-apple'}
                    size={22}
                    color={socialRegProvider === 'google' ? '#EA4335' : palette.text}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.modalTitle, { color: palette.text }]}>Completa tu Registro</Text>
                    <Text style={[styles.modalSubtitle, { color: palette.textSub }]}>
                      Configura tu perfil para activar el cálculo de metas y calorías.
                    </Text>
                  </View>
                </View>

                {/* Badge de cuenta social conectada */}
                <View style={[styles.socialProviderBadge, { backgroundColor: `${palette.primary}15`, borderColor: `${palette.primary}40` }]}>
                  <Ionicons
                    name={socialRegProvider === 'google' ? 'logo-google' : 'logo-apple'}
                    size={14}
                    color={socialRegProvider === 'google' ? '#EA4335' : palette.text}
                  />
                  <Text style={[styles.socialProviderBadgeText, { color: palette.text }]}>
                    Conectado con {socialRegProvider === 'google' ? 'Google' : 'Apple'}: <Text style={{ fontWeight: '800', color: palette.primary }}>{socialRegEmail}</Text>
                  </Text>
                </View>

                {/* Nombre Completo */}
                <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 6 }]}>NOMBRE COMPLETO</Text>
                <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                  <Ionicons name="person-outline" size={16} color={palette.primary} />
                  <TextInput
                    style={[styles.textInput, { color: palette.text }]}
                    value={socialRegName}
                    onChangeText={setSocialRegName}
                    placeholder="Tu nombre completo"
                    placeholderTextColor={palette.textSub}
                  />
                </View>

                {/* Nickname con verificación en BD */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 6 }}>
                  <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 0, marginBottom: 0 }]}>
                    APODO / NICKNAME (ID ÚNICO)
                  </Text>
                  {socialRegNickStatus.checking && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <ActivityIndicator size="small" color={palette.primary} />
                      <Text style={{ fontSize: 10.5, color: palette.textSub, fontWeight: '600' }}>Verificando...</Text>
                    </View>
                  )}
                  {!socialRegNickStatus.checking && socialRegNickStatus.available !== null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons
                        name={socialRegNickStatus.available ? 'checkmark-circle' : 'close-circle'}
                        size={13}
                        color={socialRegNickStatus.available ? '#10B981' : '#EF4444'}
                      />
                      <Text
                        style={{
                          fontSize: 10.5,
                          fontWeight: '800',
                          color: socialRegNickStatus.available ? '#10B981' : '#EF4444',
                        }}
                      >
                        {socialRegNickStatus.available ? 'Disponible' : 'No disponible'}
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
                        socialRegNickStatus.available === false
                          ? '#EF4444'
                          : socialRegNickStatus.available === true
                          ? '#10B981'
                          : palette.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="at-outline"
                    size={16}
                    color={
                      socialRegNickStatus.available === false
                        ? '#EF4444'
                        : socialRegNickStatus.available === true
                        ? '#10B981'
                        : palette.primary
                    }
                  />
                  <TextInput
                    style={[styles.textInput, { color: palette.text }]}
                    value={socialRegNickname}
                    onChangeText={(v) => setSocialRegNickname(v.replace(/\s+/g, ''))}
                    placeholder="Ej. AtletaFuerte"
                    placeholderTextColor={palette.textSub}
                    autoCapitalize="none"
                  />
                </View>

                {socialRegNickStatus.message ? (
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: socialRegNickStatus.available ? '#10B981' : '#EF4444',
                      marginTop: 3,
                      marginBottom: 4,
                      marginLeft: 2,
                    }}
                  >
                    {socialRegNickStatus.message}
                  </Text>
                ) : null}

                {/* Género Biológico */}
                <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 8 }]}>GÉNERO BIOLÓGICO</Text>
                <View style={styles.genderRow}>
                  {(['Masculino', 'Femenino'] as GenderOption[]).map((g) => {
                    const isSel = socialRegGender === g;
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
                        onPress={() => setSocialRegGender(g)}
                      >
                        <Ionicons
                          name={g === 'Masculino' ? 'male' : 'female'}
                          size={15}
                          color={isSel ? '#FFFFFF' : palette.textSub}
                        />
                        <Text style={[styles.genderBtnText, { color: isSel ? '#FFFFFF' : palette.text }]}>{g}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Altura y Fecha de Nacimiento */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: palette.textSub }]}>ALTURA (CM)</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                      <Ionicons name="resize-outline" size={15} color={palette.primary} />
                      <TextInput
                        style={[styles.textInput, { color: palette.text }]}
                        value={socialRegHeight}
                        onChangeText={setSocialRegHeight}
                        placeholder="175"
                        placeholderTextColor={palette.textSub}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={{ flex: 1.35 }}>
                    <Text style={[styles.inputLabel, { color: palette.textSub }]}>FECHA NACIMIENTO</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                      <Ionicons name="calendar-outline" size={15} color={palette.primary} />
                      <TextInput
                        style={[styles.textInput, { color: palette.text }]}
                        value={socialRegBirthDate}
                        onChangeText={setSocialRegBirthDate}
                        placeholder="2000-05-14"
                        placeholderTextColor={palette.textSub}
                      />
                    </View>
                  </View>
                </View>

                {/* Badge Edad Calculada */}
                <View style={[styles.ageBadgeRow, { backgroundColor: `${palette.primary}15`, borderColor: `${palette.primary}35` }]}>
                  <Ionicons name="sparkles" size={14} color={palette.primary} />
                  <Text style={[styles.ageBadgeText, { color: palette.text }]}>
                    Edad calculada: <Text style={{ fontWeight: '900', color: palette.primary }}>{socialRegAge} años</Text>
                  </Text>
                </View>

                <View style={styles.modalActionRow}>
                  <Pressable
                    style={[styles.modalCancelBtn, { borderColor: palette.border }]}
                    onPress={() => setSocialRegOpen(false)}
                    disabled={socialRegLoading}
                  >
                    <Text style={[styles.modalCancelText, { color: palette.textSub }]}>Cancelar</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.modalSaveBtn, { backgroundColor: palette.primary }]}
                    onPress={handleCompleteSocialRegistration}
                    disabled={socialRegLoading}
                  >
                    {socialRegLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.modalSaveText}>Completar y Entrar</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  logoImage: {
    width: 290,
    height: 95,
    marginBottom: 6,
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  socialBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
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
  socialAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  socialAccountAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialAccountName: {
    fontSize: 13,
    fontWeight: '800',
  },
  socialAccountEmail: {
    fontSize: 11.5,
    marginTop: 1,
  },
  addAccountToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 6,
  },
  addAccountToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  customAccountBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginVertical: 6,
  },
  socialProviderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 8,
  },
  socialProviderBadgeText: {
    fontSize: 11.5,
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
