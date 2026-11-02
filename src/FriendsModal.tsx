import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useStore,
  FriendUser,
  FriendNotification,
  ColorPalette,
  DISCOVERABLE_USERS,
} from './store';

/* ==========================================================
   TIPOS DE ENTRENAMIENTO PARA INVITACIÓN
========================================================== */
const WORKOUT_TYPES = [
  { id: 'weights', label: 'Pesas / Fuerza', icon: 'barbell-outline', emoji: '🏋️‍♂️' },
  { id: 'cardio', label: 'Cardio / Running', icon: 'walk-outline', emoji: '🏃' },
  { id: 'calisthenics', label: 'Calistenia', icon: 'body-outline', emoji: '🤸' },
  { id: 'sport', label: 'Deporte (Basket/Fútbol/Pádel)', icon: 'basketball-outline', emoji: '🏀' },
  { id: 'crossfit', label: 'CrossFit / Funcional', icon: 'flash-outline', emoji: '⚡' },
];

const QUICK_DATES = ['Hoy', 'Mañana', 'Sábado', 'Domingo'];
const QUICK_TIMES = ['06:30 AM', '08:00 AM', '05:00 PM', '06:30 PM', '07:30 PM'];

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
  const sendWorkoutInvite = useStore((s) => s.sendWorkoutInvite);
  const acceptFriendRequest = useStore((s) => s.acceptFriendRequest);
  const rejectFriendRequest = useStore((s) => s.rejectFriendRequest);
  const respondWorkoutInvite = useStore((s) => s.respondWorkoutInvite);
  const markNotificationsAsRead = useStore((s) => s.markNotificationsAsRead);
  const sendFriendRequestTo = useStore((s) => s.sendFriendRequestTo);

  // Estados locales
  const [activeTab, setActiveTab] = useState<'friends' | 'discover'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [selectedFriendForProfile, setSelectedFriendForProfile] = useState<FriendUser | null>(null);
  const [selectedFriendForInvite, setSelectedFriendForInvite] = useState<FriendUser | null>(null);
  const [sentRequests, setSentRequests] = useState<Record<string, boolean>>({});

  // Contador de notificaciones no leídas y pendientes
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

  // Filtrado de usuarios para descubrir
  const friendIds = new Set(friends.map((f) => f.id));
  const filteredDiscover = DISCOVERABLE_USERS.filter((u) => {
    if (friendIds.has(u.id)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.nickname.toLowerCase().includes(q);
  });

  // Estadísticas rápidas
  const highestStreak = friends.length > 0 ? Math.max(...friends.map((f) => f.streak)) : 0;
  const activeTodayCount = friends.filter((f) => f.todayWorkout && !f.todayWorkout.includes('Descanso')).length;

  // Enviar solicitud a usuario desconocido
  const handleSendRequest = (user: FriendUser) => {
    sendFriendRequestTo(user);
    setSentRequests((prev) => ({ ...prev, [user.id]: true }));
    Alert.alert(
      '¡Solicitud Enviada! 🤝',
      `Le hemos enviado una solicitud de amistad a ${user.name} (${user.nickname}). Podrán ver sus métricas e invitarse a entrenar una vez la acepte.`
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        {/* Cabecera Superior */}
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

          {/* Icono de Notificaciones con Badge */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowNotificationsModal(true)}
            style={[styles.notifBtn, { borderColor: palette.border, backgroundColor: palette.isDark ? '#1E293B' : '#F1F5F9' }]}
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

          {/* Barra de Búsqueda */}
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
              placeholder={activeTab === 'friends' ? 'Buscar entre tus amigos...' : 'Buscar nuevos atletas por nombre o @apodo...'}
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
                      ? 'No hay amigos que coincidan con la búsqueda.'
                      : '¡Añade amigos para ver sus métricas y retarlos a entrenar juntos!'}
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
                    key={friend.id}
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
                          <Text style={[styles.friendNick, { color: palette.textSub, fontFamily: bodyFont }]}>
                            {friend.nickname}
                          </Text>
                        </View>
                      </View>

                      {/* Pill de Racha */}
                      <View style={[styles.streakPill, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                        <Text style={styles.streakPillText}>🔥 {friend.streak}d</Text>
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

                    {/* Fila Inferior: BOTONES OBSERVAR E INVITAR A ENTRENAR */}
                    <View style={styles.friendActionsRow}>
                      {/* Botón 1: Observar (Ver Métricas) */}
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
                        <Ionicons name="eye-outline" size={17} color={c1} style={{ marginRight: 6 }} />
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
                        <Ionicons name="fitness-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={[styles.actionBtnInvitarText, { fontFamily: subtitleFont }]}>
                          Invitar a Entrenar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 2: DESCUBRIR Y BUSCAR AMIGOS */}
          {activeTab === 'discover' && (
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionHeading, { color: palette.text, fontFamily: titleFont }]}>
                Atletas en la Comunidad Evolve
              </Text>
              <Text style={[styles.sectionSubheading, { color: palette.textSub, fontFamily: bodyFont }]}>
                Envía una solicitud de amistad para compartir entrenamientos, marcas y récords.
              </Text>

              {filteredDiscover.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
                  <Ionicons name="search-outline" size={40} color={palette.textSub} style={{ opacity: 0.5 }} />
                  <Text style={[styles.emptyTitle, { color: palette.text, fontFamily: titleFont }]}>
                    No se encontraron nuevos atletas
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: palette.textSub, fontFamily: bodyFont }]}>
                    Prueba buscando por otro nombre o apodo.
                  </Text>
                </View>
              ) : (
                filteredDiscover.map((user) => {
                  const isSent = !!sentRequests[user.id];
                  return (
                    <View
                      key={user.id}
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
                          <Text style={[styles.friendNick, { color: palette.textSub, fontFamily: bodyFont }]}>
                            {user.nickname} · Nvl {user.level} ({user.rank})
                          </Text>
                          <Text style={[styles.userGoalSnippet, { color: c2, fontFamily: bodyFont }]} numberOfLines={1}>
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
                          name={isSent ? 'checkmark-circle' : 'person-add-outline'}
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
                          {isSent ? 'Enviada' : 'Agregar'}
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
            POPUP 1: PERFIL DETALLADO DEL AMIGO (OBSERVAR MÉTRICAS)
        ========================================================== */}
        {selectedFriendForProfile && (
          <FriendProfileModal
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
            POPUP 2: INVITAR A ENTRENAR
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
                `Has invitado a ${selectedFriendForInvite.name} a entrenar ${inviteData.workoutType} el ${inviteData.date} a las ${inviteData.time}. Le llegará a sus notificaciones.`
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
              Alert.alert('¡Nuevo Amigo Agregado! 🎉', 'Ahora son amigos. Puedes observar sus métricas e invitarlo a entrenar.');
            }}
            onRejectFriend={(notifId) => rejectFriendRequest(notifId)}
            onAcceptWorkout={(notifId) => {
              respondWorkoutInvite(notifId, true);
              Alert.alert('¡Entrenamiento Aceptado! 🏋️‍♂️', 'La sesión conjunta quedó confirmada.');
            }}
            onRejectWorkout={(notifId) => respondWorkoutInvite(notifId, false)}
            onMarkAllAsRead={markNotificationsAsRead}
            c1={c1}
            c2={c2}
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
   POPUP 1: OBSERVAR PERFIL Y MÉTRICAS DEL AMIGO
========================================================== */
function FriendProfileModal({
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
  const m = friend.metrics;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.profileCardModal, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
          {/* Header del Perfil */}
          <View style={styles.profileHeader}>
            <Text style={[styles.profileHeaderTitle, { color: palette.text, fontFamily: titleFont }]}>
              Perfil del Atleta
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color={palette.textSub} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Banner de Usuario */}
            <LinearGradient
              colors={[friend.color, c2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileHeroBanner}
            >
              <View style={styles.profileHeroRow}>
                <View style={styles.profileHeroAvatar}>
                  <Text style={styles.profileHeroAvatarText}>{friend.initials}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.profileHeroName, { fontFamily: titleFont }]}>{friend.name}</Text>
                  <Text style={[styles.profileHeroNick, { fontFamily: bodyFont }]}>{friend.nickname}</Text>
                  <View style={styles.profileRankBadge}>
                    <Text style={styles.profileRankText}>
                      ⭐ Nivel {friend.level} · {friend.rank}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.profileStreakFooter}>
                <Text style={styles.profileStreakText}>
                  🔥 {friend.streak} días consecutivos de entrenamiento
                </Text>
              </View>
            </LinearGradient>

            {/* Grid 2x2 de Métricas Corporales & Nutrición */}
            <Text style={[styles.metricSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
              Métricas Corporales & Nutrición
            </Text>
            <View style={styles.metricsGrid}>
              <View style={[styles.metricTile, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                <Text style={styles.metricEmoji}>⚖️</Text>
                <Text style={[styles.metricValue, { color: palette.text, fontFamily: dataFont }]}>
                  {m?.currentWeight || '--'} kg
                </Text>
                <Text style={[styles.metricLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                  Peso Actual
                </Text>
              </View>

              <View style={[styles.metricTile, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                <Text style={styles.metricEmoji}>📉</Text>
                <Text style={[styles.metricValue, { color: palette.text, fontFamily: dataFont }]}>
                  {m?.bodyFat ? `${m.bodyFat}%` : '--'}
                </Text>
                <Text style={[styles.metricLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                  % Grasa Corporal
                </Text>
              </View>

              <View style={[styles.metricTile, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                <Text style={styles.metricEmoji}>🥩</Text>
                <Text style={[styles.metricValue, { color: palette.text, fontFamily: dataFont }]}>
                  {m?.avgProtein ? `${m.avgProtein}g` : '--'}
                </Text>
                <Text style={[styles.metricLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                  Proteína / día
                </Text>
              </View>

              <View style={[styles.metricTile, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
                <Text style={styles.metricEmoji}>🥗</Text>
                <Text style={[styles.metricValue, { color: palette.text, fontFamily: dataFont }]}>
                  {m?.avgCalories ? `${m.avgCalories}` : '--'} kcal
                </Text>
                <Text style={[styles.metricLabel, { color: palette.textSub, fontFamily: bodyFont }]}>
                  Calorías / día
                </Text>
              </View>
            </View>

            {/* Récords Personales (PRs) */}
            <Text style={[styles.metricSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
              Récords Personales (PRs)
            </Text>
            <View style={[styles.prsContainer, { backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC', borderColor: palette.border }]}>
              {m?.prs && m.prs.length > 0 ? (
                m.prs.map((pr, index) => (
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
                        {pr.date ? `Fecha: ${pr.date}` : 'Récord activo'}
                      </Text>
                    </View>
                    <View style={[styles.prWeightBadge, { backgroundColor: `${c1}20` }]}>
                      <Text style={[styles.prWeightText, { color: c1, fontFamily: dataFont }]}>
                        {pr.weight} kg
                      </Text>
                      {pr.reps ? (
                        <Text style={[styles.prRepsText, { color: palette.textSub, fontFamily: bodyFont }]}>
                          x{pr.reps} reps
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyPrText, { color: palette.textSub, fontFamily: bodyFont }]}>
                  No hay récords registrados todavía.
                </Text>
              )}
            </View>

            {/* Entrenamientos Recientes */}
            <Text style={[styles.metricSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
              Historial de Entrenamientos Recientes
            </Text>
            {m?.recentWorkouts && m.recentWorkouts.length > 0 ? (
              m.recentWorkouts.map((w) => (
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
              ))
            ) : null}

            {/* Meta Activa del Amigo */}
            {m?.activeGoal && (
              <View style={[styles.activeGoalBox, { borderColor: `${c2}50`, backgroundColor: `${c2}15` }]}>
                <Ionicons name="flag" size={18} color={c2} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activeGoalTitle, { color: c2, fontFamily: subtitleFont }]}>
                    Meta Actual del Atleta
                  </Text>
                  <Text style={[styles.activeGoalDesc, { color: palette.text, fontFamily: bodyFont }]}>
                    {m.activeGoal}
                  </Text>
                </View>
              </View>
            )}

            {/* Botón Acción: Invitar a entrenar */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onInvite}
              style={[styles.profileInviteBtn, { backgroundColor: c1 }]}
            >
              <Ionicons name="fitness-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={[styles.profileInviteBtnText, { fontFamily: subtitleFont }]}>
                Invitar a Entrenar a {friend.name.split(' ')[0]}
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
}) {
  const [selectedType, setSelectedType] = useState(WORKOUT_TYPES[0].label);
  const [selectedDate, setSelectedDate] = useState('Hoy');
  const [customDate, setCustomDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('06:30 PM');
  const [customTime, setCustomTime] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');

  const handleSend = () => {
    const finalDate = customDate.trim() || selectedDate;
    const finalTime = customTime.trim() || selectedTime;

    if (!finalDate) {
      Alert.alert('Falta la fecha', 'Por favor selecciona o ingresa la fecha para entrenar.');
      return;
    }
    if (!finalTime) {
      Alert.alert('Falta la hora', 'Por favor selecciona o ingresa la hora del entrenamiento.');
      return;
    }

    onSend({
      friendId: friend.id,
      friendName: friend.name,
      workoutType: selectedType,
      date: finalDate,
      time: finalTime,
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
              <Ionicons name="close" size={22} color={palette.textSub} />
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

            {/* 2. Fecha */}
            <Text style={[styles.formLabel, { color: palette.text, fontFamily: subtitleFont }]}>
              2. Fecha
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
            <TextInput
              value={customDate}
              onChangeText={setCustomDate}
              placeholder="O escribe otra fecha (ej. Viernes 15 Nov)..."
              placeholderTextColor={palette.textSub}
              style={[
                styles.formInput,
                {
                  backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                  color: palette.text,
                  borderColor: customDate ? c2 : palette.border,
                  fontFamily: bodyFont,
                },
              ]}
            />

            {/* 3. Hora */}
            <Text style={[styles.formLabel, { color: palette.text, fontFamily: subtitleFont }]}>
              3. Hora de Encuentro
            </Text>
            <View style={styles.chipsWrap}>
              {QUICK_TIMES.map((t) => {
                const isSelected = selectedTime === t && !customTime;
                return (
                  <TouchableOpacity
                    key={t}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedTime(t);
                      setCustomTime('');
                    }}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: isSelected ? c1 : palette.isDark ? '#0F172A' : '#F1F5F9',
                        borderColor: isSelected ? c1 : palette.border,
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
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              value={customTime}
              onChangeText={setCustomTime}
              placeholder="O ingresa otra hora personalizada..."
              placeholderTextColor={palette.textSub}
              style={[
                styles.formInput,
                {
                  backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                  color: palette.text,
                  borderColor: customTime ? c1 : palette.border,
                  fontFamily: bodyFont,
                },
              ]}
            />

            {/* 4. Lugar (Opcional) */}
            <Text style={[styles.formLabel, { color: palette.text, fontFamily: subtitleFont }]}>
              4. Lugar de Entrenamiento (Opcional)
            </Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Ej. Smart Fit Medellín, Parque Simón Bolívar, etc."
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
              placeholder="Ej. ¡Vamos a darle duro a sentadilla pesada!"
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

            {/* Botón Enviar */}
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
    </Modal>
  );
}

/* ==========================================================
   POPUP 3: MENSAJES Y NOTIFICACIONES PENDIENTES
========================================================== */
function NotificationsModal({
  visible,
  notifications,
  onClose,
  onAcceptFriend,
  onRejectFriend,
  onAcceptWorkout,
  onRejectWorkout,
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
  onMarkAllAsRead: () => void;
  c1: string;
  c2: string;
  palette: ColorPalette;
  titleFont?: string;
  subtitleFont?: string;
  bodyFont?: string;
}) {
  const friendRequests = notifications.filter((n) => n.type === 'friend_request' && n.status === 'pending');
  const workoutInvites = notifications.filter((n) => n.type === 'workout_invite' && n.status === 'pending');
  const activityUpdates = notifications.filter((n) => n.type === 'activity' || n.status !== 'pending');

  const totalPending = friendRequests.length + workoutInvites.length;

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
              <Ionicons name="close" size={22} color={palette.textSub} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* 1. SOLICITUDES DE AMISTAD RECIBIDAS */}
            {friendRequests.length > 0 && (
              <View style={styles.notifSection}>
                <View style={styles.notifSectionHeader}>
                  <Text style={[styles.notifSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
                    🤝 Solicitudes de Amistad ({friendRequests.length})
                  </Text>
                </View>

                {friendRequests.map((req) => (
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
                        <Text style={[styles.friendNick, { color: palette.textSub, fontFamily: bodyFont }]}>
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
                ))}
              </View>
            )}

            {/* 2. INVITACIONES A ENTRENAR RECIBIDAS */}
            {workoutInvites.length > 0 && (
              <View style={styles.notifSection}>
                <View style={styles.notifSectionHeader}>
                  <Text style={[styles.notifSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
                    🏋️‍♂️ Invitaciones a Entrenar ({workoutInvites.length})
                  </Text>
                </View>

                {workoutInvites.map((inv) => (
                  <View
                    key={inv.id}
                    style={[
                      styles.notifItemCard,
                      {
                        backgroundColor: palette.isDark ? '#0F172A' : '#F8FAFC',
                        borderColor: palette.border,
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
                        <Text style={[styles.friendNick, { color: palette.textSub, fontFamily: bodyFont }]}>
                          {inv.senderNickname} · {inv.date}
                        </Text>
                      </View>
                    </View>

                    {inv.workoutDetails && (
                      <View style={[styles.inviteDetailsBox, { backgroundColor: `${c1}12`, borderColor: `${c1}30` }]}>
                        <Text style={[styles.inviteDetailLine, { color: palette.text, fontFamily: subtitleFont }]}>
                          Modalidad: <Text style={{ color: c1 }}>{inv.workoutDetails.workoutType}</Text>
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
                        <Text style={[styles.notifAcceptBtnText, { fontFamily: subtitleFont }]}>¡Aceptar Entreno!</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* 3. ACTIVIDAD RECIENTE & MENSAJES */}
            <View style={styles.notifSection}>
              <View style={styles.notifSectionHeader}>
                <Text style={[styles.notifSectionTitle, { color: palette.text, fontFamily: titleFont }]}>
                  ⚡ Actividad de la Comunidad
                </Text>
              </View>

              {activityUpdates.length === 0 && totalPending === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: palette.cardBg, borderColor: palette.border, paddingVertical: 28 }]}>
                  <Ionicons name="checkmark-done-circle-outline" size={44} color="#10B981" />
                  <Text style={[styles.emptyTitle, { color: palette.text, fontFamily: titleFont }]}>
                    ¡Todo al día!
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: palette.textSub, fontFamily: bodyFont }]}>
                    No tienes mensajes ni solicitudes de amistad pendientes.
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

            {/* Marcar todas como leídas */}
            {notifications.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  onMarkAllAsRead();
                  Alert.alert('Listo', 'Se han marcado las notificaciones como leídas.');
                }}
                style={styles.markReadBtn}
              >
                <Text style={[styles.markReadBtnText, { color: palette.textSub, fontFamily: subtitleFont }]}>
                  Marcar todas como leídas
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
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
  notifBtn: {
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
  friendNick: {
    fontSize: 11,
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
    flex: 1.2,
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

  // Profile Modal
  profileCardModal: {
    maxHeight: '90%',
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
    alignItems: 'center',
    marginBottom: 14,
  },
  profileHeaderTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  closeIconBtn: {
    padding: 4,
  },
  profileHeroBanner: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  profileHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileHeroAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileHeroAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  profileHeroName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  profileHeroNick: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    marginTop: 1,
  },
  profileRankBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    marginTop: 5,
  },
  profileRankText: {
    color: '#FDE047',
    fontSize: 11,
    fontWeight: '900',
  },
  profileStreakFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  profileStreakText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  metricSectionTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    marginTop: 12,
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
  emptyPrText: {
    padding: 14,
    textAlign: 'center',
    fontSize: 12,
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
  activeGoalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 10,
  },
  activeGoalTitle: {
    fontSize: 11,
    fontWeight: '900',
  },
  activeGoalDesc: {
    fontSize: 12,
    marginTop: 1,
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
    maxHeight: '90%',
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
  formInput: {
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 9 : 6,
    fontSize: 12,
    marginBottom: 6,
  },

  // Notifications Modal
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
});
