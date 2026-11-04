import React, { useState, useRef, useMemo } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useStore, getActivePalette, GenderOption, calculateAgeFromBirthDate } from './store';
import {
  apiLogin,
  apiRegister,
  apiSocialLogin,
  apiForgotPassword,
  apiResetPassword,
  getServerUrl,
  setServerUrl,
  checkServerHealth,
} from './api';
import EvolveLogo from './EvolveLogo';
import { pullUserDataFromDatabase } from './syncService';

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

  // Nuevos campos obligatorios de perfil atlético para registro
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
        const res = await apiRegister({
          email: cleanEmail,
          password,
          name: name.trim(),
          nickname: nickname.trim() || undefined,
          gender,
          height: heightNum,
          birthDate: birthDate.trim(),
          age: calculatedAge,
        });
        setAuth(res.token, res.user);
        setUserProfile({
          name: name.trim(),
          nickname: res.user.nickname || nickname.trim(),
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

  const handleSocialAuth = async (provider: 'google' | 'apple') => {
    setLoading(true);
    try {
      // Mock de autenticación social con credenciales seguras
      const randomId = Math.random().toString(36).substring(2, 10);
      const mockEmail = provider === 'google' ? 'atleta.google@evolve.app' : 'atleta.apple@evolve.app';
      const mockName = provider === 'google' ? 'Atleta Google' : 'Atleta Apple';

      const res = await apiSocialLogin({
        provider,
        providerId: `social_${provider}_${randomId}`,
        email: mockEmail,
        name: mockName,
      });

      setAuth(res.token, res.user);
      pullUserDataFromDatabase().catch(() => {});
    } catch (err: any) {
      Alert.alert('Error', err.message || `Error al conectar con ${provider}.`);
    } finally {
      setLoading(false);
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
        style={[styles.serverSettingsBtn, { borderColor: palette.border, backgroundColor: palette.cardBg }]}
        onPress={() => setServerModalOpen(true)}
        hitSlop={8}
      >
        <Ionicons name="server-outline" size={16} color={palette.primary} />
        <Text style={[styles.serverSettingsBtnText, { color: palette.textSub }]}>Servidor</Text>
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Oficial SVG Adaptativo con la Paleta Activa */}
          <View style={styles.heroSection}>
            <EvolveLogo width={320} palette={palette} />
            <Text style={[styles.brandSubtitle, { color: palette.textSub, marginTop: 12 }]}>
              {mode === 'login'
                ? 'Bienvenido de vuelta. Continúa tu evolución atlética.'
                : 'Crea tu cuenta y empieza a registrar tu progreso.'}
            </Text>
          </View>

          {/* Selector Segmentado de Modo (Login / Registro) */}
          <View style={[styles.segmentedContainer, { borderColor: palette.border, backgroundColor: palette.cardBg }]}>
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

                <Text style={[styles.inputLabel, { color: palette.textSub }]}>APODO / NICKNAME (OPCIONAL)</Text>
                <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                  <Ionicons name="at-outline" size={17} color={palette.primary} />
                  <TextInput
                    style={[styles.textInput, { color: palette.text }]}
                    placeholder="Ej. Sertic77"
                    placeholderTextColor={palette.textSub}
                    value={nickname}
                    onChangeText={setNickname}
                    autoCapitalize="none"
                  />
                </View>

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

            <Text style={[styles.inputLabel, { color: palette.textSub }]}>CONTRASEÑA</Text>
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

            {mode === 'login' && (
              <Pressable
                style={styles.forgotPasswordBtn}
                onPress={() => {
                  setRecoveryEmail(email.trim());
                  setRecoveryStep(1);
                  setRecoveryCode('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                  setReceivedCodeHint(null);
                  setForgotModalOpen(true);
                }}
              >
                <Ionicons name="key-outline" size={14} color={palette.primary} />
                <Text style={[styles.forgotPasswordText, { color: palette.primary }]}>
                  ¿Olvidaste tu contraseña?
                </Text>
              </Pressable>
            )}

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

          {/* Divisor "O continúa con" */}
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
              onPress={() => handleSocialAuth('google')}
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
              onPress={() => handleSocialAuth('apple')}
              disabled={loading}
            >
              <Ionicons name="logo-apple" size={19} color={palette.text} />
              <Text style={[styles.socialBtnText, { color: palette.text }]}>Apple</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL PARA CONFIGURAR URL DEL SERVIDOR BACKEND */}
      {serverModalOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setServerModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
              <View style={styles.modalHeader}>
                <Ionicons name="server" size={20} color={palette.primary} />
                <Text style={[styles.modalTitle, { color: palette.text }]}>CONFIGURACIÓN DE SERVIDOR</Text>
              </View>

              <Text style={[styles.modalSubtitle, { color: palette.textSub }]}>
                Ajusta la dirección IP y puerto de tu PC para que la app se conecte al backend local o a tu servidor en la nube.
              </Text>

              <Text style={[styles.inputLabel, { color: palette.textSub, marginTop: 12 }]}>URL DEL BACKEND</Text>
              <View style={[styles.inputWrapper, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                <Ionicons name="link-outline" size={16} color={palette.primary} />
                <TextInput
                  style={[styles.textInput, { color: palette.text }]}
                  value={inputServerUrl}
                  onChangeText={setInputServerUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="http://192.168.1.XX:3001"
                  placeholderTextColor={palette.textSub}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Pressable
                  style={[styles.testBtn, { borderColor: palette.border }]}
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
                      keyboardType="numeric"
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
                      placeholder="Repite la nueva contraseña"
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
  forgotPasswordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontSize: 12,
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
    fontSize: 13.5,
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
    marginTop: 20,
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
