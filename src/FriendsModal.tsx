import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  Switch,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useStore,
  FriendUser,
  FriendNotification,
  ColorPalette,
  DISCOVERABLE_USERS,
  getFriendFullProfile,
  SectionPrivacySettings,
  ChallengeDetails,
  ChallengeVariable,
} from './store';
import { getServerUrl, apiGetFriendRequests } from './api';
import { syncSocialFromDatabase } from './syncService';

/* ==========================================================
   TIPOS DE ENTRENAMIENTO & GRUPOS MUSCULARES
========================================================== */
const WORKOUT_TYPES = [
  { id: 'weights', label: 'Pesas / Fuerza', icon: 'barbell-outline', emoji: '🏋️‍♂️' },
  { id: 'cardio', label: 'Cardio / Running', icon: 'walk-outline', emoji: '🏃' },
  { id: 'calisthenics', label: 'Calistenia', icon: 'body-outline', emoji: '🤸' },
  { id: 'sport', label: 'Deporte (Basket/Fútbol/Pádel)', icon: 'basketball-outline', emoji: '🏀' },
  { id: 'crossfit', label: 'CrossFit / Funcional', icon: 'flash-outline', emoji: '⚡' },
];

const MUSCLE_DIVISIONS = [
  { id: 'ppl', label: 'PPL (Push / Pull / Legs)', emoji: '💥' },
  { id: 'torso_pierna', label: 'Torso / Pierna', emoji: '🏛️' },
  { id: 'full_body', label: 'Full Body (Cuerpo Completo)', emoji: '⚡' },
  { id: 'push', label: 'Push (Pecho / Hombro / Tríceps)', emoji: '🛡️' },
  { id: 'pull', label: 'Pull (Espalda / Bíceps)', emoji: '⚔️' },
  { id: 'legs', label: 'Legs (Pierna & Glúteos)', emoji: '🦵' },
  { id: 'arms', label: 'Brazos & Hombros', emoji: '💪' },
  { id: 'chest_biceps', label: 'Pecho & Bíceps', emoji: '🎯' },
  { id: 'back_triceps', label: 'Espalda & Tríceps', emoji: '🏔️' },
];

const QUICK_DATES = ['Hoy', 'Mañana', 'Sábado', 'Domingo'];

/* ==========================================================
   COMPONENTE PRINCIPAL: SECCIÓN AMIGOS & COMUNIDAD
========================================================== */
export function FriendsModal({
  visible,
  onClose,
  c1,
  c2,
  palette,
  titleFont,
  subtitleFont,
  bodyFont,
  dataFont,
}: {
  visible: boolean;
  onClose: () => void;
  c1: string;
  c2: string;
  palette: ColorPalette;
  titleFont?: string;
  subtitleFont?: string;
  bodyFont?: string;
  dataFont?: string;
}) {
  // Store hooks
  const friends = useStore((s) => s.friends) || [];
  const friendNotifications = useStore((s) => s.friendNotifications) || [];
  const privacySettings = useStore((s) => s.privacySettings);
  const updatePrivacySettings = useStore((s) => s.updatePrivacySettings);
  const sendWorkoutInvite = useStore((s) => s.sendWorkoutInvite);
  const acceptFriendRequest = useStore((s) => s.acceptFriendRequest);
  const rejectFriendRequest = useStore((s) => s.rejectFriendRequest);
  const respondWorkoutInvite = useStore((s) => s.respondWorkoutInvite);
  const markNotificationsAsRead = useStore((s) => s.markNotificationsAsRead);
  const sendFriendRequestTo = useStore((s) => s.sendFriendRequestTo);
  const sendChallenge = useStore((s) => s.sendChallenge);
  const respondChallenge = useStore((s) => s.respondChallenge);
  const authUser = useStore((s) => s.authUser);
  const authToken = useStore((s) => s.authToken);
  const pendingSentRequestUserIds = useStore((s) => s.pendingSentRequestUserIds) || [];
  const setPendingSentRequestUserIds = useStore((s) => s.setPendingSentRequestUserIds);
  const removeFriend = useStore((s) => s.removeFriend);

  // Estados locales
  const [activeTab, setActiveTab] = useState<'friends' | 'discover'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [selectedFriendForProfile, setSelectedFriendForProfile] = useState<FriendUser | null>(null);
  const [selectedFriendForInvite, setSelectedFriendForInvite] = useState<FriendUser | null>(null);
  const [selectedFriendForChallenge, setSelectedFriendForChallenge] = useState<FriendUser | null>(null);
  const [friendForMenu, setFriendForMenu] = useState<FriendUser | null>(null);
  const [dbUsers, setDbUsers] = useState<any[]>([]);

  // Cargar usuarios reales de la base de datos y sincronizar amigos y solicitudes
  useEffect(() => {
    let isMounted = true;
    if (visible) {
      syncSocialFromDatabase();
    }
    const fetchDbUsers = async () => {
      try {
        const headers: Record<string, string> = {};
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        }
        const res = await fetch(`${getServerUrl()}/api/users`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.users && Array.isArray(data.users)) {
            setDbUsers(data.users);
          }
        }
      } catch {
        // Silencioso
      }
    };

    const fetchRequests = async () => {
      if (authToken) {
        try {
          const data = await apiGetFriendRequests(authToken);
          if (isMounted && data && Array.isArray(data.sent)) {
            const activePendingIds: string[] = [];
            data.sent.forEach((r: any) => {
              if (r.receiver?.id) activePendingIds.push(r.receiver.id);
              if (r.receiver?.nickname) {
                const clean = r.receiver.nickname.startsWith('@') ? r.receiver.nickname : `@${r.receiver.nickname}`;
                activePendingIds.push(clean);
                activePendingIds.push(r.receiver.nickname);
              }
            });
            setPendingSentRequestUserIds(activePendingIds);
          }
        } catch {
          // Silencioso
        }
      }
    };

    fetchDbUsers();
    fetchRequests();

    // Polling activo mientras el modal de amigos esté abierto para reflejar cambios en tiempo real
    const livePoll = setInterval(() => {
      if (isMounted) {
        syncSocialFromDatabase();
        fetchRequests();
      }
    }, 3500);

    return () => {
      isMounted = false;
      clearInterval(livePoll);
    };
  }, [visible, authToken]);

  // Notificaciones no leídas y pendientes
  const unreadNotifs = friendNotifications.filter(
    (n) => !n.read && n.status === 'pending'
  );
  const unreadCount = unreadNotifs.length;

  // Filtrado de amigos
  const filteredFriends = friends.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.nickname.toLowerCase().includes(q);
  });

  // Filtrado de usuarios para descubrir ÚNICAMENTE desde la base de datos (cuentas reales existentes)
  const currentNick = (authUser?.nickname ? `@${authUser.nickname.replace('@', '')}` : '').toLowerCase();
  const currentId = authUser?.id;
  const currentEmail = authUser?.email?.toLowerCase();
  const friendNicks = new Set(friends.map((f) => f.nickname.toLowerCase()));
  const friendIds = new Set(friends.map((f) => f.id));

  const allDiscoverable: FriendUser[] = [];

  // Integrar únicamente las cuentas que existen en la base de datos
  dbUsers.forEach((dbU: any) => {
    const cleanNick = dbU.nickname ? (dbU.nickname.startsWith('@') ? dbU.nickname : `@${dbU.nickname}`) : '';
    const isMe =
      (currentId && dbU.id === currentId) ||
      (currentNick && cleanNick.toLowerCase() === currentNick) ||
      (currentEmail && dbU.email && dbU.email.toLowerCase() === currentEmail);

    if (isMe) return; // No mostrarse a uno mismo en sugerencias
    if (friendIds.has(dbU.id) || friendNicks.has(cleanNick.toLowerCase())) return; // Ya es amigo

    const initials = dbU.name ? dbU.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'AT';

    allDiscoverable.push({
      id: dbU.id,
      name: dbU.name || 'Atleta Evolve',
      nickname: cleanNick,
      streak: typeof dbU.streak === 'number' ? dbU.streak : 10,
      level: typeof dbU.level === 'number' ? dbU.level : 15,
      rank: dbU.rank || dbU.rankTitle || 'Atleta Activo',
      todayWorkout: 'Entrenamiento Registrado 🔥',
      color: '#6366F1',
      initials,
      avatarUri: dbU.avatarUrl || undefined,
      metrics: {
        currentWeight: 76,
        bodyFat: 14.8,
        avgCalories: 2600,
        avgProtein: 165,
        prs: [{ exercise: 'Press Banca', weight: 95, reps: 5, date: '2026-10-22' }],
        recentWorkouts: [{ id: `w-db-${dbU.id}`, date: 'Ayer', title: 'Fuerza General', durationMinutes: 60, exercises: ['Sentadilla', 'Press Militar'], totalSets: 14 }],
        activeGoal: 'Superar sus límites este año',
      },
    });
  });

  const filteredDiscover = allDiscoverable.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.nickname.toLowerCase().includes(q);
  });

  // Estadísticas rápidas
  const highestStreak = friends.length > 0 ? Math.max(...friends.map((f) => f.streak)) : 0;
  const activeTodayCount = friends.filter((f) => f.todayWorkout && !f.todayWorkout.includes('Descanso')).length;

  // Enviar solicitud de amistad (espera respuesta y validación del otro usuario)
  const handleSendRequest = (user: FriendUser) => {
    sendFriendRequestTo(user);
    Alert.alert(
      '¡Solicitud Enviada! 🤝',
      `Le has enviado una solicitud de amistad a ${user.name} (${user.nickname}). Debe aceptarla para que aparezca en tu lista de amigos.`
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        {/* Cabecera Superior con Botón de Notificaciones y Ajustes de Privacidad */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: palette.cardBg,
              borderBottomColor: palette.border,
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={10}>
              <Ionicons name="arrow-back" size={24} color={palette.text} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.headerTitle, { color: palette.text, fontFamily: titleFont }]}>
                Amigos & Comunidad
              </Text>
              <Text style={[styles.headerSubtitle, { color: palette.textSub, fontFamily: bodyFont }]}>
                {friends.length} compañeros de entrenamiento
              </Text>
            </View>
          </View>

          {/* Botones de Cabecera: Configuración de Privacidad y Notificaciones */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Botón Settings (Configurar Privacidad de Secciones) */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowPrivacyModal(true)}
              style={[
                styles.iconBtnHeader,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.isDark ? '#1E293B' : '#F1F5F9',
                },
              ]}
            >
              <Ionicons name="settings-outline" size={19} color={palette.text} />
            </TouchableOpacity>

            {/* Icono de Notificaciones con Badge */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowNotificationsModal(true)}
              style={[
                styles.iconBtnHeader,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.isDark ? '#1E293B' : '#F1F5F9',
                },
              ]}
            >
              <Ionicons
                name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
                size={20}
                color={unreadCount > 0 ? c1 : palette.text}
              />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Banner de Comunidad y Estadísticas */}
          <LinearGradient
            colors={[c1, c2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroRow}>
              <View style={styles.heroStatItem}>
                <Text style={[styles.heroStatNumber, { fontFamily: dataFont }]}>{friends.length}</Text>
                <Text style={[styles.heroStatLabel, { fontFamily: subtitleFont }]}>Amigos</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStatItem}>
                <Text style={[styles.heroStatNumber, { fontFamily: dataFont }]}>{highestStreak}d</Text>
                <Text style={[styles.heroStatLabel, { fontFamily: subtitleFont }]}>Mejor Racha</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStatItem}>
                <Text style={[styles.heroStatNumber, { fontFamily: dataFont }]}>{activeTodayCount}</Text>
                <Text style={[styles.heroStatLabel, { fontFamily: subtitleFont }]}>Activos Hoy</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Barra de Búsqueda con ID único @nickname */}
          <View
            style={[
              styles.searchBarContainer,
              {
                backgroundColor: palette.cardBg,
                borderColor: palette.border,
              },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={palette.textSub} style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={
                activeTab === 'friends'
                  ? 'Buscar por nombre o ID (@nickname)...'
                  : 'Buscar atletas en la base de datos por @nickname...'
              }
              placeholderTextColor={palette.textSub}
              style={[styles.searchInput, { color: palette.text, fontFamily: bodyFont }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={palette.textSub} />
              </TouchableOpacity>
            )}
          </View>

          {/* Selector de Pestañas */}
          <View style={[styles.tabSelectorRow, { backgroundColor: palette.isDark ? '#0F172A' : '#E2E8F0' }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setActiveTab('friends')}
              style={[
                styles.tabBtn,
                activeTab === 'friends' && [
                  styles.tabBtnActive,
                  { backgroundColor: palette.cardBg },
                ],
              ]}
            >
              <Ionicons
                name="people"
                size={16}
                color={activeTab === 'friends' ? c1 : palette.textSub}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color: activeTab === 'friends' ? palette.text : palette.textSub,
                    fontFamily: subtitleFont,
                  },
                ]}
              >
                Mis Amigos ({friends.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setActiveTab('discover')}
              style={[
                styles.tabBtn,
                activeTab === 'discover' && [
                  styles.tabBtnActive,
                  { backgroundColor: palette.cardBg },
                ],
              ]}
            >
              <Ionicons
                name="person-add"
                size={16}
                color={activeTab === 'discover' ? c2 : palette.textSub}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color: activeTab === 'discover' ? palette.text : palette.textSub,
                    fontFamily: subtitleFont,
                  },
                ]}
              >
                Descubrir ({filteredDiscover.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: LISTADO DE AMIGOS */}
          {activeTab === 'friends' && (
            <View style={styles.sectionWrap}>
              {filteredFriends.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
                  <Ionicons name="people-outline" size={44} color={palette.textSub} style={{ opacity: 0.5 }} />
                  <Text style={[styles.emptyTitle, { color: palette.text, fontFamily: titleFont }]}>
                    No se encontraron amigos
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: palette.textSub, fontFamily: bodyFont }]}>
                    {searchQuery
                      ? 'No hay amigos que coincidan con la búsqueda por nombre o @nickname.'
                      : '¡Añade amigos para observar sus métricas completas y retarlos a entrenar juntos!'}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setActiveTab('discover')}
                    style={[styles.emptyActionBtn, { backgroundColor: c1 }]}
                  >
                    <Ionicons name="person-add-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={[styles.emptyActionBtnText, { fontFamily: subtitleFont }]}>
                      Buscar Nuevos Atletas
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredFriends.map((friend) => (
                  <View
                    key={friend.nickname}
                    style={[
                      styles.friendCard,
                      {
                        backgroundColor: palette.cardBg,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    {/* Fila Superior: Avatar + Info + Racha */}
                    <View style={styles.friendCardTop}>
                      <View style={styles.friendIdentityRow}>
                        <View style={[styles.friendAvatar, { backgroundColor: friend.color }]}>
                          <Text style={styles.friendAvatarText}>{friend.initials}</Text>
                          <View style={styles.activeDot} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.friendName, { color: palette.text, fontFamily: titleFont }]}>
                            {friend.name}
                          </Text>
                          <Text style={[styles.friendNickBadge, { color: c1, fontFamily: subtitleFont }]}>
                            {friend.nickname}
                          </Text>
                        </View>
                      </View>

                      {/* Pill de Racha y Botón de Opciones (3 puntitos) */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.streakPill, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                          <Text style={styles.streakPillText}>🔥 {friend.streak}d</Text>
                        </View>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          onPress={() => setFriendForMenu(friend)}
                          style={[
                            styles.friendMenuBtn,
                            {
                              borderColor: palette.border,
                              backgroundColor: palette.isDark ? '#1E293B' : '#F1F5F9',
                            },
                          ]}
                        >
                          <Ionicons name="ellipsis-vertical" size={16} color={palette.textSub} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Fila Media: Nivel y Entrenamiento de hoy */}
                    <View style={styles.friendCardMid}>
                      <View style={[styles.levelTag, { backgroundColor: `${c1}18`, borderColor: `${c1}35` }]}>
                        <Text style={[styles.levelTagText, { color: c1, fontFamily: subtitleFont }]}>
                          ⭐ Nvl {friend.level} · {friend.rank}
                        </Text>
                      </View>
                      <Text style={[styles.todayWorkoutText, { color: palette.text, fontFamily: bodyFont }]} numberOfLines={1}>
                        🏋️ {friend.todayWorkout}
                      </Text>
                    </View>

                    {/* Fila Inferior: BOTONES OBSERVAR, INVITAR Y RETAR */}
                    <View style={styles.friendActionsRow}>
                      {/* Botón 1: Observar (Ver Perfil y Métricas Completas) */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setSelectedFriendForProfile(friend)}
                        style={[
                          styles.actionBtnObservar,
                          {
                            backgroundColor: palette.isDark ? '#1E293B' : '#F8FAFC',
                            borderColor: palette.border,
                          },
                        ]}
                      >
                        <Ionicons name="eye-outline" size={15} color={c1} style={{ marginRight: 4 }} />
                        <Text style={[styles.actionBtnObservarText, { color: palette.text, fontFamily: subtitleFont }]}>
                          Observar
                        </Text>
                      </TouchableOpacity>

                      {/* Botón 2: Invitar a entrenar */}
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setSelectedFriendForInvite(friend)}
                        style={[
                          styles.actionBtnInvitar,
                          {
                            backgroundColor: c1,
                          },
                        ]}
                      >
                        <Ionicons name="fitness-outline" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={[styles.actionBtnInvitarText, { fontFamily: subtitleFont }]}>
                          Invitar
                        </Text>
                      </TouchableOpacity>

                      {/* Botón 3: Retar */}
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setSelectedFriendForChallenge(friend)}
                        style={[
                          styles.actionBtnRetar,
                          {
                            backgroundColor: '#EF4444',
                          },
                        ]}
                      >
                        <Ionicons name="flame" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={[styles.actionBtnRetarText, { fontFamily: subtitleFont }]}>
                          Retar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 2: DESCUBRIR Y BUSCAR AMIGOS EN BASE DE DATOS */}
          {activeTab === 'discover' && (
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionHeading, { color: palette.text, fontFamily: titleFont }]}>
                Atletas en la Base de Datos Evolve
              </Text>
              <Text style={[styles.sectionSubheading, { color: palette.textSub, fontFamily: bodyFont }]}>
                Busca usuarios por su ID único identificador (@nickname) y envíales solicitud de amistad.
              </Text>

              {filteredDiscover.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
                  <Ionicons name="search-outline" size={40} color={palette.textSub} style={{ opacity: 0.5 }} />
                  <Text style={[styles.emptyTitle, { color: palette.text, fontFamily: titleFont }]}>
                    No se encontraron atletas
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: palette.textSub, fontFamily: bodyFont }]}>
                    Prueba buscando por otro nombre o @nickname.
                  </Text>
                </View>
              ) : (
                filteredDiscover.map((user) => {
                  const isSent = pendingSentRequestUserIds.some(
                    (id) =>
                      id === user.id ||
                      id.toLowerCase() === user.nickname.toLowerCase() ||
                      id.toLowerCase() === user.nickname.replace('@', '').toLowerCase()
                  );
                  return (
                    <View
                      key={user.nickname}
                      style={[
                        styles.discoverCard,
                        {
                          backgroundColor: palette.cardBg,
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      <View style={styles.discoverLeft}>
                        <View style={[styles.friendAvatar, { backgroundColor: user.color }]}>
                          <Text style={styles.friendAvatarText}>{user.initials}</Text>
                        </View>
                        <View style={{ marginLeft: 10, flex: 1 }}>
                          <Text style={[styles.friendName, { color: palette.text, fontFamily: titleFont }]}>
                            {user.name}
                          </Text>
                          <Text style={[styles.friendNickBadge, { color: c2, fontFamily: subtitleFont }]}>
                            {user.nickname} · Nvl {user.level} ({user.rank})
                          </Text>
                          <Text style={[styles.userGoalSnippet, { color: palette.textSub, fontFamily: bodyFont }]} numberOfLines={1}>
                            🎯 {user.metrics?.activeGoal || 'Enfocado en hipertrofia y fuerza'}
                          </Text>
                        </View>
                      </View>

                      {/* Botón Enviar Solicitud */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={isSent}
                        onPress={() => handleSendRequest(user)}
                        style={[
                          styles.requestBtn,
                          isSent
                            ? { backgroundColor: palette.isDark ? '#334155' : '#E2E8F0', borderColor: 'transparent' }
                            : { backgroundColor: c2, borderColor: c2 },
                        ]}
                      >
                        <Ionicons
                          name={isSent ? 'time-outline' : 'person-add-outline'}
                          size={15}
                          color={isSent ? palette.textSub : '#FFFFFF'}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.requestBtnText,
                            {
                              color: isSent ? palette.textSub : '#FFFFFF',
                              fontFamily: subtitleFont,
                            },
                          ]}
                        >
                          {isSent ? 'Solicitud enviada' : 'Agregar'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>

        {/* ==========================================================
            POPUP 1: PERFIL DETALLADO Y COMPLETO DEL AMIGO (OBSERVAR)
            (Como el de uno mismo: Home, Entreno, Comida, Bienestar, Medidas)
        ========================================================== */}
        {selectedFriendForProfile && (
          <FriendProfileObserverModal
            visible={!!selectedFriendForProfile}
            friend={selectedFriendForProfile}
            onClose={() => setSelectedFriendForProfile(null)}
            onInvite={() => {
              const friendToInvite = selectedFriendForProfile;
              setSelectedFriendForProfile(null);
              setSelectedFriendForInvite(friendToInvite);
            }}
            c1={c1}
            c2={c2}
            palette={palette}
            titleFont={titleFont}
            subtitleFont={subtitleFont}
            bodyFont={bodyFont}
            dataFont={dataFont}
          />
        )}

        {/* ==========================================================
            POPUP 2: INVITAR A ENTRENAR (CON GRUPOS MUSCULARES Y SELECTOR DE HORA)
        ========================================================== */}
        {selectedFriendForInvite && (
          <InviteWorkoutModal
            visible={!!selectedFriendForInvite}
            friend={selectedFriendForInvite}
            onClose={() => setSelectedFriendForInvite(null)}
            onSend={(inviteData) => {
              sendWorkoutInvite(inviteData);
              setSelectedFriendForInvite(null);
              Alert.alert(
                '¡Invitación Enviada! 🚀',
                `Has invitado a ${selectedFriendForInvite.name} (${selectedFriendForInvite.nickname}) a entrenar ${inviteData.workoutType} el ${inviteData.date} a las ${inviteData.time}. Le llegará a sus notificaciones.`
              );
            }}
            c1={c1}
            c2={c2}
            palette={palette}
            titleFont={titleFont}
            subtitleFont={subtitleFont}
            bodyFont={bodyFont}
          />
        )}

        {/* ==========================================================
            POPUP 3: NOTIFICACIONES Y MENSAJES PENDIENTES
        ========================================================== */}
        {showNotificationsModal && (
          <NotificationsModal
            visible={showNotificationsModal}
            notifications={friendNotifications}
            onClose={() => setShowNotificationsModal(false)}
            onAcceptFriend={(notifId) => {
              acceptFriendRequest(notifId);
              syncSocialFromDatabase();
              Alert.alert('¡Nuevo Amigo Agregado! 🎉', 'Ahora son amigos. Puedes observar sus métricas e invitarlo a entrenar.');
            }}
            onRejectFriend={(notifId) => {
              rejectFriendRequest(notifId);
              syncSocialFromDatabase();
              Alert.alert('Solicitud Rechazada', 'Has rechazado la solicitud de amistad.');
            }}
            onAcceptWorkout={(notifId) => {
              respondWorkoutInvite(notifId, true);
              Alert.alert('¡Entrenamiento Aceptado! 🏋️‍♂️', 'La sesión conjunta quedó confirmada.');
            }}
            onRejectWorkout={(notifId) => respondWorkoutInvite(notifId, false)}
            onAcceptChallenge={(notifId) => {
              respondChallenge(notifId, true);
              Alert.alert('¡Reto Aceptado! ⚔️🔥', '¡Que empiece el duelo! Lo darás todo en el entrenamiento.');
            }}
            onRejectChallenge={(notifId) => respondChallenge(notifId, false)}
            onMarkAllAsRead={markNotificationsAsRead}
            c1={c1}
            c2={c2}
            palette={palette}
            titleFont={titleFont}
            subtitleFont={subtitleFont}
            bodyFont={bodyFont}
          />
        )}

        {/* ==========================================================
            POPUP 4: RETAR A UN AMIGO (FECHA, VARIABLE A MEDIR, MENSAJE)
        ========================================================== */}
        {selectedFriendForChallenge && (
          <ChallengeModal
            visible={!!selectedFriendForChallenge}
            friend={selectedFriendForChallenge}
            onClose={() => setSelectedFriendForChallenge(null)}
            onSend={(challengeData) => {
              sendChallenge(challengeData);
              setSelectedFriendForChallenge(null);
              Alert.alert(
                '¡Reto Enviado! ⚔️',
                `Has desafiado a ${challengeData.friendName} (${challengeData.friendNickname}) a competir en ${challengeData.details.variableLabel}. ¡Le llegará la notificación para aceptar el reto!`
              );
            }}
            c1={c1}
            c2={c2}
            palette={palette}
            titleFont={titleFont}
            subtitleFont={subtitleFont}
            bodyFont={bodyFont}
            dataFont={dataFont}
          />
        )}

        {/* ==========================================================
            POPUP 4: CONFIGURACIÓN DE PRIVACIDAD DE SECCIONES
        ========================================================== */}
        {showPrivacyModal && (
          <PrivacySettingsModal
            visible={showPrivacyModal}
            privacySettings={privacySettings}
            onUpdatePrivacy={(newSettings) => updatePrivacySettings(newSettings)}
            onClose={() => setShowPrivacyModal(false)}
            c1={c1}
            c2={c2}
            palette={palette}
            titleFont={titleFont}
            subtitleFont={subtitleFont}
            bodyFont={bodyFont}
          />
        )}

        {/* ==========================================================
            POPUP 5: MENÚ DE OPCIONES DEL AMIGO (ELIMINAR DE MIS AMIGOS)
        ========================================================== */}
        {friendForMenu && (
          <FriendOptionsActionModal
            visible={!!friendForMenu}
            friend={friendForMenu}
            onClose={() => setFriendForMenu(null)}
            onRemove={(friendToRemove) => {
              Alert.alert(
                '¿Eliminar de mis amigos? ⚠️',
                `¿Estás seguro de que deseas eliminar a ${friendToRemove.name} (${friendToRemove.nickname})? Dejarán de estar conectados y no verán su actividad compartida.`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Sí, eliminar',
                    style: 'destructive',
                    onPress: () => {
                      removeFriend(friendToRemove.id || friendToRemove.nickname);
                      setFriendForMenu(null);
                      syncSocialFromDatabase();
                      Alert.alert(
                        'Amigo eliminado 🗑️',
                        `${friendToRemove.name} ha sido eliminado de tu lista de amigos.`
                      );
                    },
                  },
                ]
              );
            }}
            palette={palette}
            titleFont={titleFont}
            subtitleFont={subtitleFont}
            bodyFont={bodyFont}
          />
        )}
      </View>
    </Modal>
  );
}

/* ==========================================================
   POPUP 1: OBSERVAR PERFIL COMPLETO (COMO EL DE UNO MISMO)
   VISTA DE MODO OBSERVADOR CON 5 SECCIONES Y PRIVACIDAD
========================================================== */
function FriendProfileObserverModal({
  visible,
  friend,
  onClose,
  onInvite,
  c1,
  c2,
  palette,
  titleFont,
  subtitleFont,
  bodyFont,
  dataFont,
}: {
  visible: boolean;
  friend: FriendUser;
  onClose: () => void;
  onInvite: () => void;
  c1: string;
  c2: string;
  palette: ColorPalette;
  titleFont?: string;
  subtitleFont?: string;
  bodyFont?: string;
  dataFont?: string;
}) {
  const profile = getFriendFullProfile(friend);
  const [activeProfileTab, setActiveProfileTab] = useState<
    'home' | 'workout' | 'food' | 'wellness' | 'measurements'
  >('home');

  const p = profile.privacy;
  const isSectionPublic = p[activeProfileTab];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.profileCardModal, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
          {/* Header con Indicador de Modo Observador y Avatar al lado izquierdo */}
          <View style={styles.profileHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              {friend.avatarUri ? (
                <Image
                  source={{ uri: friend.avatarUri }}
                  style={styles.observerHeaderAvatarImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.observerHeaderAvatarDot, { backgroundColor: friend.color }]}>
                  <Text style={styles.observerHeaderAvatarText}>{friend.initials}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.observerPill}>
                  <Ionicons name="eye" size={12} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.observerPillText}>MODO OBSERVADOR</Text>
                </View>
                <Text style={[styles.profileHeaderTitle, { color: palette.text, fontFamily: titleFont }]} numberOfLines={1}>
                  {friend.name}
                </Text>
                <Text style={[styles.friendNickBadge, { color: c1, fontFamily: subtitleFont }]}>
                  {friend.nickname}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn} hitSlop={10}>
              <Ionicons name="close" size={24} color={palette.textSub} />
            </TouchableOpacity>
          </View>

          {/* Banner de Personalización de Tema del Amigo */}
          <View style={[styles.themeBanner, { backgroundColor: palette.isDark ? '#0F172A' : '#F1F5F9', borderColor: palette.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="color-palette-outline" size={15} color={profile.customization.palette.primary} />
              <Text style={[styles.themeBannerTitle, { color: palette.text, fontFamily: subtitleFont }]}>
                Paleta: <Text style={{ color: profile.customization.palette.primary, fontWeight: '900' }}>{profile.customization.palette.name}</Text>
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={[styles.themeDot, { backgroundColor: profile.customization.palette.primary }]} />
              <View style={[styles.themeDot, { backgroundColor: profile.customization.palette.secondary }]} />
              <Text style={[styles.themeBannerSub, { color: palette.textSub, fontFamily: bodyFont }]}>
                Tipografía: {profile.customization.font}
              </Text>
            </View>
          </View>

          {/* Pestañas de Navegación de Perfil (Home, Entreno, Comida, Bienestar, Medidas) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.profileTabsScroll}
          >
            {[
              { key: 'home', label: 'Home', icon: 'home-outline' },
              { key: 'workout', label: 'Entreno', icon: 'barbell-outline' },
              { key: 'food', label: 'Comida', icon: 'restaurant-outline' },
              { key: 'wellness', label: 'Bienestar', icon: 'heart-outline' },
              { key: 'measurements', label: 'Medidas', icon: 'analytics-outline' },
            ].map((tab) => {
              const isActive = activeProfileTab === tab.key;
              const isLocked = !p[tab.key as keyof typeof p];
              return (
                <TouchableOpacity
                  key={tab.key}
                  activeOpacity={0.8}
                  onPress={() => setActiveProfileTab(tab.key as any)}
                  style={[
                    styles.profileTabBtn,
                    {
                      backgroundColor: isActive ? c1 : palette.isDark ? '#0F172A' : '#F1F5F9',
                      borderColor: isActive ? c1 : palette.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={isLocked ? 'lock-closed' : (tab.icon as any)}
                    size={14}
                    color={isActive ? '#FFFFFF' : isLocked ? '#EF4444' : palette.textSub}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      styles.profileTabBtnText,
                      {
                        color: isActive ? '#FFFFFF' : palette.text,
                        fontFamily: subtitleFont,
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* SI LA SECCIÓN ESTÁ BLOQUEADA POR PRIVACIDAD */}
            {!isSectionPublic ? (
              <View style={[styles.lockedSectionBox, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                <View style={styles.lockedIconCircle}>
                  <Ionicons name="lock-closed" size={32} color="#EF4444" />
                </View>
                <Text style={[styles.lockedTitle, { color: palette.text, fontFamily: titleFont }]}>
                  Sección Bloqueada / Privada
                </Text>
                <Text style={[styles.lockedDesc, { color: palette.textSub, fontFamily: bodyFont }]}>
                  {friend.nickname} ha decidido mantener la sección de{' '}
                  <Text style={{ fontWeight: '900', color: palette.text }}>
                    {activeProfileTab.toUpperCase()}
                  </Text>{' '}
                  como privada para amigos.
                </Text>
              </View>
            ) : (
              /* SECCIÓN PÚBLICA VISIBLE */
              <View>
                {/* 1. SECCIÓN HOME */}
                {activeProfileTab === 'home' && (
                  <View style={styles.tabContentWrap}>
                    {/* Tarjeta de Nivel y Racha */}
                    <LinearGradient
                      colors={[profile.customization.palette.primary, profile.customization.palette.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.profileSectionBanner}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={[styles.profileHeroName, { fontFamily: titleFont }]}>
                            Nivel {profile.home.level}
                          </Text>
                          <Text style={[styles.profileHeroNick, { fontFamily: subtitleFont }]}>
                            {profile.home.rank}
                          </Text>
                        </View>
                        <View style={styles.heroStreakPill}>
                          <Text style={styles.heroStreakPillText}>🔥 {profile.home.streak} días</Text>
                        </View>
                      </View>

                      {/* Barra de Progreso XP */}
                      <View style={{ marginTop: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Experiencia XP</Text>
                          <Text style={{ color: '#FDE047', fontSize: 11, fontWeight: '900' }}>
                            {profile.home.xp} / {profile.home.nextLevelXp} XP
                          </Text>
                        </View>
                        <View style={styles.xpBarTrack}>
                          <View
                            style={[
                              styles.xpBarFill,
                              { width: `${Math.round((profile.home.xp / profile.home.nextLevelXp) * 100)}%` },
                            ]}
                          />
                        </View>
                      </View>
                    </LinearGradient>

                    {/* Metas Activas y en Curso */}
                    <Text style={[styles.metricSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Metas Activas en Curso
                    </Text>
                    {profile.home.activeGoals.map((g) => (
                      <View
                        key={g.id}
                        style={[
                          styles.goalItemCard,
                          {
                            backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                            borderColor: palette.border,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={[styles.goalTitle, { color: palette.text, fontFamily: subtitleFont }]}>
                            🎯 {g.title}
                          </Text>
                          <Text style={[styles.goalPercent, { color: c1, fontFamily: dataFont }]}>
                            {g.progress}%
                          </Text>
                        </View>
                        <View style={styles.goalTrack}>
                          <View style={[styles.goalFill, { width: `${g.progress}%`, backgroundColor: c1 }]} />
                        </View>
                        <Text style={[styles.goalDate, { color: palette.textSub, fontFamily: bodyFont }]}>
                          Fecha límite: {g.targetDate} · {g.category}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* 2. SECCIÓN ENTRENO */}
                {activeProfileTab === 'workout' && (
                  <View style={styles.tabContentWrap}>
                    <View style={[styles.infoBannerBox, { backgroundColor: `${c1}15`, borderColor: `${c1}35` }]}>
                      <Ionicons name="barbell" size={18} color={c1} style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.infoBannerTitle, { color: c1, fontFamily: subtitleFont }]}>
                          División de Entrenamiento
                        </Text>
                        <Text style={[styles.infoBannerDesc, { color: palette.text, fontFamily: bodyFont }]}>
                          {profile.workout.division} ({profile.workout.weeklyFrequency} sesiones semanales)
                        </Text>
                      </View>
                    </View>

                    {/* Tabla de Récords Personales PRs */}
                    <Text style={[styles.metricSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Récords Personales (PRs)
                    </Text>
                    <View style={[styles.prsContainer, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                      {profile.workout.prs.map((pr, index) => (
                        <View
                          key={pr.exercise}
                          style={[
                            styles.prRow,
                            index > 0 && { borderTopWidth: 1, borderTopColor: palette.border },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.prExerciseName, { color: palette.text, fontFamily: subtitleFont }]}>
                              {pr.exercise}
                            </Text>
                            <Text style={[styles.prDate, { color: palette.textSub, fontFamily: bodyFont }]}>
                              {pr.date || 'Récord activo'}
                            </Text>
                          </View>
                          <View style={[styles.prWeightBadge, { backgroundColor: `${c1}20` }]}>
                            <Text style={[styles.prWeightText, { color: c1, fontFamily: dataFont }]}>
                              {pr.weight} kg
                            </Text>
                            {pr.reps && (
                              <Text style={[styles.prRepsText, { color: palette.textSub, fontFamily: bodyFont }]}>
                                x{pr.reps} reps
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>

                    {/* Entrenamientos Recientes */}
                    <Text style={[styles.metricSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Entrenamientos Recientes
                    </Text>
                    {profile.workout.recentWorkouts.map((w) => (
                      <View
                        key={w.id}
                        style={[
                          styles.workoutHistoryCard,
                          {
                            backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                            borderColor: palette.border,
                          },
                        ]}
                      >
                        <View style={styles.workoutHistoryHeader}>
                          <Text style={[styles.workoutHistoryTitle, { color: palette.text, fontFamily: subtitleFont }]}>
                            {w.title}
                          </Text>
                          <Text style={[styles.workoutHistoryDate, { color: palette.textSub, fontFamily: bodyFont }]}>
                            {w.date} · {w.durationMinutes} min
                          </Text>
                        </View>
                        <View style={styles.exerciseChipsRow}>
                          {w.exercises.map((ex) => (
                            <View key={ex} style={[styles.exerciseMiniChip, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
                              <Text style={[styles.exerciseMiniChipText, { color: palette.text, fontFamily: bodyFont }]}>
                                {ex}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* 3. SECCIÓN COMIDA / NUTRICIÓN */}
                {activeProfileTab === 'food' && (
                  <View style={styles.tabContentWrap}>
                    <View style={styles.metricsGrid}>
                      <View style={[styles.metricTile, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                        <Text style={styles.metricEmoji}>🔥</Text>
                        <Text style={[styles.metricValue, { color: palette.text, fontFamily: dataFont }]}>
                          {profile.food.targetCalories}
                        </Text>
                        <Text style={[styles.metricLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                          Calorías Meta / día
                        </Text>
                      </View>
                      <View style={[styles.metricTile, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                        <Text style={styles.metricEmoji}>💧</Text>
                        <Text style={[styles.metricValue, { color: palette.text, fontFamily: dataFont }]}>
                          {profile.food.waterLiters} L
                        </Text>
                        <Text style={[styles.metricLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                          Agua Diaria
                        </Text>
                      </View>
                    </View>

                    {/* Desglose de Macronutrientes */}
                    <Text style={[styles.metricSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Distribución de Macronutrientes
                    </Text>
                    <View style={[styles.macrosCard, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                      <View style={styles.macroRowItem}>
                        <Text style={[styles.macroLabel, { color: '#3B82F6', fontFamily: subtitleFont }]}>🥩 Proteínas</Text>
                        <Text style={[styles.macroVal, { color: palette.text, fontFamily: dataFont }]}>{profile.food.macros.protein}g</Text>
                      </View>
                      <View style={styles.macroRowItem}>
                        <Text style={[styles.macroLabel, { color: '#F59E0B', fontFamily: subtitleFont }]}>🍚 Carbohidratos</Text>
                        <Text style={[styles.macroVal, { color: palette.text, fontFamily: dataFont }]}>{profile.food.macros.carbs}g</Text>
                      </View>
                      <View style={styles.macroRowItem}>
                        <Text style={[styles.macroLabel, { color: '#EC4899', fontFamily: subtitleFont }]}>🥑 Grasas</Text>
                        <Text style={[styles.macroVal, { color: palette.text, fontFamily: dataFont }]}>{profile.food.macros.fat}g</Text>
                      </View>
                    </View>

                    {/* Comidas Registradas del Día */}
                    <Text style={[styles.metricSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Comidas Registradas del Día
                    </Text>
                    {profile.food.loggedMealsToday.map((m, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.mealLogRow,
                          {
                            backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                            borderColor: palette.border,
                          },
                        ]}
                      >
                        <Text style={[styles.mealLogTitle, { color: palette.text, fontFamily: subtitleFont }]}>
                          {m.name}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <Text style={[styles.mealLogVal, { color: c1, fontFamily: dataFont }]}>
                            {m.calories} kcal
                          </Text>
                          <Text style={[styles.mealLogVal, { color: '#3B82F6', fontFamily: dataFont }]}>
                            {m.protein}g P
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* 4. SECCIÓN BIENESTAR */}
                {activeProfileTab === 'wellness' && (
                  <View style={styles.tabContentWrap}>
                    <View style={styles.metricsGrid}>
                      <View style={[styles.metricTile, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                        <Text style={styles.metricEmoji}>🌙</Text>
                        <Text style={[styles.metricValue, { color: palette.text, fontFamily: dataFont }]}>
                          {profile.wellness.avgSleepHours} hrs
                        </Text>
                        <Text style={[styles.metricLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                          Sueño Promedio
                        </Text>
                      </View>
                      <View style={[styles.metricTile, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                        <Text style={styles.metricEmoji}>✨</Text>
                        <Text style={[styles.metricValue, { color: '#10B981', fontSize: 13, fontFamily: subtitleFont }]}>
                          Óptima
                        </Text>
                        <Text style={[styles.metricLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                          Calidad de Recuperación
                        </Text>
                      </View>
                    </View>

                    {/* Suplementos Activos */}
                    <Text style={[styles.metricSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Suplementación Diaria & Checklist
                    </Text>
                    {profile.wellness.activeSupplements.map((supp, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.suppCardRow,
                          {
                            backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                            borderColor: palette.border,
                          },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.suppName, { color: palette.text, fontFamily: subtitleFont }]}>
                            {supp.name}
                          </Text>
                          <Text style={[styles.suppDosage, { color: palette.textSub, fontFamily: bodyFont }]}>
                            Dosis: {supp.dosage}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.suppStatusBadge,
                            { backgroundColor: supp.takenToday ? '#10B98125' : '#EF444420' },
                          ]}
                        >
                          <Ionicons
                            name={supp.takenToday ? 'checkmark-circle' : 'time-outline'}
                            size={14}
                            color={supp.takenToday ? '#10B981' : '#EF4444'}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              styles.suppStatusText,
                              { color: supp.takenToday ? '#10B981' : '#EF4444', fontFamily: subtitleFont },
                            ]}
                          >
                            {supp.takenToday ? 'Tomado hoy' : 'Pendiente'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* 5. SECCIÓN MEDIDAS */}
                {activeProfileTab === 'measurements' && (
                  <View style={styles.tabContentWrap}>
                    <View style={styles.metricsGrid}>
                      <View style={[styles.metricTile, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                        <Text style={styles.metricEmoji}>⚖️</Text>
                        <Text style={[styles.metricValue, { color: palette.text, fontFamily: dataFont }]}>
                          {profile.measurements.currentWeight} kg
                        </Text>
                        <Text style={[styles.metricLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                          Peso Actual
                        </Text>
                      </View>
                      <View style={[styles.metricTile, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                        <Text style={styles.metricEmoji}>📉</Text>
                        <Text style={[styles.metricValue, { color: palette.text, fontFamily: dataFont }]}>
                          {profile.measurements.bodyFat}%
                        </Text>
                        <Text style={[styles.metricLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                          % Grasa Corporal
                        </Text>
                      </View>
                    </View>

                    {/* Evolución de Peso */}
                    <View style={[styles.weightProgressionBox, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                      <Text style={[styles.metricSectionTitle, { color: palette.text, fontFamily: titleFont, marginTop: 0 }]}>
                        Objetivo de Peso
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 6 }}>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={[styles.weightSubVal, { color: palette.textSub, fontFamily: bodyFont }]}>Inicio</Text>
                          <Text style={[styles.weightNum, { color: palette.text, fontFamily: dataFont }]}>{profile.measurements.startWeight} kg</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={18} color={c1} style={{ alignSelf: 'center' }} />
                        <View style={{ alignItems: 'center' }}>
                          <Text style={[styles.weightSubVal, { color: c1, fontFamily: subtitleFont }]}>Actual</Text>
                          <Text style={[styles.weightNum, { color: c1, fontFamily: dataFont }]}>{profile.measurements.currentWeight} kg</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={18} color={c2} style={{ alignSelf: 'center' }} />
                        <View style={{ alignItems: 'center' }}>
                          <Text style={[styles.weightSubVal, { color: palette.textSub, fontFamily: bodyFont }]}>Meta</Text>
                          <Text style={[styles.weightNum, { color: '#10B981', fontFamily: dataFont }]}>{profile.measurements.targetWeight} kg</Text>
                        </View>
                      </View>
                    </View>

                    {/* Medidas Corporales Musculares */}
                    <Text style={[styles.metricSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Medidas Corporales Registradas
                    </Text>
                    <View style={[styles.musclesBox, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                      {profile.measurements.muscles.map((item, idx) => (
                        <View
                          key={item.part}
                          style={[
                            styles.muscleRowItem,
                            idx > 0 && { borderTopWidth: 1, borderTopColor: palette.border },
                          ]}
                        >
                          <Text style={[styles.musclePartName, { color: palette.text, fontFamily: subtitleFont }]}>
                            {item.part}
                          </Text>
                          <Text style={[styles.musclePartCm, { color: c1, fontFamily: dataFont }]}>
                            {item.cm} cm
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Botón Acción: Invitar a entrenar desde el perfil observado */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onInvite}
              style={[styles.profileInviteBtn, { backgroundColor: c1 }]}
            >
              <Ionicons name="fitness-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={[styles.profileInviteBtnText, { fontFamily: subtitleFont }]}>
                Invitar a Entrenar a {friend.name.split(' ')[0]} ({friend.nickname})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

    </Modal>
  );
}

/* ==========================================================
   POPUP 2: FORMULARIO PARA INVITAR A ENTRENAR
   CON SELECTOR DE GRUPOS MUSCULARES (PESAS) Y SELECTOR DE HORA CON FLECHAS
========================================================== */
function InviteWorkoutModal({
  visible,
  friend,
  onClose,
  onSend,
  c1,
  c2,
  palette,
  titleFont,
  subtitleFont,
  bodyFont,
  dataFont,
}: {
  visible: boolean;
  friend: FriendUser;
  onClose: () => void;
  onSend: (data: {
    friendId: string;
    friendName: string;
    workoutType: string;
    date: string;
    time: string;
    location?: string;
    note?: string;
  }) => void;
  c1: string;
  c2: string;
  palette: ColorPalette;
  titleFont?: string;
  subtitleFont?: string;
  bodyFont?: string;
  dataFont?: string;
}) {
  const [selectedType, setSelectedType] = useState('Pesas / Fuerza');
  const [selectedDivision, setSelectedDivision] = useState(MUSCLE_DIVISIONS[0].label);
  const [customDivision, setCustomDivision] = useState('');
  const [selectedDate, setSelectedDate] = useState('Hoy');
  const [customDate, setCustomDate] = useState('');
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);

  // Estados interactivos para selector de hora con flechas
  const [hour, setHour] = useState(6);
  const [minute, setMinute] = useState(30);
  const [period, setPeriod] = useState<'AM' | 'PM'>('PM');

  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');

  // Controles de flechas para hora
  const incrementHour = () => setHour((prev) => (prev >= 12 ? 1 : prev + 1));
  const decrementHour = () => setHour((prev) => (prev <= 1 ? 12 : prev - 1));

  // Controles de flechas para minutos (paso de 5 min)
  const incrementMinute = () => setMinute((prev) => (prev >= 55 ? 0 : prev + 5));
  const decrementMinute = () => setMinute((prev) => (prev <= 0 ? 55 : prev - 5));

  const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;

  const handleSend = () => {
    const finalDate = customDate.trim() || selectedDate;
    const finalType =
      selectedType === 'Pesas / Fuerza'
        ? `Pesas (${customDivision.trim() || selectedDivision})`
        : selectedType;

    if (!finalDate) {
      Alert.alert('Falta la fecha', 'Por favor selecciona o ingresa la fecha para entrenar.');
      return;
    }

    onSend({
      friendId: friend.nickname,
      friendName: friend.name,
      workoutType: finalType,
      date: finalDate,
      time: formattedTime,
      location: location.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.inviteCardModal, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
          {/* Header */}
          <View style={styles.profileHeader}>
            <View>
              <Text style={[styles.profileHeaderTitle, { color: palette.text, fontFamily: titleFont }]}>
                Invitar a Entrenar
              </Text>
              <Text style={[styles.headerSubtitle, { color: palette.textSub, fontFamily: bodyFont }]}>
                Compañero: {friend.name} ({friend.nickname})
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn} hitSlop={10}>
              <Ionicons name="close" size={24} color={palette.textSub} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* 1. Tipo de Entrenamiento */}
            <Text style={[styles.formLabel, { color: palette.text, fontFamily: subtitleFont }]}>
              1. Tipo de Entrenamiento
            </Text>
            <View style={styles.chipsWrap}>
              {WORKOUT_TYPES.map((t) => {
                const isSelected = selectedType === t.label;
                return (
                  <TouchableOpacity
                    key={t.id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedType(t.label)}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: isSelected ? c1 : palette.isDark ? '#0F172A' : '#F1F5F9',
                        borderColor: isSelected ? c1 : palette.border,
                      },
                    ]}
                  >
                    <Text style={styles.choiceEmoji}>{t.emoji}</Text>
                    <Text
                      style={[
                        styles.choiceText,
                        {
                          color: isSelected ? '#FFFFFF' : palette.text,
                          fontFamily: subtitleFont,
                        },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* SI ES PESAS/FUERZA: SELECCIONAR GRUPOS MUSCULARES O DIVISIÓN */}
            {selectedType === 'Pesas / Fuerza' && (
              <View style={[styles.subOptionsContainer, { backgroundColor: `${c1}10`, borderColor: `${c1}30` }]}>
                <Text style={[styles.subOptionsTitle, { color: c1, fontFamily: subtitleFont }]}>
                  🏋️ Grupos Musculares / División a Entrenar:
                </Text>
                <View style={styles.chipsWrap}>
                  {MUSCLE_DIVISIONS.map((d) => {
                    const isDivSelected = selectedDivision === d.label && !customDivision;
                    return (
                      <TouchableOpacity
                        key={d.id}
                        activeOpacity={0.8}
                        onPress={() => {
                          setSelectedDivision(d.label);
                          setCustomDivision('');
                        }}
                        style={[
                          styles.choiceChip,
                          {
                            backgroundColor: isDivSelected ? c1 : palette.cardBg,
                            borderColor: isDivSelected ? c1 : palette.border,
                          },
                        ]}
                      >
                        <Text style={styles.choiceEmoji}>{d.emoji}</Text>
                        <Text
                          style={[
                            styles.choiceText,
                            {
                              color: isDivSelected ? '#FFFFFF' : palette.text,
                              fontFamily: subtitleFont,
                            },
                          ]}
                        >
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  value={customDivision}
                  onChangeText={setCustomDivision}
                  placeholder="O escribe grupos personalizados (ej. Bíceps y Abdomen)..."
                  placeholderTextColor={palette.textSub}
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: palette.cardBg,
                      color: palette.text,
                      borderColor: customDivision ? c1 : palette.border,
                      fontFamily: bodyFont,
                      marginTop: 4,
                    },
                  ]}
                />
              </View>
            )}

            {/* 2. Fecha */}
            <Text style={[styles.formLabel, { color: palette.text, fontFamily: subtitleFont }]}>
              2. Fecha de Entrenamiento
            </Text>
            <View style={styles.chipsWrap}>
              {QUICK_DATES.map((d) => {
                const isSelected = selectedDate === d && !customDate;
                return (
                  <TouchableOpacity
                    key={d}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedDate(d);
                      setCustomDate('');
                    }}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: isSelected ? c2 : palette.isDark ? '#0F172A' : '#F1F5F9',
                        borderColor: isSelected ? c2 : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        {
                          color: isSelected ? '#FFFFFF' : palette.text,
                          fontFamily: subtitleFont,
                        },
                      ]}
                    >
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Botón moderno de Calendario para escoger la fecha */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowCalendarPicker(true)}
              style={[
                styles.calendarDateCardBtn,
                {
                  backgroundColor: customDate ? `${c2}18` : (palette.isDark ? '#0F172A' : '#F8FAFC'),
                  borderColor: customDate ? c2 : palette.border,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View
                  style={[
                    styles.calendarIconCircle,
                    {
                      backgroundColor: customDate ? c2 : `${c2}22`,
                    },
                  ]}
                >
                  <Ionicons name="calendar" size={18} color={customDate ? '#FFFFFF' : c2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.calendarCardTitle, { color: palette.text, fontFamily: subtitleFont }]}>
                    {customDate ? `Fecha: ${customDate}` : 'Elegir fecha en Calendario'}
                  </Text>
                  <Text style={[styles.calendarCardSub, { color: palette.textSub, fontFamily: bodyFont }]}>
                    {customDate ? 'Día confirmado para entrenar' : 'Toca para abrir el calendario mensual'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={customDate ? c2 : palette.textSub} />
            </TouchableOpacity>

            {/* 3. Selector de Hora con Flechas e Inputs (Hora, Minutos, AM/PM) */}
            <Text style={[styles.formLabel, { color: palette.text, fontFamily: subtitleFont }]}>
              3. Hora de Encuentro (Mueve con flechas o ingresa valores)
            </Text>
            <View style={styles.timePickerContainer}>
              {/* Columna Horas */}
              <View style={styles.timeColumn}>
                <TouchableOpacity onPress={incrementHour} style={styles.arrowBtn} hitSlop={8}>
                  <Ionicons name="chevron-up" size={20} color={c1} />
                </TouchableOpacity>
                <TextInput
                  value={String(hour).padStart(2, '0')}
                  onChangeText={(val) => {
                    const num = parseInt(val, 10);
                    if (!isNaN(num) && num >= 1 && num <= 12) setHour(num);
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[styles.timeBoxInput, { color: palette.text, borderColor: palette.border, fontFamily: dataFont }]}
                />
                <TouchableOpacity onPress={decrementHour} style={styles.arrowBtn} hitSlop={8}>
                  <Ionicons name="chevron-down" size={20} color={c1} />
                </TouchableOpacity>
                <Text style={[styles.timeUnitLabel, { color: palette.textSub, fontFamily: bodyFont }]}>Hora</Text>
              </View>

              <Text style={[styles.timeSeparator, { color: palette.text, fontFamily: titleFont }]}>:</Text>

              {/* Columna Minutos */}
              <View style={styles.timeColumn}>
                <TouchableOpacity onPress={incrementMinute} style={styles.arrowBtn} hitSlop={8}>
                  <Ionicons name="chevron-up" size={20} color={c1} />
                </TouchableOpacity>
                <TextInput
                  value={String(minute).padStart(2, '0')}
                  onChangeText={(val) => {
                    const num = parseInt(val, 10);
                    if (!isNaN(num) && num >= 0 && num <= 59) setMinute(num);
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[styles.timeBoxInput, { color: palette.text, borderColor: palette.border, fontFamily: dataFont }]}
                />
                <TouchableOpacity onPress={decrementMinute} style={styles.arrowBtn} hitSlop={8}>
                  <Ionicons name="chevron-down" size={20} color={c1} />
                </TouchableOpacity>
                <Text style={[styles.timeUnitLabel, { color: palette.textSub, fontFamily: bodyFont }]}>Minutos</Text>
              </View>

              {/* Selector AM / PM */}
              <View style={styles.periodColumn}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setPeriod('AM')}
                  style={[
                    styles.periodBtn,
                    {
                      backgroundColor: period === 'AM' ? c1 : palette.cardBg,
                      borderColor: period === 'AM' ? c1 : palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.periodBtnText, { color: period === 'AM' ? '#FFFFFF' : palette.textSub, fontFamily: subtitleFont }]}>
                    AM
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setPeriod('PM')}
                  style={[
                    styles.periodBtn,
                    {
                      backgroundColor: period === 'PM' ? c1 : palette.cardBg,
                      borderColor: period === 'PM' ? c1 : palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.periodBtnText, { color: period === 'PM' ? '#FFFFFF' : palette.textSub, fontFamily: subtitleFont }]}>
                    PM
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 4. Lugar (Opcional) */}
            <Text style={[styles.formLabel, { color: palette.text, fontFamily: subtitleFont }]}>
              4. Lugar de Entrenamiento (Opcional)
            </Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Ej. Smart Fit Medellín, Zona de Peso Libre, Parque..."
              placeholderTextColor={palette.textSub}
              style={[
                styles.formInput,
                {
                  backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                  color: palette.text,
                  borderColor: palette.border,
                  fontFamily: bodyFont,
                },
              ]}
            />

            {/* 5. Mensaje o Nota (Opcional) */}
            <Text style={[styles.formLabel, { color: palette.text, fontFamily: subtitleFont }]}>
              5. Mensaje Motivacional (Opcional)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Ej. ¡Vamos con toda a romper PR de sentadillas!"
              placeholderTextColor={palette.textSub}
              style={[
                styles.formInput,
                {
                  backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                  color: palette.text,
                  borderColor: palette.border,
                  fontFamily: bodyFont,
                },
              ]}
            />

            {/* Botón Enviar Invitación */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSend}
              style={[styles.profileInviteBtn, { backgroundColor: c1, marginTop: 18 }]}
            >
              <Ionicons name="send" size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={[styles.profileInviteBtnText, { fontFamily: subtitleFont }]}>
                Enviar Invitación de Entreno
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Modal Selector de Calendario */}
      <CalendarDatePickerModal
        visible={showCalendarPicker}
        onClose={() => setShowCalendarPicker(false)}
        onSelectDate={(dateFormatted) => {
          setCustomDate(dateFormatted);
          setShowCalendarPicker(false);
        }}
        palette={palette}
        primaryColor={c2}
        titleFont={titleFont}
        subtitleFont={subtitleFont}
        bodyFont={bodyFont}
      />
    </Modal>
  );
}

/* ==========================================================
   POPUP 3: MENSAJES Y NOTIFICACIONES PENDIENTES
========================================================== */
/* ==========================================================
   COMPONENTE: SELECTOR DE FECHA EN CALENDARIO
========================================================== */
function CalendarDatePickerModal({
  visible,
  onClose,
  onSelectDate,
  palette,
  primaryColor,
  titleFont,
  subtitleFont,
  bodyFont,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
  palette: ColorPalette;
  primaryColor: string;
  titleFont?: string;
  subtitleFont?: string;
  bodyFont?: string;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysGrid: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) daysGrid.push(null);
  for (let d = 1; d <= daysInMonth; d++) daysGrid.push(d);

  const today = new Date();
  const isCurrentMonthToday = today.getFullYear() === year && today.getMonth() === month;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.calendarModalCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
          <View style={styles.calendarHeaderRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.calendarNavBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color={primaryColor} />
            </TouchableOpacity>
            <Text style={[styles.calendarMonthTitle, { color: palette.text, fontFamily: titleFont }]}>
              {monthNames[month]} {year}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={styles.calendarNavBtn} hitSlop={10}>
              <Ionicons name="chevron-forward" size={20} color={primaryColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.calendarDaysHeader}>
            {dayNames.map((d) => (
              <Text key={d} style={[styles.calendarDayHeaderCol, { color: palette.textSub, fontFamily: subtitleFont }]}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {daysGrid.map((day, idx) => {
              if (day === null) {
                return <View key={`empty-${idx}`} style={styles.calendarDayCell} />;
              }
              const isToday = isCurrentMonthToday && today.getDate() === day;
              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  activeOpacity={0.75}
                  onPress={() => {
                    const formatted = `${day} de ${monthNames[month]} ${year}`;
                    onSelectDate(formatted);
                    onClose();
                  }}
                  style={[
                    styles.calendarDayCell,
                    isToday && { backgroundColor: `${primaryColor}25`, borderColor: primaryColor, borderWidth: 1.5, borderRadius: 20 },
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDayNumber,
                      { color: isToday ? primaryColor : palette.text, fontFamily: isToday ? subtitleFont : bodyFont },
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onClose}
            style={[styles.calendarCancelBtn, { borderColor: palette.border }]}
          >
            <Text style={[styles.calendarCancelBtnText, { color: palette.textSub, fontFamily: subtitleFont }]}>
              Cerrar
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ==========================================================
   POPUP 4: MODAL PARA RETAR A UN AMIGO
========================================================== */
function ChallengeModal({
  visible,
  friend,
  onClose,
  onSend,
  c1,
  c2,
  palette,
  titleFont,
  subtitleFont,
  bodyFont,
  dataFont,
}: {
  visible: boolean;
  friend: FriendUser;
  onClose: () => void;
  onSend: (challengeData: {
    friendId: string;
    friendName: string;
    friendNickname: string;
    details: ChallengeDetails;
  }) => void;
  c1: string;
  c2: string;
  palette: ColorPalette;
  titleFont?: string;
  subtitleFont?: string;
  bodyFont?: string;
  dataFont?: string;
}) {
  const [selectedDate, setSelectedDate] = useState('Hoy');
  const [customDate, setCustomDate] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);

  const [selectedVariable, setSelectedVariable] = useState<ChallengeVariable>('strength');
  const [selectedMuscle, setSelectedMuscle] = useState('Pecho (Bench Press)');
  const [customMuscle, setCustomMuscle] = useState('');
  const [message, setMessage] = useState('');

  const CHALLENGE_VARIABLES: { id: ChallengeVariable; label: string; icon: string; desc: string }[] = [
    { id: 'calories', label: 'Calorías', icon: 'flame', desc: 'Compara calorías quemadas en la fecha' },
    { id: 'strength', label: 'Fuerza', icon: 'barbell', desc: 'Compara carga máxima o PR levantado por músculo' },
    { id: 'total_weight', label: 'Peso total levantado (volumen)', icon: 'speedometer', desc: 'Compara el volumen total acumulado (kg)' },
    { id: 'time_running', label: 'Tiempo (running/cardio)', icon: 'stopwatch', desc: 'Compara resistencia y duración de cardio/running' },
  ];

  const MUSCLE_CHOICES = [
    'Pecho (Bench Press)',
    'Espalda (Deadlift)',
    'Piernas (Sentadilla)',
    'Hombros (Press Militar)',
    'Brazos (Curl Bíceps / Tríceps)',
    'Dominadas (Pull-ups)',
    'Abdomen & Core',
  ];

  const handleSend = () => {
    const finalDate = customDate.trim() || selectedDate;
    if (!finalDate) {
      Alert.alert('Falta la fecha', 'Por favor selecciona la fecha del reto.');
      return;
    }
    const varItem = CHALLENGE_VARIABLES.find((v) => v.id === selectedVariable);
    onSend({
      friendId: friend.nickname,
      friendName: friend.name,
      friendNickname: friend.nickname,
      details: {
        targetDate: finalDate,
        variableType: selectedVariable,
        variableLabel: varItem?.label || 'Reto de Duelo',
        muscleOrExercise: (selectedVariable === 'strength' || selectedVariable === 'muscle_weight') ? (customMuscle.trim() || selectedMuscle) : undefined,
        message: message.trim() || undefined,
      },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.challengeCardModal, { backgroundColor: palette.cardBg, borderColor: '#EF4444' }]}>
          {/* Header */}
          <View style={styles.profileHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={[styles.observerHeaderAvatarDot, { backgroundColor: '#EF4444' }]}>
                <Ionicons name="flame" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileHeaderTitle, { color: palette.text, fontFamily: titleFont }]}>
                  Retar a {friend.name}
                </Text>
                <Text style={[styles.headerSubtitle, { color: '#EF4444', fontFamily: subtitleFont }]}>
                  {friend.nickname} · Duelo Atleta vs Atleta
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn} hitSlop={10}>
              <Ionicons name="close" size={24} color={palette.textSub} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* 1. Fecha del Reto */}
            <Text style={[styles.formLabel, { color: palette.text, fontFamily: subtitleFont }]}>
              1. Fecha de Reto
            </Text>
            <View style={styles.chipsWrap}>
              {['Hoy', 'Mañana', 'Fin de Semana', 'Próximo Lunes'].map((d) => {
                const isSelected = selectedDate === d && !customDate;
                return (
                  <TouchableOpacity
                    key={d}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedDate(d);
                      setCustomDate('');
                    }}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: isSelected ? '#EF4444' : palette.isDark ? '#0F172A' : '#F1F5F9',
                        borderColor: isSelected ? '#EF4444' : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        { color: isSelected ? '#FFFFFF' : palette.text, fontFamily: subtitleFont },
                      ]}
                    >
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Botón moderno de Calendario para escoger la fecha */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowCalendar(true)}
              style={[
                styles.calendarDateCardBtn,
                {
                  backgroundColor: customDate ? 'rgba(239, 68, 68, 0.15)' : (palette.isDark ? '#0F172A' : '#F8FAFC'),
                  borderColor: customDate ? '#EF4444' : palette.border,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View
                  style={[
                    styles.calendarIconCircle,
                    {
                      backgroundColor: customDate ? '#EF4444' : 'rgba(239, 68, 68, 0.18)',
                    },
                  ]}
                >
                  <Ionicons name="calendar" size={18} color={customDate ? '#FFFFFF' : '#EF4444'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.calendarCardTitle, { color: palette.text, fontFamily: subtitleFont }]}>
                    {customDate ? `Fecha: ${customDate}` : 'Elegir fecha en Calendario'}
                  </Text>
                  <Text style={[styles.calendarCardSub, { color: palette.textSub, fontFamily: bodyFont }]}>
                    {customDate ? 'Día pactado para el duelo' : 'Toca para abrir el calendario de retos'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={customDate ? '#EF4444' : palette.textSub} />
            </TouchableOpacity>

            {/* 2. Variable a Medir */}
            <Text style={[styles.formLabel, { color: palette.text, fontFamily: subtitleFont, marginTop: 14 }]}>
              2. Variable a Medir
            </Text>
            <View style={{ gap: 8 }}>
              {CHALLENGE_VARIABLES.map((v) => {
                const isSelected = selectedVariable === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedVariable(v.id);
                    }}
                    style={[
                      styles.choiceChip,
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        backgroundColor: isSelected ? '#EF4444' : palette.isDark ? '#0F172A' : '#F1F5F9',
                        borderColor: isSelected ? '#EF4444' : palette.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={v.icon as any}
                      size={20}
                      color={isSelected ? '#FFFFFF' : '#EF4444'}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.choiceText,
                          { color: isSelected ? '#FFFFFF' : palette.text, fontFamily: subtitleFont, fontSize: 14 },
                        ]}
                      >
                        {v.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: isSelected ? 'rgba(255,255,255,0.85)' : palette.textSub,
                          fontFamily: bodyFont,
                          marginTop: 1,
                        }}
                      >
                        {v.desc}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Sub-selector para fuerza por músculo */}
            {(selectedVariable === 'strength' || selectedVariable === 'muscle_weight') && (
              <View style={[styles.subOptionsContainer, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)', marginTop: 10 }]}>
                <Text style={[styles.subOptionsTitle, { color: '#EF4444', fontFamily: subtitleFont }]}>
                  🏋️ Selecciona el Músculo / Ejercicio a Retar:
                </Text>
                <View style={styles.chipsWrap}>
                  {MUSCLE_CHOICES.map((m) => {
                    const isMSelected = selectedMuscle === m && !customMuscle;
                    return (
                      <TouchableOpacity
                        key={m}
                        activeOpacity={0.8}
                        onPress={() => {
                          setSelectedMuscle(m);
                          setCustomMuscle('');
                        }}
                        style={[
                          styles.choiceChip,
                          {
                            backgroundColor: isMSelected ? '#EF4444' : palette.cardBg,
                            borderColor: isMSelected ? '#EF4444' : palette.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.choiceText,
                            { color: isMSelected ? '#FFFFFF' : palette.text, fontFamily: subtitleFont },
                          ]}
                        >
                          {m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  value={customMuscle}
                  onChangeText={setCustomMuscle}
                  placeholder="O escribe otro ejercicio/músculo..."
                  placeholderTextColor={palette.textSub}
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: palette.cardBg,
                      color: palette.text,
                      borderColor: customMuscle ? '#EF4444' : palette.border,
                      fontFamily: bodyFont,
                      marginTop: 6,
                    },
                  ]}
                />
              </View>
            )}

            {/* Banner Informativo de Duelo 1 vs 1 y XP */}
            <View style={[styles.duelInfoBanner, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)', marginTop: 14 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="trophy" size={17} color="#EF4444" />
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#EF4444', fontFamily: subtitleFont }}>
                  Duelo Cara a Cara (1 vs 1)
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: palette.text, fontFamily: bodyFont, lineHeight: 17 }}>
                El sistema comparará automáticamente las métricas de ambos atletas en la fecha elegida:{'\n'}
                • <Text style={{ color: '#10B981', fontWeight: '800' }}>Ganador: +50 XP</Text>{'\n'}
                • <Text style={{ color: '#EF4444', fontWeight: '800' }}>Perdedor: -25 XP</Text>
              </Text>
            </View>

            {/* 3. Mensaje Motivacional */}
            <Text style={[styles.formLabel, { color: palette.text, fontFamily: subtitleFont, marginTop: 14 }]}>
              3. Mensaje del Reto (Desafío cara a cara)
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Ej. ¡A ver si aguantas mi ritmo este fin de semana! No hay excusas..."
              placeholderTextColor={palette.textSub}
              multiline
              numberOfLines={3}
              style={[
                styles.formInput,
                {
                  backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                  color: palette.text,
                  borderColor: palette.border,
                  fontFamily: bodyFont,
                  minHeight: 65,
                },
              ]}
            />

            {/* Botón Enviar Reto */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSend}
              style={[
                styles.profileInviteBtn,
                {
                  backgroundColor: '#EF4444',
                  marginTop: 18,
                  shadowColor: '#EF4444',
                  shadowOpacity: 0.35,
                  shadowRadius: 8,
                },
              ]}
            >
              <Ionicons name="flame" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={[styles.profileInviteBtnText, { fontFamily: subtitleFont }]}>
                ⚔️ Enviar Reto Desafiante
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      <CalendarDatePickerModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelectDate={(d) => {
          setCustomDate(d);
          setShowCalendar(false);
        }}
        palette={palette}
        primaryColor="#EF4444"
        titleFont={titleFont}
        subtitleFont={subtitleFont}
        bodyFont={bodyFont}
      />
    </Modal>
  );
}

function NotificationsModal({
  visible,
  notifications,
  onClose,
  onAcceptFriend,
  onRejectFriend,
  onAcceptWorkout,
  onRejectWorkout,
  onAcceptChallenge,
  onRejectChallenge,
  onMarkAllAsRead,
  c1,
  c2,
  palette,
  titleFont,
  subtitleFont,
  bodyFont,
}: {
  visible: boolean;
  notifications: FriendNotification[];
  onClose: () => void;
  onAcceptFriend: (notifId: string) => void;
  onRejectFriend: (notifId: string) => void;
  onAcceptWorkout: (notifId: string) => void;
  onRejectWorkout: (notifId: string) => void;
  onAcceptChallenge: (notifId: string) => void;
  onRejectChallenge: (notifId: string) => void;
  onMarkAllAsRead: () => void;
  c1: string;
  c2: string;
  palette: ColorPalette;
  titleFont?: string;
  subtitleFont?: string;
  bodyFont?: string;
}) {
  const [activeTab, setActiveTab] = useState<'requests' | 'invites' | 'activity'>('requests');

  useEffect(() => {
    if (visible) {
      onMarkAllAsRead();
    }
  }, [visible]);

  const friendRequests = notifications.filter((n) => n.type === 'friend_request' && n.status === 'pending');
  const workoutInvites = notifications.filter((n) => n.type === 'workout_invite' && n.status === 'pending');
  const challenges = notifications.filter((n) => n.type === 'challenge' && n.status === 'pending');
  const activityUpdates = notifications.filter((n) => n.type === 'activity' || n.status !== 'pending');
  const unreadActivityCount = activityUpdates.filter((n) => !n.read).length;

  const totalPending = friendRequests.length + workoutInvites.length + challenges.length;
  const invitesCount = workoutInvites.length + challenges.length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.notificationsModalCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
          {/* Header */}
          <View style={styles.profileHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="notifications" size={20} color={c1} style={{ marginRight: 8 }} />
              <View>
                <Text style={[styles.profileHeaderTitle, { color: palette.text, fontFamily: titleFont }]}>
                  Notificaciones & Solicitudes
                </Text>
                <Text style={[styles.headerSubtitle, { color: palette.textSub, fontFamily: bodyFont }]}>
                  {totalPending > 0 ? `${totalPending} solicitudes pendientes` : 'Estás al día'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn} hitSlop={10}>
              <Ionicons name="close" size={24} color={palette.textSub} />
            </TouchableOpacity>
          </View>

          {/* Variant Button Triple: Solicitudes | Invitaciones | Actividad */}
          <View
            style={[
              styles.notifSegmentedWrap,
              {
                backgroundColor: palette.isDark ? '#0F172A' : '#F1F5F9',
                borderColor: palette.border,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab('requests')}
              style={[
                styles.notifSegmentBtn,
                activeTab === 'requests' && [styles.notifSegmentBtnActive, { backgroundColor: c1 }],
              ]}
            >
              <Text
                style={[
                  styles.notifSegmentBtnText,
                  {
                    color: activeTab === 'requests' ? '#FFFFFF' : palette.textSub,
                    fontFamily: subtitleFont,
                  },
                ]}
              >
                Solicitudes
              </Text>
              {friendRequests.length > 0 && (
                <View
                  style={[
                    styles.notifTabBadge,
                    {
                      backgroundColor: activeTab === 'requests' ? '#FFFFFF' : c1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.notifTabBadgeText,
                      { color: activeTab === 'requests' ? c1 : '#FFFFFF' },
                    ]}
                  >
                    {friendRequests.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab('invites')}
              style={[
                styles.notifSegmentBtn,
                activeTab === 'invites' && [styles.notifSegmentBtnActive, { backgroundColor: c1 }],
              ]}
            >
              <Text
                style={[
                  styles.notifSegmentBtnText,
                  {
                    color: activeTab === 'invites' ? '#FFFFFF' : palette.textSub,
                    fontFamily: subtitleFont,
                  },
                ]}
              >
                Invitaciones
              </Text>
              {invitesCount > 0 && (
                <View
                  style={[
                    styles.notifTabBadge,
                    {
                      backgroundColor: activeTab === 'invites' ? '#FFFFFF' : '#EF4444',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.notifTabBadgeText,
                      { color: activeTab === 'invites' ? '#EF4444' : '#FFFFFF' },
                    ]}
                  >
                    {invitesCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab('activity')}
              style={[
                styles.notifSegmentBtn,
                activeTab === 'activity' && [styles.notifSegmentBtnActive, { backgroundColor: c1 }],
              ]}
            >
              <Text
                style={[
                  styles.notifSegmentBtnText,
                  {
                    color: activeTab === 'activity' ? '#FFFFFF' : palette.textSub,
                    fontFamily: subtitleFont,
                  },
                ]}
              >
                Actividad
              </Text>
              {unreadActivityCount > 0 && (
                <View
                  style={[
                    styles.notifTabBadge,
                    {
                      backgroundColor: activeTab === 'activity' ? '#FFFFFF' : palette.textSub,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.notifTabBadgeText,
                      { color: activeTab === 'activity' ? palette.text : '#FFFFFF' },
                    ]}
                  >
                    {unreadActivityCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* PESTAÑA 1: SOLICITUDES DE AMISTAD */}
            {activeTab === 'requests' && (
              <View style={styles.notifSection}>
                {friendRequests.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: palette.cardBg, borderColor: palette.border, paddingVertical: 28 }]}>
                    <Ionicons name="people-outline" size={42} color={c1} />
                    <Text style={[styles.emptyTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Sin solicitudes de amistad
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: palette.textSub, fontFamily: bodyFont }]}>
                      No tienes solicitudes de amistad pendientes por responder.
                    </Text>
                  </View>
                ) : (
                  friendRequests.map((req) => (
                    <View
                      key={req.id}
                      style={[
                        styles.notifItemCard,
                        {
                          backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      <View style={styles.notifItemTop}>
                        <View style={[styles.friendAvatar, { backgroundColor: req.senderColor }]}>
                          <Text style={styles.friendAvatarText}>{req.senderInitials}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.friendName, { color: palette.text, fontFamily: titleFont }]}>
                            {req.senderName}
                          </Text>
                          <Text style={[styles.friendNickBadge, { color: c1, fontFamily: subtitleFont }]}>
                            {req.senderNickname} · Nvl {req.senderLevel} ({req.senderRank})
                          </Text>
                          <Text style={[styles.notifDateText, { color: palette.textSub, fontFamily: bodyFont }]}>
                            {req.date}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.notifMessageText, { color: palette.text, fontFamily: bodyFont }]}>
                        {req.message}
                      </Text>

                      {/* Botones Aceptar y Rechazar */}
                      <View style={styles.notifActionsRow}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => onRejectFriend(req.id)}
                          style={[styles.notifRejectBtn, { borderColor: palette.border }]}
                        >
                          <Ionicons name="close-circle-outline" size={16} color="#EF4444" style={{ marginRight: 4 }} />
                          <Text style={[styles.notifRejectBtnText, { fontFamily: subtitleFont }]}>Rechazar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => onAcceptFriend(req.id)}
                          style={[styles.notifAcceptBtn, { backgroundColor: '#10B981' }]}
                        >
                          <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={[styles.notifAcceptBtnText, { fontFamily: subtitleFont }]}>Aceptar Amistad</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* PESTAÑA 2: INVITACIONES A ENTRENAR Y RETOS */}
            {activeTab === 'invites' && (
              <View style={styles.notifSection}>
                {workoutInvites.length === 0 && challenges.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: palette.cardBg, borderColor: palette.border, paddingVertical: 28 }]}>
                    <Ionicons name="barbell-outline" size={42} color={c2} />
                    <Text style={[styles.emptyTitle, { color: palette.text, fontFamily: titleFont }]}>
                      Sin invitaciones ni retos
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: palette.textSub, fontFamily: bodyFont }]}>
                      No tienes invitaciones de entreno ni desafíos cara a cara pendientes.
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Invitaciones de Entrenamiento */}
                    {workoutInvites.map((inv) => (
                      <View
                        key={inv.id}
                        style={[
                          styles.notifItemCard,
                          {
                            backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                            borderColor: palette.border,
                            marginBottom: 10,
                          },
                        ]}
                      >
                        <View style={styles.notifItemTop}>
                          <View style={[styles.friendAvatar, { backgroundColor: inv.senderColor }]}>
                            <Text style={styles.friendAvatarText}>{inv.senderInitials}</Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[styles.friendName, { color: palette.text, fontFamily: titleFont }]}>
                              {inv.senderName}
                            </Text>
                            <Text style={[styles.friendNickBadge, { color: c2, fontFamily: subtitleFont }]}>
                              {inv.senderNickname} · {inv.date}
                            </Text>
                          </View>
                        </View>

                        {inv.workoutDetails && (
                          <View style={[styles.inviteDetailsBox, { backgroundColor: `${c1}12`, borderColor: `${c1}30` }]}>
                            <Text style={[styles.inviteDetailLine, { color: palette.text, fontFamily: subtitleFont }]}>
                              Modalidad: <Text style={{ color: c1, fontWeight: '900' }}>{inv.workoutDetails.workoutType}</Text>
                            </Text>
                            <Text style={[styles.inviteDetailLine, { color: palette.text, fontFamily: bodyFont }]}>
                              📅 Cuándo: {inv.workoutDetails.dateTime}
                            </Text>
                            {inv.workoutDetails.location && (
                              <Text style={[styles.inviteDetailLine, { color: palette.text, fontFamily: bodyFont }]}>
                                📍 Lugar: {inv.workoutDetails.location}
                              </Text>
                            )}
                            {inv.workoutDetails.note && (
                              <Text style={[styles.inviteDetailNote, { color: palette.textSub, fontFamily: bodyFont }]}>
                                "{inv.workoutDetails.note}"
                              </Text>
                            )}
                          </View>
                        )}

                        {/* Botones Aceptar y Rechazar */}
                        <View style={styles.notifActionsRow}>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => onRejectWorkout(inv.id)}
                            style={[styles.notifRejectBtn, { borderColor: palette.border }]}
                          >
                            <Ionicons name="close-circle-outline" size={16} color="#EF4444" style={{ marginRight: 4 }} />
                            <Text style={[styles.notifRejectBtnText, { fontFamily: subtitleFont }]}>Declinar</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => onAcceptWorkout(inv.id)}
                            style={[styles.notifAcceptBtn, { backgroundColor: c1 }]}
                          >
                            <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={[styles.notifAcceptBtnText, { fontFamily: subtitleFont }]}>Aceptar Entrenamiento</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    {/* Retos y Desafíos */}
                    {challenges.map((chal) => (
                      <View
                        key={chal.id}
                        style={[
                          styles.notifItemCard,
                          {
                            backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                            borderColor: '#EF4444',
                            borderWidth: 1.5,
                            marginBottom: 10,
                          },
                        ]}
                      >
                        <View style={styles.notifItemTop}>
                          <View style={[styles.friendAvatar, { backgroundColor: chal.senderColor }]}>
                            <Text style={styles.friendAvatarText}>{chal.senderInitials}</Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[styles.friendName, { color: palette.text, fontFamily: titleFont }]}>
                                {chal.senderName}
                              </Text>
                              <View style={styles.challengeBadge}>
                                <Text style={styles.challengeBadgeText}>⚔️ RETO</Text>
                              </View>
                            </View>
                            <Text style={[styles.friendNickBadge, { color: '#EF4444', fontFamily: subtitleFont }]}>
                              {chal.senderNickname} · {chal.date}
                            </Text>
                          </View>
                        </View>

                        {chal.challengeDetails && (
                          <View style={[styles.inviteDetailsBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                            <Text style={[styles.inviteDetailLine, { color: palette.text, fontFamily: subtitleFont }]}>
                              🎯 Variable a medir:{' '}
                              <Text style={{ color: '#EF4444', fontWeight: '900' }}>
                                {chal.challengeDetails.variableLabel}
                              </Text>
                            </Text>
                            {chal.challengeDetails.muscleOrExercise && (
                              <Text style={[styles.inviteDetailLine, { color: palette.text, fontFamily: bodyFont }]}>
                                🏋️ Músculo/Ejercicio: <Text style={{ fontWeight: '800' }}>{chal.challengeDetails.muscleOrExercise}</Text>
                              </Text>
                            )}
                            <Text style={[styles.inviteDetailLine, { color: palette.text, fontFamily: bodyFont }]}>
                              🗓️ Fecha del reto: {chal.challengeDetails.targetDate}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <Ionicons name="trophy-outline" size={14} color="#10B981" />
                              <Text style={{ fontSize: 11, color: '#10B981', fontFamily: subtitleFont }}>
                                Duelo 1 vs 1: +50 XP victoria / -25 XP derrota
                              </Text>
                            </View>
                            {(chal.challengeDetails.message || chal.message) && (
                              <Text style={[styles.inviteDetailNote, { color: palette.textSub, fontFamily: bodyFont, fontStyle: 'italic', marginTop: 4 }]}>
                                "{chal.challengeDetails.message || chal.message}"
                              </Text>
                            )}
                          </View>
                        )}

                        {/* Botones Aceptar y Rechazar Reto */}
                        <View style={styles.notifActionsRow}>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => onRejectChallenge(chal.id)}
                            style={[styles.notifRejectBtn, { borderColor: palette.border }]}
                          >
                            <Ionicons name="close-circle-outline" size={16} color="#EF4444" style={{ marginRight: 4 }} />
                            <Text style={[styles.notifRejectBtnText, { fontFamily: subtitleFont }]}>Declinar</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => onAcceptChallenge(chal.id)}
                            style={[styles.notifAcceptBtn, { backgroundColor: '#EF4444' }]}
                          >
                            <Ionicons name="flame" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={[styles.notifAcceptBtnText, { fontFamily: subtitleFont }]}>Aceptar Reto ⚔️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* PESTAÑA 3: ACTIVIDAD DE LA COMUNIDAD */}
            {activeTab === 'activity' && (
              <View style={styles.notifSection}>
                {activityUpdates.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: palette.cardBg, borderColor: palette.border, paddingVertical: 28 }]}>
                    <Ionicons name="checkmark-done-circle-outline" size={42} color="#10B981" />
                    <Text style={[styles.emptyTitle, { color: palette.text, fontFamily: titleFont }]}>
                      ¡Todo al día!
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: palette.textSub, fontFamily: bodyFont }]}>
                      No hay actividad reciente en la comunidad por el momento.
                    </Text>
                  </View>
                ) : (
                  activityUpdates.map((act) => (
                    <View
                      key={act.id}
                      style={[
                        styles.activityItemRow,
                        {
                          backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      <View style={[styles.activityDotIcon, { backgroundColor: `${c2}20` }]}>
                        <Ionicons name="flame" size={16} color={c2} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.activityMessageText, { color: palette.text, fontFamily: bodyFont }]}>
                          {act.message}
                        </Text>
                        <Text style={[styles.notifDateText, { color: palette.textSub, fontFamily: bodyFont }]}>
                          {act.date}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}


          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ==========================================================
   POPUP 4: CONFIGURACIÓN DE PRIVACIDAD DE SECCIONES PARA AMIGOS
   (Home, Entreno, Comida, Bienestar, Medidas)
========================================================== */
function PrivacySettingsModal({
  visible,
  privacySettings,
  onUpdatePrivacy,
  onClose,
  c1,
  c2,
  palette,
  titleFont,
  subtitleFont,
  bodyFont,
}: {
  visible: boolean;
  privacySettings: SectionPrivacySettings;
  onUpdatePrivacy: (settings: Partial<SectionPrivacySettings>) => void;
  onClose: () => void;
  c1: string;
  c2: string;
  palette: ColorPalette;
  titleFont?: string;
  subtitleFont?: string;
  bodyFont?: string;
}) {
  const sections = [
    {
      key: 'home' as const,
      name: 'Home',
      icon: 'home-outline',
      desc: 'Nivel, XP y progreso de tus metas activas y completadas.',
    },
    {
      key: 'workout' as const,
      name: 'Entreno',
      icon: 'barbell-outline',
      desc: 'Tus récords personales (PRs), rutinas y sesiones recientes.',
    },
    {
      key: 'food' as const,
      name: 'Comida',
      icon: 'restaurant-outline',
      desc: 'Calorías diarias meta, macronutrientes y comidas registradas.',
    },
    {
      key: 'wellness' as const,
      name: 'Bienestar',
      icon: 'heart-outline',
      desc: 'Horas de sueño, recuperación y checklist de suplementos.',
    },
    {
      key: 'measurements' as const,
      name: 'Medidas',
      icon: 'analytics-outline',
      desc: 'Evolución de peso corporal, % grasa y medidas musculares.',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.privacyModalCard, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
          <View style={styles.profileHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="shield-checkmark" size={22} color={c1} style={{ marginRight: 8 }} />
              <View>
                <Text style={[styles.profileHeaderTitle, { color: palette.text, fontFamily: titleFont }]}>
                  Privacidad de tu Perfil
                </Text>
                <Text style={[styles.headerSubtitle, { color: palette.textSub, fontFamily: bodyFont }]}>
                  Controla qué pueden observar tus amigos
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn} hitSlop={10}>
              <Ionicons name="close" size={24} color={palette.textSub} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.privacyIntroText, { color: palette.textSub, fontFamily: bodyFont }]}>
            Elige qué secciones de tu perfil son públicas para tus amigos y cuáles prefieres mantener bloqueadas con candado para que solo las veas tú.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
            {sections.map((sec) => {
              const isPublic = privacySettings[sec.key];
              return (
                <View
                  key={sec.key}
                  style={[
                    styles.privacyRowItem,
                    {
                      backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <View style={[styles.privacyIconWrap, { backgroundColor: isPublic ? `${c1}20` : '#EF444420' }]}>
                    <Ionicons
                      name={isPublic ? (sec.icon as any) : 'lock-closed'}
                      size={18}
                      color={isPublic ? c1 : '#EF4444'}
                    />
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.privacySecName, { color: palette.text, fontFamily: subtitleFont }]}>
                        {sec.name}
                      </Text>
                      <View
                        style={[
                          styles.privacyStatusTag,
                          { backgroundColor: isPublic ? '#10B98125' : '#EF444425' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.privacyStatusTagText,
                            { color: isPublic ? '#10B981' : '#EF4444', fontFamily: subtitleFont },
                          ]}
                        >
                          {isPublic ? 'Público' : 'Bloqueado (Solo tú)'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.privacySecDesc, { color: palette.textSub, fontFamily: bodyFont }]}>
                      {sec.desc}
                    </Text>
                  </View>
                  <Switch
                    value={isPublic}
                    onValueChange={(val) => onUpdatePrivacy({ [sec.key]: val })}
                    trackColor={{ false: '#334155', true: c1 }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              );
            })}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                onClose();
                Alert.alert('¡Ajustes Guardados! 🛡️', 'Tu configuración de privacidad se ha actualizado correctamente.');
              }}
              style={[styles.profileInviteBtn, { backgroundColor: c1, marginTop: 14 }]}
            >
              <Ionicons name="checkmark-done" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={[styles.profileInviteBtnText, { fontFamily: subtitleFont }]}>
                Guardar Ajustes de Privacidad
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ==========================================================
   POPUP 5: ACCIONES Y OPCIONES DE AMIGO (ELIMINAR DE MIS AMIGOS)
========================================================== */
function FriendOptionsActionModal({
  visible,
  friend,
  onClose,
  onRemove,
  palette,
  titleFont,
  subtitleFont,
  bodyFont,
}: {
  visible: boolean;
  friend: FriendUser;
  onClose: () => void;
  onRemove: (friend: FriendUser) => void;
  palette: any;
  titleFont?: string;
  subtitleFont?: string;
  bodyFont?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.actionModalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.actionModalSheet,
            {
              backgroundColor: palette.cardBg,
              borderColor: palette.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.actionModalHandleBar} />

          {/* Amigo Info Header */}
          <View style={styles.actionModalHeader}>
            <View style={[styles.friendAvatar, { backgroundColor: friend.color, width: 44, height: 44, borderRadius: 22 }]}>
              <Text style={[styles.friendAvatarText, { fontSize: 15 }]}>{friend.initials}</Text>
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[styles.actionModalName, { color: palette.text, fontFamily: titleFont }]} numberOfLines={1}>
                {friend.name}
              </Text>
              <Text style={[styles.actionModalNick, { color: palette.textSub, fontFamily: subtitleFont }]} numberOfLines={1}>
                {friend.nickname} · Nvl {friend.level} ({friend.rank})
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.actionModalCloseBtn}>
              <Ionicons name="close" size={20} color={palette.textSub} />
            </TouchableOpacity>
          </View>

          <View style={[styles.actionModalDivider, { backgroundColor: palette.border }]} />

          {/* Opciones */}
          <View style={styles.actionModalOptionsList}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onRemove(friend)}
              style={[
                styles.actionModalOptionItem,
                {
                  backgroundColor: palette.isDark ? '#EF444415' : '#FEF2F2',
                  borderColor: '#EF444430',
                },
              ]}
            >
              <View style={[styles.actionModalOptionIconCircle, { backgroundColor: '#EF444420' }]}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.actionModalOptionTitle, { color: '#EF4444', fontFamily: titleFont }]}>
                  Eliminar de mis amigos
                </Text>
                <Text style={[styles.actionModalOptionSub, { color: palette.textSub, fontFamily: bodyFont }]}>
                  Dejarán de estar conectados y no verán su actividad compartida.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* Botón Cancelar */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onClose}
            style={[
              styles.actionModalCancelBtn,
              {
                backgroundColor: palette.isDark ? '#1E293B' : '#F1F5F9',
                borderColor: palette.border,
              },
            ]}
          >
            <Text style={[styles.actionModalCancelText, { color: palette.text, fontFamily: subtitleFont }]}>
              Cancelar
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/* ==========================================================
   ESTILOS GENERALES
========================================================== */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  headerSubtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  iconBtnHeader: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },

  // Hero Card
  heroCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  heroStatItem: {
    alignItems: 'center',
  },
  heroStatNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroStatLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    fontWeight: '700',
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },

  // Search Bar
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },

  // Tabs
  tabSelectorRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabBtnActive: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },

  // Section
  sectionWrap: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 14.5,
    fontWeight: '900',
    marginBottom: 2,
  },
  sectionSubheading: {
    fontSize: 11.5,
    marginBottom: 10,
  },

  // Friend Card
  friendCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  friendCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  friendIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  friendAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  activeDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  friendName: {
    fontSize: 14,
    fontWeight: '900',
  },
  friendNickBadge: {
    fontSize: 11.5,
    fontWeight: '800',
    marginTop: 1,
  },
  streakPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  streakPillText: {
    color: '#D97706',
    fontSize: 11,
    fontWeight: '900',
  },
  friendCardMid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  levelTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  levelTagText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  todayWorkoutText: {
    fontSize: 11.5,
    flex: 1,
  },
  friendActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtnObservar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
  },
  actionBtnObservarText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtnInvitar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 11,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnInvitarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  actionBtnRetar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 11,
    shadowColor: '#EF4444',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnRetarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  // Header Avatar in Observer Mode
  observerHeaderAvatarDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  observerHeaderAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  observerHeaderAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },

  // Calendar Picker Modal Styles
  calendarModalCard: {
    width: '90%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  calendarNavBtn: {
    padding: 6,
    borderRadius: 8,
  },
  calendarMonthTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  calendarDaysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  calendarDayHeaderCol: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calendarDayCell: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  calendarDayNumber: {
    fontSize: 13,
  },
  calendarCancelBtn: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  calendarCancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  calendarPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginVertical: 8,
  },
  calendarPickerBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  calendarDateCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginVertical: 8,
  },
  calendarIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  calendarCardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  duelInfoBanner: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 6,
  },

  // Challenge Modal Styles
  challengeCardModal: {
    width: '100%',
    maxHeight: '88%',
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  challengeBadge: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  challengeBadgeText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '900',
  },

  // Discover Card
  discoverCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  discoverLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userGoalSnippet: {
    fontSize: 10.5,
    marginTop: 2,
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginLeft: 8,
  },
  requestBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
  },

  // Empty Box
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
    marginTop: 14,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  // Modal Backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'flex-end',
  },

  // Profile Observer Modal
  profileCardModal: {
    maxHeight: '92%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  profileHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  observerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98120',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  observerPillText: {
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  closeIconBtn: {
    padding: 4,
  },
  themeBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  themeBannerTitle: {
    fontSize: 11.5,
  },
  themeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  themeBannerSub: {
    fontSize: 10.5,
    marginLeft: 4,
  },
  profileTabsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 10,
  },
  profileTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  profileTabBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  tabContentWrap: {
    marginTop: 6,
  },
  profileSectionBanner: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  profileHeroName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  profileHeroNick: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 1,
  },
  heroStreakPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  heroStreakPillText: {
    color: '#FDE047',
    fontSize: 12,
    fontWeight: '900',
  },
  xpBarTrack: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#FDE047',
    borderRadius: 3.5,
  },
  goalItemCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    flex: 1,
  },
  goalPercent: {
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 6,
  },
  goalTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
    marginVertical: 8,
  },
  goalFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalDate: {
    fontSize: 10.5,
  },
  infoBannerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  infoBannerTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  infoBannerDesc: {
    fontSize: 12,
    marginTop: 1,
  },
  metricSectionTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    marginTop: 10,
    marginBottom: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  metricTile: {
    width: '48.5%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
  },
  metricEmoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 10.5,
    marginTop: 1,
  },
  prsContainer: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  prExerciseName: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  prDate: {
    fontSize: 10.5,
    marginTop: 1,
  },
  prWeightBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  prWeightText: {
    fontSize: 13,
    fontWeight: '900',
  },
  prRepsText: {
    fontSize: 9.5,
  },
  workoutHistoryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  workoutHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  workoutHistoryTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  workoutHistoryDate: {
    fontSize: 10.5,
  },
  exerciseChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  exerciseMiniChip: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  exerciseMiniChipText: {
    fontSize: 10,
  },
  macrosCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  macroRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroLabel: {
    fontSize: 12.5,
  },
  macroVal: {
    fontSize: 13,
    fontWeight: '900',
  },
  mealLogRow: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mealLogTitle: {
    fontSize: 12,
    flex: 1,
  },
  mealLogVal: {
    fontSize: 11.5,
  },
  suppCardRow: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  suppName: {
    fontSize: 12,
    fontWeight: '800',
  },
  suppDosage: {
    fontSize: 10.5,
    marginTop: 1,
  },
  suppStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  suppStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  weightProgressionBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  weightSubVal: {
    fontSize: 10.5,
  },
  weightNum: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  musclesBox: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  muscleRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  musclePartName: {
    fontSize: 12,
  },
  musclePartCm: {
    fontSize: 12.5,
    fontWeight: '900',
  },

  // Locked Section Style
  lockedSectionBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
  },
  lockedIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF444415',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  lockedTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  lockedDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 14,
  },

  profileInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  profileInviteBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '900',
  },

  // Invite Modal
  inviteCardModal: {
    maxHeight: '92%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  formLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 6,
  },
  choiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  choiceEmoji: {
    fontSize: 14,
    marginRight: 5,
  },
  choiceText: {
    fontSize: 11.5,
  },
  subOptionsContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  subOptionsTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  formInput: {
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 9 : 6,
    fontSize: 12,
    marginBottom: 6,
  },

  // Time Picker Stepper with Arrows
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
    marginBottom: 6,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  timeColumn: {
    alignItems: 'center',
  },
  arrowBtn: {
    padding: 4,
  },
  timeBoxInput: {
    width: 44,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '900',
  },
  timeUnitLabel: {
    fontSize: 9.5,
    marginTop: 2,
  },
  timeSeparator: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 14,
  },
  periodColumn: {
    gap: 6,
    marginLeft: 6,
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  periodBtnText: {
    fontSize: 11.5,
    fontWeight: '900',
  },

  // Notifications Modal
  notifSegmentedWrap: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    marginBottom: 14,
  },
  notifSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 11,
    gap: 5,
  },
  notifSegmentBtnActive: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  notifSegmentBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  notifTabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTabBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  notificationsModalCard: {
    maxHeight: '88%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  notifSection: {
    marginBottom: 16,
  },
  notifSectionHeader: {
    marginBottom: 8,
  },
  notifSectionTitle: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  notifItemCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  notifItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  notifDateText: {
    fontSize: 10,
    marginTop: 1,
  },
  notifMessageText: {
    fontSize: 12,
    marginBottom: 10,
  },
  notifActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  notifRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  notifRejectBtnText: {
    color: '#EF4444',
    fontSize: 11.5,
    fontWeight: '800',
  },
  notifAcceptBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 9,
  },
  notifAcceptBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
  },
  inviteDetailsBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    gap: 3,
  },
  inviteDetailLine: {
    fontSize: 11.5,
  },
  inviteDetailNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  activityItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
  },
  activityDotIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityMessageText: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  markReadBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  markReadBtnText: {
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },

  // Privacy Settings Modal
  privacyModalCard: {
    maxHeight: '88%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  privacyIntroText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  privacyRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  privacyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacySecName: {
    fontSize: 13,
    fontWeight: '900',
  },
  privacyStatusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  privacyStatusTagText: {
    fontSize: 9.5,
    fontWeight: '900',
  },
  privacySecDesc: {
    fontSize: 10.5,
    marginTop: 2,
  },

  // 3-Dots Friend Options Menu & Action Sheet
  friendMenuBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  actionModalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  actionModalHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(156, 163, 175, 0.4)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  actionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionModalName: {
    fontSize: 16,
    fontWeight: '800',
  },
  actionModalNick: {
    fontSize: 12.5,
    marginTop: 2,
  },
  actionModalCloseBtn: {
    padding: 6,
  },
  actionModalDivider: {
    height: 1,
    marginVertical: 14,
  },
  actionModalOptionsList: {
    gap: 10,
    marginBottom: 14,
  },
  actionModalOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionModalOptionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionModalOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  actionModalOptionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  actionModalCancelBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionModalCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
