import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  apiSendFriendRequest,
  apiRespondFriendRequest,
  apiSendWorkoutInvite,
  apiRespondWorkoutInvite,
  apiSendChallenge,
  apiRespondChallenge,
  apiMarkNotificationsRead,
  apiRemoveFriend,
  apiAddFriend,
} from './api';
/* ==========================================================
   TIPOS DE COMIDA
========================================================== */
export type Macros = { kcal: number; carbs: number; protein: number; fat: number; sugar?: number };

/** Valores nutricionales tal como vienen en el empaque, para `servingGrams` gramos. */
export type FoodUnit = 'g' | 'ml' | 'ud';
export type Ingredient = Macros & { id: string; name: string; servingGrams: number; unit?: FoodUnit };

export type MealItem = { id: string; ingredientId: string | null; grams: number; unit?: FoodUnit };
export type MealBlock = { id: string; name: string; items: MealItem[] };
export type SavedMeal = MealBlock;

/* ==========================================================
   TIPOS DE ENTRENAMIENTO
========================================================== */
export type Exercise = {
  id: string;
  name: string;
  muscleGroup: string; // ej. Pecho, Espalda, Piernas, Hombros, Brazos, Core, Calistenia, CrossFit, Cardio, Deporte
  type?: 'reps' | 'time';
};

export type WorkoutSet = {
  id: string;
  weight?: number; // en kg
  timeSeconds?: number; // tiempo en segundos (CrossFit, correr, bicicleta)
  distanceMeters?: number;
  reps?: number;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  sets: WorkoutSet[];
};


/* ==========================================================
   TIPOS DE MEDIDAS CORPORALES
========================================================== */
export type BodyPartKey =
  | 'head'           // Cabeza (no interactua)
  | 'chest'          // Pecho
  | 'back'           // Espalda
  | 'right_arm'      // Brazo derecho
  | 'left_arm'       // Brazo izquierdo
  | 'right_forearm'  // Antebrazo derecho
  | 'left_forearm'   // Antebrazo izquierdo
  | 'waist'          // Cintura
  | 'right_thigh'    // Muslo derecho
  | 'left_thigh'     // Muslo izquierdo
  | 'right_calf'     // Pantorilla derecha
  | 'left_calf'      // Pantorilla izquierda
  | 'glutes'         // Glúteos
  | 'hands'          // Manos (no interactua)
  | 'feet';          // Pies (no interactua)

export type DayMeasurements = Partial<Record<BodyPartKey, number>>;

export type ProgressPhoto = {
  id: string;
  uri: string;
  angle: 'front' | 'side' | 'back';
  timestamp: number;
};

/* ==========================================================
   TIPOS DE BIENESTAR (SUEÑO Y SUPLEMENTOS)
========================================================== */
export type HealthMetricDefinition = {
  id: string;
  name: string;
  unit: string;
  icon: string;
  color: string;
  isDualValue?: boolean;
  primaryLabel?: string;
  secondaryLabel?: string;
  idealRange?: string;
  custom?: boolean;
};

export type HealthLogEntry = {
  value?: number;
  secondaryValue?: number;
  notes?: string;
};

/* ==========================================================
   TIPOS DE SUEÑO Y SMARTBAND (APPLE HEALTH / XIAOMI BAND)
========================================================== */
export type SleepLogEntry = {
  hours: number;
  minutes: number;
  bedtime?: string;
  wakeTime?: string;
  deepSleepHours?: number;
  lightSleepHours?: number;
  remSleepHours?: number;
  awakeMinutes?: number;
  sleepScore?: number;
  activeCaloriesBurned?: number; // Calorías activas quemadas sincronizadas del reloj
  steps?: number;
  restingHeartRate?: number;
  syncedFromDevice?: boolean;
  deviceName?: string;
  source?: 'apple_health' | 'manual';
  lastSyncedAt?: string;
  qualityNote?: string;
};

/* ==========================================================
   CONFIGURACIÓN Y PERSONALIZACIÓN (PALETAS, TIPOGRAFÍA, HOME)
========================================================== */
export type GenderOption = 'Masculino' | 'Femenino' | 'Otro' | 'Prefiero no decir';

export type UserProfile = {
  name: string;
  nickname: string;
  height?: number; // en cm
  gender?: GenderOption;
  avatarUri?: string;
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Sergio Tamayo',
  nickname: 'Sertic77',
  height: 178,
  gender: 'Masculino',
  avatarUri: '',
};

/* ==========================================================
   METAS & OBJETIVOS CON FECHAS LÍMITE
========================================================== */
export type GoalType = 'weight' | 'body_fat' | 'pr' | 'muscle' | 'custom';

export type UserGoal = {
  id: string;
  title: string;
  type: GoalType;
  targetDate: string; // YYYY-MM-DD
  startValue?: number;
  currentValue?: number;
  targetValue?: number;
  unit?: string;
  categoryLabel?: string;
  exerciseName?: string;
  bodyPart?: BodyPartKey;
  completed?: boolean;
  completedAt?: string;
  notes?: string;
  createdAt: string;
};

export const SEED_GOALS: UserGoal[] = [
  {
    id: 'goal-seed-1',
    title: 'Subir 10 kg de peso (Volumen Limpio)',
    type: 'weight',
    targetDate: '2026-02-14',
    startValue: 72,
    currentValue: 76.5,
    targetValue: 82,
    unit: 'kg',
    categoryLabel: 'Peso Corporal',
    notes: 'Superávit calórico de 400 kcal y entrenamiento pesado de fuerza',
    createdAt: '2026-01-01',
    completed: false,
  },
  {
    id: 'goal-seed-2',
    title: 'Press de Banca: Alcanzar 100 kg (PR)',
    type: 'pr',
    targetDate: '2026-03-31',
    startValue: 80,
    currentValue: 90,
    targetValue: 100,
    unit: 'kg',
    exerciseName: 'Press de Banca Plano',
    categoryLabel: 'Mejorar PR',
    notes: 'Progresión lineal 5x5 cada semana',
    createdAt: '2026-01-05',
    completed: false,
  },
  {
    id: 'goal-seed-3',
    title: 'Aumentar Bíceps a 40 cm',
    type: 'muscle',
    targetDate: '2026-04-30',
    startValue: 36,
    currentValue: 38,
    targetValue: 40,
    unit: 'cm',
    bodyPart: 'right_arm',
    categoryLabel: 'Medidas de Músculo',
    notes: 'Enfoque en curls inclinados y martillo pesado',
    createdAt: '2026-01-10',
    completed: false,
  },
];


/* ==========================================================
   AMIGOS & COMUNIDAD EVOLVE
========================================================== */
export type FriendPR = {
  exercise: string;
  weight: number;
  reps?: number;
  date?: string;
};

export type FriendRecentWorkout = {
  id: string;
  date: string;
  title: string;
  durationMinutes: number;
  exercises: string[];
  totalSets: number;
};

export type FriendMetrics = {
  currentWeight: number; // kg
  bodyFat?: number; // %
  avgCalories: number; // kcal
  avgProtein: number; // g
  prs: FriendPR[];
  recentWorkouts: FriendRecentWorkout[];
  activeGoal?: string;
};

export type SectionPrivacySettings = {
  home: boolean;
  workout: boolean;
  food: boolean;
  wellness: boolean;
  measurements: boolean;
};

export const DEFAULT_PRIVACY_SETTINGS: SectionPrivacySettings = {
  home: true,
  workout: true,
  food: true,
  wellness: true,
  measurements: true,
};

export type FriendCustomization = {
  palette: {
    name: string;
    primary: string;
    secondary: string;
    cardBg: string;
    bg: string;
    isDark: boolean;
  };
  font: string;
  avatarIcon?: string;
};

export type FriendFullProfile = {
  customization: FriendCustomization;
  privacy: SectionPrivacySettings;
  home: {
    streak: number;
    level: number;
    rank: string;
    xp: number;
    nextLevelXp: number;
    activeGoals: { id: string; title: string; progress: number; targetDate: string; category: string }[];
    completedGoalsCount: number;
  };
  workout: {
    division: string;
    weeklyFrequency: number;
    prs: FriendPR[];
    recentWorkouts: FriendRecentWorkout[];
  };
  food: {
    targetCalories: number;
    macros: { protein: number; carbs: number; fat: number };
    waterLiters: number;
    loggedMealsToday: { name: string; calories: number; protein: number }[];
  };
  wellness: {
    avgSleepHours: number;
    sleepQuality: string;
    activeSupplements: { name: string; dosage: string; takenToday: boolean }[];
  };
  measurements: {
    currentWeight: number;
    startWeight: number;
    targetWeight: number;
    bodyFat: number;
    muscles: { part: string; cm: number }[];
  };
};

export type FriendUser = {
  id: string;
  name: string;
  nickname: string; // ID único identificador @nickname
  streak: number;
  level: number;
  rank: string;
  todayWorkout: string;
  avatarUri?: string;
  color: string;
  initials: string;
  cheeredToday?: boolean;
  metrics: FriendMetrics;
  fullProfile?: FriendFullProfile;
};

export type ChallengeVariable =
  | 'calories'
  | 'strength'
  | 'muscle_weight'
  | 'total_weight'
  | 'time_running';

export type ChallengeDetails = {
  targetDate: string;
  variableType: ChallengeVariable;
  variableLabel: string;
  muscleOrExercise?: string;
  targetValue?: string;
  message?: string;
};

export type FriendChallenge = {
  id: string;
  friendId: string;
  friendName: string;
  friendNickname: string;
  details: ChallengeDetails;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
};

export type FriendNotification = {
  id: string;
  type: 'friend_request' | 'workout_invite' | 'challenge' | 'activity';
  senderId: string;
  senderName: string;
  senderNickname: string;
  senderAvatarUri?: string;
  senderColor: string;
  senderInitials: string;
  senderLevel: number;
  senderRank: string;
  date: string;
  read: boolean;
  status: 'pending' | 'accepted' | 'rejected';
  message?: string;
  workoutDetails?: {
    workoutType: string;
    dateTime: string;
    location?: string;
    note?: string;
  };
  challengeDetails?: ChallengeDetails;
};

export type WorkoutInvite = {
  id: string;
  friendId: string;
  friendName: string;
  workoutType: string;
  date: string;
  time: string;
  location?: string;
  note?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
};


export function getFriendFullProfile(friend: FriendUser): FriendFullProfile {
  if (friend.fullProfile) return friend.fullProfile;
  const m = friend.metrics || {
    currentWeight: 75,
    bodyFat: 15,
    avgCalories: 2500,
    avgProtein: 160,
    prs: [],
    recentWorkouts: [],
    activeGoal: 'Superar mis marcas este año',
  };

  return {
    customization: {
      palette: {
        name: friend.color === '#EC4899' ? 'Rosa Sakura & Magenta' : friend.color === '#3B82F6' ? 'Azul Neón Eléctrico' : 'Violeta & Lavanda',
        primary: friend.color || '#8B5CF6',
        secondary: '#EC4899',
        cardBg: '#1E293B',
        bg: '#0F172A',
        isDark: true,
      },
      font: 'athletic',
      avatarIcon: 'flame',
    },
    privacy: {
      home: true,
      workout: true,
      food: true,
      wellness: friend.nickname !== '@lau_wod', // Demostración de sección privada con candado para @lau_wod
      measurements: true,
    },
    home: {
      streak: friend.streak || 15,
      level: friend.level || 20,
      rank: friend.rank || 'Atleta Avanzado',
      xp: (friend.level || 20) * 1250 + 450,
      nextLevelXp: ((friend.level || 20) + 1) * 1250,
      activeGoals: [
        {
          id: 'g-fr-1',
          title: m.activeGoal || 'Mejorar PR de Fuerza',
          progress: 78,
          targetDate: '2026-03-31',
          category: 'Fuerza & Rendimiento',
        },
        {
          id: 'g-fr-2',
          title: 'Mantener racha de entrenamientos activa',
          progress: 92,
          targetDate: '2026-02-28',
          category: 'Hábito & Racha',
        },
      ],
      completedGoalsCount: 6,
    },
    workout: {
      division: friend.nickname === '@valen_lift' ? 'Glúteos / Pierna / Torso' : 'Push / Pull / Legs (PPL)',
      weeklyFrequency: 5,
      prs: m.prs && m.prs.length > 0 ? m.prs : [
        { exercise: 'Press de Banca Plano', weight: 100, reps: 5, date: '2026-10-20' },
        { exercise: 'Sentadilla Profunda', weight: 140, reps: 4, date: '2026-10-15' },
        { exercise: 'Peso Muerto Convencional', weight: 170, reps: 3, date: '2026-10-10' },
      ],
      recentWorkouts: m.recentWorkouts && m.recentWorkouts.length > 0 ? m.recentWorkouts : [
        { id: 'rw-1', date: 'Ayer', title: 'Empuje Pesado (Pecho/Hombro)', durationMinutes: 65, exercises: ['Press Banca Plano', 'Press Militar', 'Fondos Lastrados'], totalSets: 18 },
        { id: 'rw-2', date: 'Hace 3 días', title: 'Jalón & Espalda', durationMinutes: 60, exercises: ['Dominadas Lastradas', 'Remo con Barra', 'Jalón al Pecho'], totalSets: 16 },
      ],
    },
    food: {
      targetCalories: m.avgCalories || 2600,
      macros: {
        protein: m.avgProtein || 170,
        carbs: Math.round(((m.avgCalories || 2600) * 0.45) / 4),
        fat: Math.round(((m.avgCalories || 2600) * 0.25) / 9),
      },
      waterLiters: 3.2,
      loggedMealsToday: [
        { name: 'Desayuno Proteico (Huevos + Avena + Fruta)', calories: 650, protein: 42 },
        { name: 'Almuerzo (Pechuga + Arroz + Aguacate)', calories: 850, protein: 55 },
        { name: 'Merienda Post-Entreno (Batido Whey + Plátano)', calories: 420, protein: 35 },
        { name: 'Cena Ligera (Salmón + Ensalada verde)', calories: 580, protein: 38 },
      ],
    },
    wellness: {
      avgSleepHours: 7.8,
      sleepQuality: 'Excelente (88% sueño profundo)',
      activeSupplements: [
        { name: 'Creatina Monohidrato Creapure', dosage: '5g diarios', takenToday: true },
        { name: 'Proteína Whey Isolate', dosage: '30g post-entreno', takenToday: true },
        { name: 'Omega 3 EPA/DHA', dosage: '2 cápsulas', takenToday: false },
        { name: 'Magnesio Bisglicinato', dosage: '400mg antes de dormir', takenToday: false },
      ],
    },
    measurements: {
      currentWeight: m.currentWeight || 75.0,
      startWeight: Number(((m.currentWeight || 75.0) - 4.5).toFixed(1)),
      targetWeight: Number(((m.currentWeight || 75.0) + 3.0).toFixed(1)),
      bodyFat: m.bodyFat || 14.5,
      muscles: [
        { part: 'Brazo Derecho (Bíceps)', cm: 39.5 },
        { part: 'Pecho / Torso', cm: 108.0 },
        { part: 'Cintura', cm: 79.0 },
        { part: 'Muslo / Cuádriceps', cm: 61.5 },
        { part: 'Pantorrilla', cm: 38.0 },
      ],
    },
  };
}

export const SEED_FRIENDS: FriendUser[] = [
  {
    id: 'f-1',
    name: 'Carlos Mendoza',
    nickname: '@carlos_fit',
    streak: 22,
    level: 28,
    rank: 'Atleta Avanzado',
    todayWorkout: 'Pecho & Tríceps (5 series pesadas)',
    color: '#3B82F6',
    initials: 'CM',
    cheeredToday: false,
    metrics: {
      currentWeight: 81.2,
      bodyFat: 14.2,
      avgCalories: 2850,
      avgProtein: 180,
      prs: [
        { exercise: 'Press de Banca Plano', weight: 115, reps: 5, date: '2026-10-24' },
        { exercise: 'Sentadilla Trasera', weight: 150, reps: 4, date: '2026-10-18' },
        { exercise: 'Peso Muerto Convencional', weight: 180, reps: 3, date: '2026-10-10' },
        { exercise: 'Press Militar de Pie', weight: 75, reps: 6, date: '2026-10-05' },
      ],
      recentWorkouts: [
        { id: 'w-cm-1', date: 'Ayer', title: 'Pecho & Tríceps Pesado', durationMinutes: 65, exercises: ['Press de Banca Plano', 'Fondos Lastrados', 'Press Inclinado', 'Extensiones Polea'], totalSets: 18 },
        { id: 'w-cm-2', date: 'Hace 3 días', title: 'Espalda & Jalones', durationMinutes: 70, exercises: ['Dominadas Lastradas', 'Remo con Barra', 'Jalón al Pecho', 'Face Pulls'], totalSets: 20 },
        { id: 'w-cm-3', date: 'Hace 5 días', title: 'Pierna Hipertrofia', durationMinutes: 60, exercises: ['Sentadilla Trasera', 'Prensa 45', 'Curl Femoral', 'Gemelos'], totalSets: 16 },
      ],
      activeGoal: 'Superar los 120 kg en Press de Banca antes de fin de año',
    },
  },
  {
    id: 'f-2',
    name: 'Valentina Ortiz',
    nickname: '@valen_lift',
    streak: 18,
    level: 32,
    rank: 'Atleta Élite',
    todayWorkout: 'Sentadillas & Glúteos (PR 105 kg)',
    color: '#EC4899',
    initials: 'VO',
    cheeredToday: false,
    metrics: {
      currentWeight: 62.0,
      bodyFat: 19.5,
      avgCalories: 2200,
      avgProtein: 135,
      prs: [
        { exercise: 'Hip Thrust con Barra', weight: 165, reps: 8, date: '2026-10-28' },
        { exercise: 'Sentadilla Profunda', weight: 105, reps: 5, date: '2026-10-22' },
        { exercise: 'Peso Muerto Rumano', weight: 110, reps: 6, date: '2026-10-15' },
      ],
      recentWorkouts: [
        { id: 'w-vo-1', date: 'Hoy', title: 'Glúteos & Isquios Foco PR', durationMinutes: 60, exercises: ['Hip Thrust', 'Sentadilla Búlgara', 'Peso Muerto Rumano', 'Abductores'], totalSets: 17 },
        { id: 'w-vo-2', date: 'Hace 2 días', title: 'Tren Superior & Hombro 3D', durationMinutes: 55, exercises: ['Press Militar Mancuernas', 'Elevaciones Laterales', 'Remo Gironda'], totalSets: 19 },
      ],
      activeGoal: 'Alcanzar 180 kg en Hip Thrust con técnica perfecta',
    },
  },
  {
    id: 'f-3',
    name: 'Mateo Silva',
    nickname: '@mateo_iron',
    streak: 14,
    level: 16,
    rank: 'Guerrero del Gym',
    todayWorkout: 'Espalda & Jalones Foco Dorsal',
    color: '#8B5CF6',
    initials: 'MS',
    cheeredToday: true,
    metrics: {
      currentWeight: 75.0,
      bodyFat: 16.0,
      avgCalories: 2500,
      avgProtein: 150,
      prs: [
        { exercise: 'Dominadas con Lastre', weight: 25, reps: 6, date: '2026-10-20' },
        { exercise: 'Remo Pendlay con Barra', weight: 90, reps: 8, date: '2026-10-14' },
        { exercise: 'Peso Muerto', weight: 140, reps: 5, date: '2026-10-08' },
      ],
      recentWorkouts: [
        { id: 'w-ms-1', date: 'Ayer', title: 'Espalda Foco Dorsales', durationMinutes: 55, exercises: ['Dominadas', 'Remo con Mancuerna', 'Pullover Polea'], totalSets: 16 },
      ],
      activeGoal: 'Lograr 15 dominadas estrictas seguidas',
    },
  },
  {
    id: 'f-4',
    name: 'Laura Ramos',
    nickname: '@lau_wod',
    streak: 9,
    level: 21,
    rank: 'Atleta Avanzado',
    todayWorkout: 'CrossFit WOD & Metcon Cardio',
    color: '#10B981',
    initials: 'LR',
    cheeredToday: false,
    metrics: {
      currentWeight: 58.5,
      bodyFat: 20.0,
      avgCalories: 2100,
      avgProtein: 125,
      prs: [
        { exercise: 'Clean & Jerk', weight: 70, reps: 1, date: '2026-10-26' },
        { exercise: 'Snatch (Arrancada)', weight: 52, reps: 1, date: '2026-10-19' },
        { exercise: 'Carrera 5K', weight: 0, reps: 1, date: '2026-10-12' },
      ],
      recentWorkouts: [
        { id: 'w-lr-1', date: 'Hoy', title: 'WOD Murph Adaptado', durationMinutes: 45, exercises: ['Box Jumps', 'Wall Balls', 'Burpees', 'Kettlebell Swings'], totalSets: 15 },
      ],
      activeGoal: 'Mejorar marca de 5K por debajo de 22 minutos',
    },
  },
];

export const DISCOVERABLE_USERS: FriendUser[] = [
  ...SEED_FRIENDS,
  {
    id: 'disc-1',
    name: 'Andrés Morales',
    nickname: '@andres_beast',
    streak: 30,
    level: 35,
    rank: 'Maestro del Hierro',
    todayWorkout: 'Sentadilla Pesada & Prensa',
    color: '#EF4444',
    initials: 'AM',
    metrics: {
      currentWeight: 86.0,
      bodyFat: 12.8,
      avgCalories: 3200,
      avgProtein: 210,
      prs: [
        { exercise: 'Sentadilla Trasera', weight: 190, reps: 3, date: '2026-10-25' },
        { exercise: 'Press de Banca', weight: 140, reps: 2, date: '2026-10-18' },
        { exercise: 'Peso Muerto', weight: 220, reps: 1, date: '2026-10-10' },
      ],
      recentWorkouts: [
        { id: 'w-am-1', date: 'Ayer', title: 'Pierna Hipertrofia Pesada', durationMinutes: 75, exercises: ['Sentadilla', 'Prensa 45', 'Extensiones'], totalSets: 18 },
      ],
      activeGoal: 'Llegar a 200 kg en Sentadilla',
    },
  },
  {
    id: 'disc-2',
    name: 'Sofía Castro',
    nickname: '@sofi_fitness',
    streak: 15,
    level: 19,
    rank: 'Atleta Avanzado',
    todayWorkout: 'HIIT & Abdomen Funcional',
    color: '#F59E0B',
    initials: 'SC',
    metrics: {
      currentWeight: 56.0,
      bodyFat: 18.0,
      avgCalories: 1950,
      avgProtein: 120,
      prs: [
        { exercise: 'Hip Thrust con Mancuerna', weight: 130, reps: 10, date: '2026-10-28' },
      ],
      recentWorkouts: [
        { id: 'w-sc-1', date: 'Hoy', title: 'Core & Cardio Funcional', durationMinutes: 45, exercises: ['Plancha', 'Elevación de piernas', 'Burpees'], totalSets: 14 },
      ],
      activeGoal: 'Completar 30 días de racha continua',
    },
  },
  {
    id: 'disc-3',
    name: 'David Guerrero',
    nickname: '@david_power',
    streak: 26,
    level: 31,
    rank: 'Atleta Élite',
    todayWorkout: 'Press Banca & Fondos Lastrados',
    color: '#10B981',
    initials: 'DG',
    metrics: {
      currentWeight: 84.5,
      bodyFat: 15.1,
      avgCalories: 3000,
      avgProtein: 190,
      prs: [
        { exercise: 'Press Banca Plano', weight: 130, reps: 4, date: '2026-10-22' },
        { exercise: 'Fondos en Paralelas', weight: 45, reps: 6, date: '2026-10-15' },
      ],
      recentWorkouts: [
        { id: 'w-dg-1', date: 'Ayer', title: 'Empuje & Tríceps Explosivo', durationMinutes: 65, exercises: ['Press Banca', 'Press Militar', 'Fondos'], totalSets: 17 },
      ],
      activeGoal: 'Dominar fondos con 50 kg de lastre',
    },
  },
  {
    id: 'disc-4',
    name: 'Camila Vélez',
    nickname: '@cami_cross',
    streak: 12,
    level: 24,
    rank: 'Atleta Avanzado',
    todayWorkout: 'CrossFit WOD & Gimnásticos',
    color: '#8B5CF6',
    initials: 'CV',
    metrics: {
      currentWeight: 60.5,
      bodyFat: 19.0,
      avgCalories: 2300,
      avgProtein: 140,
      prs: [
        { exercise: 'Clean & Jerk', weight: 75, reps: 1, date: '2026-10-29' },
        { exercise: 'Pull-ups Estrictas', weight: 0, reps: 16, date: '2026-10-14' },
      ],
      recentWorkouts: [
        { id: 'w-cv-1', date: 'Hoy', title: 'WOD Potencia & Halterofilia', durationMinutes: 50, exercises: ['Power Clean', 'Box Jumps', 'Kettlebell Swings'], totalSets: 15 },
      ],
      activeGoal: 'Mejorar 1RM de Snatch a 60 kg',
    },
  },
  {
    id: 'disc-5',
    name: 'Santiago Ríos',
    nickname: '@santi_calisthenics',
    streak: 40,
    level: 29,
    rank: 'Atleta Élite',
    todayWorkout: 'Muscle-ups & Front Lever',
    color: '#06B6D4',
    initials: 'SR',
    metrics: {
      currentWeight: 71.0,
      bodyFat: 9.8,
      avgCalories: 2600,
      avgProtein: 160,
      prs: [
        { exercise: 'Muscle-up en Barra', weight: 0, reps: 12, date: '2026-10-27' },
        { exercise: 'Dominadas con +30 kg', weight: 30, reps: 5, date: '2026-10-19' },
      ],
      recentWorkouts: [
        { id: 'w-sr-1', date: 'Ayer', title: 'Fuerza Calistenia Pura', durationMinutes: 70, exercises: ['Muscle-ups', 'Front Lever', 'Fondos en anillas'], totalSets: 20 },
      ],
      activeGoal: 'Sostener Full Planche por 5 segundos',
    },
  },
];

export const INITIAL_NOTIFICATIONS: FriendNotification[] = [
  {
    id: 'notif-chal-demo',
    type: 'challenge',
    senderId: 'disc-2',
    senderName: 'Mateo Iron',
    senderNickname: '@mateo_iron',
    senderColor: '#3B82F6',
    senderInitials: 'MI',
    senderLevel: 28,
    senderRank: 'Titán de Fuerza',
    date: 'Hoy · hace 15 min',
    read: false,
    status: 'pending',
    message: '¿Te atreves a superar mi marca en sentadilla este fin de semana?',
    challengeDetails: {
      targetDate: 'Este Sábado',
      variableType: 'strength',
      variableLabel: 'Fuerza',
      muscleOrExercise: 'Piernas (Sentadilla)',
      message: '¡A ver si tus piernas aguantan el peso pesado!',
    },
  },
  {
    id: 'notif-1',
    type: 'friend_request',
    senderId: 'disc-1',
    senderName: 'Andrés Morales',
    senderNickname: '@andres_beast',
    senderColor: '#EF4444',
    senderInitials: 'AM',
    senderLevel: 35,
    senderRank: 'Maestro del Hierro',
    date: 'Hoy · hace 25 min',
    read: false,
    status: 'pending',
    message: 'Te envió una solicitud de amistad para ver métricas y entrenar juntos.',
  },
  {
    id: 'notif-2',
    type: 'workout_invite',
    senderId: 'f-2',
    senderName: 'Valentina Ortiz',
    senderNickname: '@valen_lift',
    senderColor: '#EC4899',
    senderInitials: 'VO',
    senderLevel: 32,
    senderRank: 'Atleta Élite',
    date: 'Hoy · hace 1 hora',
    read: false,
    status: 'pending',
    workoutDetails: {
      workoutType: '🏋️ Pierna & Glúteos (Pesas / Fuerza)',
      dateTime: 'Mañana · 06:30 PM',
      location: 'Smart Fit El Poblado (Zona de Peso Libre)',
      note: '¡Vamos a romper récord en sentadilla pesada!',
    },
  },
  {
    id: 'notif-3',
    type: 'activity',
    senderId: 'f-1',
    senderName: 'Carlos Mendoza',
    senderNickname: '@carlos_fit',
    senderColor: '#3B82F6',
    senderInitials: 'CM',
    senderLevel: 28,
    senderRank: 'Atleta Avanzado',
    date: 'Ayer · 07:15 PM',
    read: true,
    status: 'accepted',
    message: 'Carlos completó un nuevo récord: 115 kg en Press de Banca Plano 🔥',
  },
];

export type ColorPalette = {
  id: string;
  name: string;
  isDark?: boolean;
  colors: string[]; // Muestra de colores (mínimo 2 colores, variable por paleta)
  primary: string;
  secondary: string;
  bg: string;
  cardBg: string;
  text: string;
  textSub: string;
  border: string;
  accent: string;
  custom?: boolean;
};

export type FontStyleOption =
  | 'system'
  | 'condensed'
  | 'athletic'
  | 'rounded'
  | 'futuristic'
  | 'elegant'
  | 'serif'
  | 'monospace';

export type TypographySettings = {
  titles: FontStyleOption;
  subtitles: FontStyleOption;
  body: FontStyleOption;
  data: FontStyleOption;
};

export type HomeVisibleWidgets = {
  profile: boolean;
  calories: boolean;
  workout: boolean;
  supplements: boolean;
  health: boolean;
  body: boolean;
  sugar: boolean;
  goals: boolean;
};

export const PRESET_PALETTES: ColorPalette[] = [
  {
    id: 'default',
    name: 'Anime Pastel (Default)',
    isDark: false,
    colors: ['#8B5CF6', '#F472B6'], // 2 colores por defecto
    primary: '#8B5CF6',
    secondary: '#F472B6',
    bg: '#F3F5FA',
    cardBg: '#FFFFFF',
    text: '#1E1B4B',
    textSub: '#64748B',
    border: 'rgba(203, 213, 225, 0.6)',
    accent: '#8B5CF6',
  },
  {
    id: 'dark',
    name: 'Modo Nocturno (Midnight)',
    isDark: true,
    colors: ['#818CF8', '#EC4899'], // 2 colores por defecto
    primary: '#818CF8',
    secondary: '#EC4899',
    bg: '#0F172A',
    cardBg: '#1E293B',
    text: '#F8FAFC',
    textSub: '#94A3B8',
    border: '#334155',
    accent: '#818CF8',
  },
  {
    id: 'sunset',
    name: 'Atardecer Cálido',
    isDark: false,
    colors: ['#FB7185', '#F59E0B'], // 2 colores por defecto
    primary: '#FB7185',
    secondary: '#F59E0B',
    bg: '#FFF7ED',
    cardBg: '#FFFFFF',
    text: '#431407',
    textSub: '#9A3412',
    border: '#FED7AA',
    accent: '#FB7185',
  },
  {
    id: 'emerald',
    name: 'Menta & Esmeralda',
    isDark: false,
    colors: ['#10B981', '#06B6D4'], // 2 colores por defecto
    primary: '#10B981',
    secondary: '#06B6D4',
    bg: '#F0FDF4',
    cardBg: '#FFFFFF',
    text: '#064E3B',
    textSub: '#047857',
    border: '#A7F3D0',
    accent: '#10B981',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neón',
    isDark: true,
    colors: ['#06B6D4', '#EC4899', '#FACC15', '#A855F7', '#38BDF8'], // 5 colores
    primary: '#06B6D4',
    secondary: '#EC4899',
    bg: '#18181B',
    cardBg: '#27272A',
    text: '#FAFAFA',
    textSub: '#A1A1AA',
    border: '#3F3F46',
    accent: '#06B6D4',
  },
  {
    id: 'ocean',
    name: 'Océano Profundo',
    isDark: false,
    colors: ['#3B82F6', '#2DD4BF'], // 2 colores por defecto
    primary: '#3B82F6',
    secondary: '#2DD4BF',
    bg: '#F0F9FF',
    cardBg: '#FFFFFF',
    text: '#0C4A6E',
    textSub: '#0284C7',
    border: '#BAE6FD',
    accent: '#3B82F6',
  },
  {
    id: 'crimson',
    name: 'Fuego Carmesí',
    isDark: false,
    colors: ['#DC2626', '#EA580C'], // 2 colores por defecto
    primary: '#DC2626',
    secondary: '#EA580C',
    bg: '#FEF2F2',
    cardBg: '#FFFFFF',
    text: '#450A0A',
    textSub: '#991B1B',
    border: '#FECACA',
    accent: '#DC2626',
  },
];

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  titles: 'system',
  subtitles: 'system',
  body: 'system',
  data: 'system',
};

export const DEFAULT_HOME_WIDGETS: HomeVisibleWidgets = {
  profile: true,
  calories: true,
  workout: true,
  supplements: true,
  health: true,
  body: true,
  sugar: false,
  goals: true,
};

export function getFontFamily(fontOption: FontStyleOption): string | undefined {
  switch (fontOption) {
    case 'condensed':
      return Platform.select({ ios: 'HelveticaNeue-CondensedBold', android: 'sans-serif-condensed', default: 'sans-serif-condensed' });
    case 'athletic':
      return Platform.select({ ios: 'Impact', android: 'sans-serif-black', default: 'sans-serif-black' });
    case 'futuristic':
      return Platform.select({ ios: 'Trebuchet MS', android: 'sans-serif-light', default: 'sans-serif' });
    case 'elegant':
      return Platform.select({ ios: 'Palatino', android: 'serif', default: 'serif' });
    case 'serif':
      return Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
    case 'monospace':
      return Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' });
    case 'rounded':
      return Platform.select({ ios: 'Arial Rounded MT Bold', android: 'sans-serif-medium', default: 'sans-serif' });
    case 'system':
    default:
      return Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' });
  }
}

export function getActivePalette(state?: { activePaletteId?: string; customPalettes?: ColorPalette[]; deletedPaletteIds?: string[] }): ColorPalette {
  if (!state) return PRESET_PALETTES[0];
  const activeId = state.activePaletteId || 'default';
  const custom = state.customPalettes?.find((p) => p.id === activeId);
  if (custom) return custom;
  const preset = PRESET_PALETTES.find((p) => p.id === activeId);
  if (preset) return preset;
  const deleted = state.deletedPaletteIds || [];
  const fallback =
    state.customPalettes?.find((p) => !deleted.includes(p.id)) ||
    PRESET_PALETTES.find((p) => !deleted.includes(p.id)) ||
    PRESET_PALETTES[0];
  return fallback;
}


export const SEED_HEALTH_METRICS: HealthMetricDefinition[] = [
  {
    id: 'presion',
    name: 'Presión Arterial',
    unit: 'mmHg',
    icon: 'heart-outline',
    color: '#EC4899',
    isDualValue: true,
    primaryLabel: 'Sistólica',
    secondaryLabel: 'Diastólica',
    idealRange: '< 120/80 mmHg',
  },
  {
    id: 'azucar',
    name: 'Glucosa / Azúcar',
    unit: 'mg/dL',
    icon: 'water-outline',
    color: '#06B6D4',
    idealRange: '70 - 100 mg/dL',
  },
  {
    id: 'colesterol',
    name: 'Colesterol Total',
    unit: 'mg/dL',
    icon: 'flask-outline',
    color: '#F59E0B',
    idealRange: '< 200 mg/dL',
  },
  {
    id: 'trigliceridos',
    name: 'Triglicéridos',
    unit: 'mg/dL',
    icon: 'analytics-outline',
    color: '#8B5CF6',
    idealRange: '< 150 mg/dL',
  },
];

export type Supplement = {
  id: string;
  name: string;
  dailyTarget: number; // Cantidad de veces al día (número de checkboxes)
  startDate?: string; // YYYY-MM-DD desde cuando aparece en la lista ('0000-01-01' si es predefinido)
  removedFromDate?: string; // YYYY-MM-DD desde cuando se quitó (exclusivo: sigue en días < removedFromDate)
  alarmTime?: string; // Hora de alarma diaria en formato 24h "HH:mm" (ej. "08:30")
  alarmNotificationId?: string; // Identificador de la notificación diaria programada
  alarmSound?: string; // ID del tono de alarma elegido (ej. 'alarma-clasica', 'campana-zen', etc.)
};

/** Determina si un suplemento debe mostrarse en una fecha YYYY-MM-DD dada. */
export function isSupplementActiveOnDate(supp: Supplement, dateStr: string): boolean {
  const start = supp.startDate || '0000-01-01';
  if (dateStr < start) return false;
  if (supp.removedFromDate && dateStr >= supp.removedFromDate) return false;
  return true;
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const genRecentDateKey = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return dateKey(d);
};

export const SEED_HEALTH_LOGS: Record<string, Record<string, HealthLogEntry>> = {
  [genRecentDateKey(6)]: {
    presion: { value: 122, secondaryValue: 82 },
    azucar: { value: 98 },
    colesterol: { value: 188 },
    trigliceridos: { value: 145 },
  },
  [genRecentDateKey(4)]: {
    presion: { value: 120, secondaryValue: 80 },
    azucar: { value: 95 },
    colesterol: { value: 184 },
    trigliceridos: { value: 142 },
  },
  [genRecentDateKey(2)]: {
    presion: { value: 118, secondaryValue: 79 },
    azucar: { value: 92 },
    colesterol: { value: 180 },
    trigliceridos: { value: 139 },
  },
  [genRecentDateKey(0)]: {
    presion: { value: 119, secondaryValue: 78 },
    azucar: { value: 94 },
    colesterol: { value: 178 },
    trigliceridos: { value: 138 },
  },
};

export const SEED_SLEEP_LOGS: Record<string, SleepLogEntry> = {
  [genRecentDateKey(0)]: {
    hours: 7,
    minutes: 45,
    bedtime: '23:15',
    wakeTime: '07:00',
    deepSleepHours: 1.8,
    lightSleepHours: 4.4,
    remSleepHours: 1.5,
    awakeMinutes: 18,
    sleepScore: 88,
    activeCaloriesBurned: 520,
    steps: 8430,
    restingHeartRate: 58,
    syncedFromDevice: true,
    deviceName: 'Xiaomi Smart Band (Apple Health)',
    source: 'apple_health',
    lastSyncedAt: 'Hoy, 08:30 AM',
    qualityNote: 'Recuperación física óptima y buen porcentaje de sueño profundo.',
  },
  [genRecentDateKey(1)]: {
    hours: 8,
    minutes: 10,
    bedtime: '22:50',
    wakeTime: '07:00',
    deepSleepHours: 2.1,
    lightSleepHours: 4.5,
    remSleepHours: 1.5,
    awakeMinutes: 12,
    sleepScore: 92,
    activeCaloriesBurned: 610,
    steps: 10240,
    restingHeartRate: 56,
    syncedFromDevice: true,
    deviceName: 'Xiaomi Smart Band (Apple Health)',
    source: 'apple_health',
    lastSyncedAt: 'Ayer, 08:15 AM',
    qualityNote: 'Descanso reparador, ciclo circadiano constante.',
  },
  [genRecentDateKey(2)]: {
    hours: 6,
    minutes: 50,
    bedtime: '00:10',
    wakeTime: '07:00',
    deepSleepHours: 1.3,
    lightSleepHours: 4.2,
    remSleepHours: 1.3,
    awakeMinutes: 25,
    sleepScore: 76,
    activeCaloriesBurned: 480,
    steps: 7120,
    restingHeartRate: 61,
    syncedFromDevice: true,
    deviceName: 'Xiaomi Smart Band (Apple Health)',
    source: 'apple_health',
    lastSyncedAt: 'Hace 2 días, 08:20 AM',
    qualityNote: 'Ligera privación de sueño, se recomienda acostarse más temprano.',
  },
  [genRecentDateKey(3)]: {
    hours: 7,
    minutes: 20,
    bedtime: '23:30',
    wakeTime: '06:50',
    deepSleepHours: 1.7,
    lightSleepHours: 4.2,
    remSleepHours: 1.4,
    awakeMinutes: 16,
    sleepScore: 84,
    activeCaloriesBurned: 550,
    steps: 8900,
    restingHeartRate: 59,
    syncedFromDevice: true,
    deviceName: 'Xiaomi Smart Band (Apple Health)',
    source: 'apple_health',
    lastSyncedAt: 'Hace 3 días, 08:10 AM',
    qualityNote: 'Buen rendimiento cardiovascular y descanso adecuado.',
  },
  [genRecentDateKey(4)]: {
    hours: 7,
    minutes: 55,
    bedtime: '23:05',
    wakeTime: '07:00',
    deepSleepHours: 1.9,
    lightSleepHours: 4.5,
    remSleepHours: 1.6,
    awakeMinutes: 14,
    sleepScore: 89,
    activeCaloriesBurned: 530,
    steps: 9150,
    restingHeartRate: 57,
    syncedFromDevice: true,
    deviceName: 'Xiaomi Smart Band (Apple Health)',
    source: 'apple_health',
    lastSyncedAt: 'Hace 4 días, 08:25 AM',
    qualityNote: 'Fases de sueño equilibradas y alta recuperación física.',
  },
  [genRecentDateKey(5)]: {
    hours: 8,
    minutes: 5,
    bedtime: '22:45',
    wakeTime: '06:50',
    deepSleepHours: 2.0,
    lightSleepHours: 4.6,
    remSleepHours: 1.5,
    awakeMinutes: 11,
    sleepScore: 91,
    activeCaloriesBurned: 640,
    steps: 11020,
    restingHeartRate: 55,
    syncedFromDevice: true,
    deviceName: 'Xiaomi Smart Band (Apple Health)',
    source: 'apple_health',
    lastSyncedAt: 'Hace 5 días, 08:00 AM',
    qualityNote: 'Excelente descanso profundo y volumen de entrenamiento alto.',
  },
  [genRecentDateKey(6)]: {
    hours: 7,
    minutes: 15,
    bedtime: '23:40',
    wakeTime: '06:55',
    deepSleepHours: 1.6,
    lightSleepHours: 4.3,
    remSleepHours: 1.3,
    awakeMinutes: 19,
    sleepScore: 82,
    activeCaloriesBurned: 490,
    steps: 7850,
    restingHeartRate: 60,
    syncedFromDevice: true,
    deviceName: 'Xiaomi Smart Band (Apple Health)',
    source: 'apple_health',
    lastSyncedAt: 'Hace 6 días, 08:35 AM',
    qualityNote: 'Ritmo cardíaco estable durante el descanso.',
  },
};

export const ZERO: Macros = { kcal: 0, carbs: 0, protein: 0, fat: 0, sugar: 0 };

/** Escala los macros del ingrediente a la cantidad indicada. */
export function scaleMacros(ing: Ingredient | undefined, grams: number): Macros {
  if (!ing || !ing.servingGrams || !grams) return ZERO;
  const f = grams / ing.servingGrams;
  return {
    kcal: ing.kcal * f,
    carbs: ing.carbs * f,
    protein: ing.protein * f,
    fat: ing.fat * f,
    sugar: (ing.sugar || 0) * f,
  };
}

export const addMacros = (a: Macros, b: Macros): Macros => ({
  kcal: a.kcal + b.kcal,
  carbs: a.carbs + b.carbs,
  protein: a.protein + b.protein,
  fat: a.fat + b.fat,
  sugar: (a.sugar || 0) + (b.sugar || 0),
});

export function itemsTotal(items: MealItem[], ingredients: Ingredient[]): Macros {
  return items.reduce(
    (acc, it) => addMacros(acc, scaleMacros(ingredients.find((i) => i.id === it.ingredientId), it.grams)),
    ZERO,
  );
}

/* ==========================================================
   SEMILLAS INICIALES (SEED DATA)
========================================================== */
const SEED_INGREDIENTS: Ingredient[] = [
  { id: 'seed-pb', name: 'Mantequilla de maní', servingGrams: 50, kcal: 110, protein: 12, carbs: 5, fat: 17, sugar: 2.1, unit: 'g' },
  { id: 'seed-egg', name: 'Huevo', servingGrams: 1, kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8, sugar: 0.2, unit: 'ud' },
  { id: 'seed-milk', name: 'Leche entera', servingGrams: 200, kcal: 124, protein: 6.4, carbs: 9.6, fat: 6.8, sugar: 9.6, unit: 'ml' },
  { id: 'seed-rice', name: 'Arroz blanco cocido', servingGrams: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, sugar: 0.1, unit: 'g' },
  { id: 'seed-chicken', name: 'Pechuga de pollo', servingGrams: 100, kcal: 165, protein: 31, carbs: 0, fat: 3.6, sugar: 0, unit: 'g' },
  { id: 'seed-oats', name: 'Avena', servingGrams: 40, kcal: 150, protein: 5, carbs: 27, fat: 3, sugar: 0.8, unit: 'g' },
];

const SEED_EXERCISES: Exercise[] = [
  { id: 'ex-bench', name: 'Press de Banca Plano', muscleGroup: 'Pecho' },
  { id: 'ex-squat', name: 'Sentadilla con Barra', muscleGroup: 'Piernas' },
  { id: 'ex-deadlift', name: 'Peso Muerto', muscleGroup: 'Espalda' },
  { id: 'ex-run', name: 'Correr / Trote', muscleGroup: 'Cardio', type: 'time' },
  { id: 'ex-bike', name: 'Bicicleta / AirBike', muscleGroup: 'Cardio', type: 'time' },
  { id: 'ex-rower', name: 'Remo / Rower', muscleGroup: 'CrossFit', type: 'time' },
  { id: 'ex-burpee', name: 'Burpees / WOD', muscleGroup: 'CrossFit', type: 'time' },
  { id: 'ex-plank', name: 'Plancha Abdominal', muscleGroup: 'Core', type: 'time' },
  { id: 'ex-pullup', name: 'Dominadas', muscleGroup: 'Espalda' },
  { id: 'ex-military', name: 'Press Militar', muscleGroup: 'Hombros' },
  { id: 'ex-curl', name: 'Curl de Bíceps', muscleGroup: 'Brazos' },
  { id: 'ex-dips', name: 'Fondos en Paralelas', muscleGroup: 'Pecho' },
  { id: 'ex-press', name: 'Prensa de Piernas', muscleGroup: 'Piernas' },

  // Calistenia
  { id: 'ex-calis-pullup', name: 'Dominadas Estrictas', muscleGroup: 'Calistenia' },
  { id: 'ex-calis-dips', name: 'Fondos en Paralelas (Dips)', muscleGroup: 'Calistenia' },
  { id: 'ex-calis-muscleup', name: 'Muscle-Up en Barra', muscleGroup: 'Calistenia' },
  { id: 'ex-calis-pushup', name: 'Flexiones / Push-ups', muscleGroup: 'Calistenia' },
  { id: 'ex-calis-frontlever', name: 'Front Lever Estático', muscleGroup: 'Calistenia', type: 'time' },
  { id: 'ex-calis-handstand', name: 'Parada de Manos / Handstand', muscleGroup: 'Calistenia', type: 'time' },

  // Deportes
  { id: 'ex-sport-basket', name: 'Baloncesto / Basketball', muscleGroup: 'Deporte', type: 'time' },
  { id: 'ex-sport-soccer', name: 'Fútbol / Soccer', muscleGroup: 'Deporte', type: 'time' },
  { id: 'ex-sport-tennis', name: 'Tenis / Pádel', muscleGroup: 'Deporte', type: 'time' },
  { id: 'ex-sport-swim', name: 'Natación', muscleGroup: 'Deporte', type: 'time' },
  { id: 'ex-sport-box', name: 'Boxeo / Artes Marciales', muscleGroup: 'Deporte', type: 'time' },
  { id: 'ex-sport-cycling', name: 'Ciclismo de Ruta', muscleGroup: 'Deporte', type: 'time' },
];

const SEED_SUPPLEMENTS: Supplement[] = [
  { id: 'supp-creatine', name: 'Creatina', dailyTarget: 1 },
  { id: 'supp-omega3', name: 'Omega 3', dailyTarget: 2 },
  { id: 'supp-magnesium', name: 'Citrato de Magnesio', dailyTarget: 2 },
];

type State = {
  // Comida
  ingredients: Ingredient[];
  savedMeals: SavedMeal[];
  logs: Record<string, MealBlock[]>;

  upsertIngredient: (ing: Ingredient) => void;
  deleteIngredient: (id: string) => void;
  upsertSavedMeal: (m: SavedMeal) => void;
  deleteSavedMeal: (id: string) => void;
  setDayMeals: (date: string, meals: MealBlock[]) => void;

  // Entrenamiento
  exercises: Exercise[];
  workoutLogs: Record<string, WorkoutExercise[]>;

  upsertExercise: (ex: Exercise) => void;
  deleteExercise: (id: string) => void;
  setDayWorkout: (date: string, exercises: WorkoutExercise[]) => void;
  // Medidas Corporales
  measurementLogs: Record<string, DayMeasurements>;
  setPartMeasurement: (date: string, part: BodyPartKey, value: number) => void;
  deletePartMeasurement: (date: string, part: BodyPartKey) => void;

  // Peso Corporal y Composición
  weightLogs: Record<string, number>;
  setDayWeight: (date: string, weight: number) => void;
  deleteDayWeight: (date: string) => void;
  bodyFatLogs: Record<string, number>;
  setDayBodyFat: (date: string, bodyFat: number) => void;
  deleteDayBodyFat: (date: string) => void;

  // Fotos de Progreso
  photoLogs: Record<string, ProgressPhoto[]>;
  addProgressPhoto: (date: string, photo: ProgressPhoto) => void;
  deleteProgressPhoto: (date: string, photoId: string) => void;

  // Bienestar: Suplementos
  supplements: Supplement[];
  supplementLogs: Record<string, Record<string, boolean[]>>;
  addSupplement: (name: string, dailyTarget: number, startDate: string) => void;
  updateSupplement: (
    id: string,
    patch: Partial<Pick<Supplement, 'name' | 'dailyTarget'>>,
    effectiveDate: string,
  ) => void;
  deleteSupplement: (id: string, fromDate: string) => void;
  setSupplementAlarm: (
    id: string,
    alarmTime?: string,
    alarmNotificationId?: string,
    alarmSound?: string,
  ) => void;
  toggleSupplementDose: (date: string, supplementId: string, doseIndex: number, targetCount: number) => void;

  // Bienestar: Salud
  healthMetrics: HealthMetricDefinition[];
  healthLogs: Record<string, Record<string, HealthLogEntry>>;
  setHealthLog: (date: string, metricId: string, entry: HealthLogEntry) => void;
  addHealthMetric: (metric: Omit<HealthMetricDefinition, 'id'>) => void;
  deleteHealthMetric: (id: string) => void;

  // Bienestar: Sueño y Smartband (Xiaomi Band / Apple Health)
  sleepLogs: Record<string, SleepLogEntry>;
  setSleepLog: (date: string, entry: SleepLogEntry) => void;
  syncWatchData: (date: string, customData?: Partial<SleepLogEntry>) => void;
  // Perfil del Usuario
  userProfile: UserProfile;
  setUserProfile: (profile: Partial<UserProfile>) => void;

  // Metas & Objetivos
  goals: UserGoal[];
  addGoal: (goal: Omit<UserGoal, 'id' | 'createdAt'>) => void;
  updateGoal: (id: string, updates: Partial<UserGoal>) => void;
  deleteGoal: (id: string) => void;
  toggleGoalCompleted: (id: string) => void;

  // Configuración de Privacidad de Secciones para Amigos
  privacySettings: SectionPrivacySettings;
  updatePrivacySettings: (settings: Partial<SectionPrivacySettings>) => void;

  // Amigos & Comunidad
  friends: FriendUser[];
  friendNotifications: FriendNotification[];
  sentWorkoutInvites: WorkoutInvite[];
  sentChallenges: FriendChallenge[];
  addFriend: (friend: FriendUser) => void;
  removeFriend: (friendId: string) => void;
  acceptFriendRequest: (notificationId: string) => void;
  rejectFriendRequest: (notificationId: string) => void;
  sendWorkoutInvite: (invite: Omit<WorkoutInvite, 'id' | 'createdAt' | 'status'>) => void;
  respondWorkoutInvite: (notificationId: string, accept: boolean) => void;
  sendChallenge: (challenge: {
    friendId: string;
    friendName: string;
    friendNickname: string;
    details: ChallengeDetails;
  }) => void;
  respondChallenge: (notificationId: string, accept: boolean) => void;
  markNotificationsAsRead: () => void;
  sendFriendRequestTo: (user: FriendUser) => void;
  setFriendsFromDb: (friends: FriendUser[]) => void;
  setNotificationsFromDb: (notifications: FriendNotification[]) => void;
  // Personalización
  activePaletteId: string;
  customPalettes: ColorPalette[];
  deletedPaletteIds: string[];
  typography: TypographySettings;
  homeWidgets: HomeVisibleWidgets;

  setActivePalette: (id: string) => void;
  addCustomPalette: (palette: Omit<ColorPalette, 'id' | 'custom'>) => void;
  updatePalette: (id: string, updates: Partial<ColorPalette>) => void;
  deleteCustomPalette: (id: string) => void;
  deletePalette: (id: string) => void;
  setTypography: (settings: Partial<TypographySettings>) => void;
  toggleHomeWidget: (widgetKey: keyof HomeVisibleWidgets) => void;

  // Autenticación & Servidor Backend
  authToken: string | null;
  authUser: {
    id: string;
    email: string;
    name: string;
    nickname?: string;
    provider: string;
    avatarUrl?: string;
  } | null;
  isAuthenticated: boolean;
  setAuth: (
    token: string,
    user: {
      id: string;
      email: string;
      name: string;
      nickname?: string;
      provider: string;
      avatarUrl?: string;
    },
  ) => void;
  logout: () => void;

  // Sincronización con Base de Datos
  syncStatus: 'idle' | 'syncing' | 'saved' | 'error';
  lastSyncedAt: string | null;
  syncError: string | null;
  setSyncStatus: (
    status: 'idle' | 'syncing' | 'saved' | 'error',
    lastSyncedAt?: string,
    syncError?: string,
  ) => void;
  applyRemoteData: (records: Record<string, any>) => void;
  resetUserData: () => void;
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      // Comida
      ingredients: SEED_INGREDIENTS,
      savedMeals: [],
      logs: {},

      upsertIngredient: (ing) =>
        set((s) => {
          const exists = s.ingredients.some((i) => i.id === ing.id);
          return {
            ingredients: exists ? s.ingredients.map((i) => (i.id === ing.id ? ing : i)) : [...s.ingredients, ing],
          };
        }),
      deleteIngredient: (id) => set((s) => ({ ingredients: s.ingredients.filter((i) => i.id !== id) })),

      upsertSavedMeal: (m) =>
        set((s) => {
          const exists = s.savedMeals.some((x) => x.id === m.id);
          return { savedMeals: exists ? s.savedMeals.map((x) => (x.id === m.id ? m : x)) : [...s.savedMeals, m] };
        }),
      deleteSavedMeal: (id) => set((s) => ({ savedMeals: s.savedMeals.filter((x) => x.id !== id) })),

      setDayMeals: (date, meals) => set((s) => ({ logs: { ...s.logs, [date]: meals } })),

      // Entrenamiento
      exercises: SEED_EXERCISES,
      workoutLogs: {
        '2026-09-15': [
          {
            id: 'seed-wk-1',
            exerciseId: 'ex-bench',
            sets: [{ id: 's1', weight: 75, reps: 8 }, { id: 's2', weight: 77.5, reps: 8 }],
          },
          {
            id: 'seed-wk-2',
            exerciseId: 'ex-squat',
            sets: [{ id: 's3', weight: 100, reps: 8 }],
          },
        ],
        '2026-10-10': [
          {
            id: 'seed-wk-3',
            exerciseId: 'ex-bench',
            sets: [{ id: 's4', weight: 80, reps: 8 }, { id: 's5', weight: 82.5, reps: 6 }],
          },
          {
            id: 'seed-wk-4',
            exerciseId: 'ex-squat',
            sets: [{ id: 's6', weight: 107.5, reps: 8 }],
          },
        ],
        '2026-10-24': [
          {
            id: 'seed-wk-5',
            exerciseId: 'ex-bench',
            sets: [{ id: 's7', weight: 82.5, reps: 8 }, { id: 's8', weight: 85, reps: 6 }],
          },
          {
            id: 'seed-wk-6',
            exerciseId: 'ex-squat',
            sets: [{ id: 's9', weight: 112.5, reps: 8 }],
          },
        ],
        '2026-10-30': [
          {
            id: 'seed-wk-7',
            exerciseId: 'ex-bench',
            sets: [{ id: 's10', weight: 85, reps: 8 }, { id: 's11', weight: 87.5, reps: 6 }],
          },
          {
            id: 'seed-wk-8',
            exerciseId: 'ex-squat',
            sets: [{ id: 's12', weight: 117.5, reps: 8 }],
          },
        ],
      },

      upsertExercise: (ex) =>
        set((s) => {
          const exists = s.exercises.some((e) => e.id === ex.id);
          return {
            exercises: exists ? s.exercises.map((e) => (e.id === ex.id ? ex : e)) : [...s.exercises, ex],
          };
        }),
      deleteExercise: (id) => set((s) => ({ exercises: s.exercises.filter((e) => e.id !== id) })),

      setDayWorkout: (date, exercises) =>
        set((s) => ({ workoutLogs: { ...s.workoutLogs, [date]: exercises } })),
      // Medidas Corporales (Semillas con historial para gráfica de crecimiento)
      measurementLogs: {
        '2026-09-15': {
          chest: 99.5,
          right_arm: 34.5,
          left_arm: 34.0,
          waist: 83.5,
          right_thigh: 56.0,
          left_thigh: 56.0,
          glutes: 95.5,
          back: 106.5,
          right_calf: 36.0,
          left_calf: 36.0,
          right_forearm: 28.0,
          left_forearm: 28.0,
        },
        '2026-10-10': {
          chest: 100.8,
          right_arm: 35.2,
          left_arm: 34.8,
          waist: 82.2,
          right_thigh: 57.0,
          left_thigh: 57.0,
          glutes: 96.8,
          back: 108.2,
          right_calf: 36.5,
          left_calf: 36.5,
          right_forearm: 28.5,
          left_forearm: 28.5,
        },
        '2026-10-24': {
          chest: 101.6,
          right_arm: 35.8,
          left_arm: 35.3,
          waist: 81.4,
          right_thigh: 57.6,
          left_thigh: 57.6,
          glutes: 97.6,
          back: 109.5,
          right_calf: 36.8,
          left_calf: 36.8,
          right_forearm: 28.8,
          left_forearm: 28.8,
        },
        '2026-10-30': {
          chest: 102,
          right_arm: 36,
          left_arm: 35.5,
          waist: 81,
          right_thigh: 58,
          left_thigh: 58,
          glutes: 98,
          back: 110,
          right_calf: 37,
          left_calf: 37,
          right_forearm: 29,
          left_forearm: 29,
        },
      },
      setPartMeasurement: (date, part, value) =>
        set((s) => ({
          measurementLogs: {
            ...s.measurementLogs,
            [date]: {
              ...(s.measurementLogs[date] || {}),
              [part]: value,
            },
          },
        })),
      deletePartMeasurement: (date, part) =>
        set((s) => {
          const current = { ...(s.measurementLogs[date] || {}) };
          delete current[part];
          return {
            measurementLogs: {
              ...s.measurementLogs,
              [date]: current,
            },
          };
        }),

      // Peso Corporal
      weightLogs: {
        '2026-09-15': 74.0,
        '2026-10-10': 75.1,
        '2026-10-24': 75.8,
        '2026-10-30': 76.4,
      },
      setDayWeight: (date, weight) =>
        set((s) => ({
          weightLogs: {
            ...s.weightLogs,
            [date]: weight,
          },
        })),
      deleteDayWeight: (date) =>
        set((s) => {
          const current = { ...s.weightLogs };
          delete current[date];
          return { weightLogs: current };
        }),

      // Grasa Corporal (% de grasa)
      bodyFatLogs: {
        '2026-09-15': 16.2,
        '2026-10-10': 15.6,
        '2026-10-24': 15.1,
        '2026-10-30': 14.8,
      },
      setDayBodyFat: (date, bodyFat) =>
        set((s) => ({
          bodyFatLogs: {
            ...s.bodyFatLogs,
            [date]: bodyFat,
          },
        })),
      deleteDayBodyFat: (date) =>
        set((s) => {
          const current = { ...s.bodyFatLogs };
          delete current[date];
          return { bodyFatLogs: current };
        }),

      // Fotos de Progreso
      photoLogs: {},
      addProgressPhoto: (date, photo) =>
        set((s) => {
          const existing = (s.photoLogs[date] || []).filter((p) => p.angle !== photo.angle);
          return {
            photoLogs: {
              ...s.photoLogs,
              [date]: [...existing, photo],
            },
          };
        }),
      deleteProgressPhoto: (date, photoId) =>
        set((s) => ({
          photoLogs: {
            ...s.photoLogs,
            [date]: (s.photoLogs[date] || []).filter((p) => p.id !== photoId),
          },
        })),

      // Bienestar: Suplementos
      supplements: SEED_SUPPLEMENTS,
      supplementLogs: {},

      addSupplement: (name, dailyTarget, startDate) =>
        set((s) => ({
          supplements: [
            ...s.supplements,
            {
              id: uid(),
              name: name.trim(),
              dailyTarget: Math.max(1, Math.min(10, Math.round(dailyTarget || 1))),
              startDate,
            },
          ],
        })),

      updateSupplement: (id, patch, effectiveDate) =>
        set((s) => {
          const targetIdx = s.supplements.findIndex((item) => item.id === id);
          if (targetIdx === -1) return {};
          const target = s.supplements[targetIdx];
          const nextName = patch.name !== undefined ? patch.name.trim() : target.name;
          const nextTarget =
            patch.dailyTarget !== undefined
              ? Math.max(1, Math.min(10, Math.round(patch.dailyTarget)))
              : target.dailyTarget;

          if (target.name === nextName && target.dailyTarget === nextTarget) {
            return {};
          }

          const start = target.startDate || '0000-01-01';
          if (start >= effectiveDate) {
            // Creado en esta misma fecha (o posterior): actualizamos en el mismo registro sin afectar días pasados
            const nextSupplements = [...s.supplements];
            nextSupplements[targetIdx] = {
              ...target,
              name: nextName,
              dailyTarget: nextTarget,
            };
            return { supplements: nextSupplements };
          }

          // Creado en días pasados: cerramos el historial anterior hasta effectiveDate y abrimos el nuevo desde effectiveDate
          const newId = uid();
          const closedOld: Supplement = {
            ...target,
            removedFromDate: effectiveDate,
            alarmNotificationId: undefined,
          };
          const openedNew: Supplement = {
            id: newId,
            name: nextName,
            dailyTarget: nextTarget,
            startDate: effectiveDate,
            removedFromDate: target.removedFromDate,
            alarmTime: target.alarmTime,
            alarmNotificationId: target.alarmNotificationId,
            alarmSound: target.alarmSound,
          };

          const nextSupplements = [...s.supplements];
          nextSupplements.splice(targetIdx, 1, closedOld, openedNew);

          // Conservamos los checks ya marcados en effectiveDate o fechas futuras pasándolos al nuevo id
          let nextLogs = s.supplementLogs;
          let logsChanged = false;
          for (const [d, dayMap] of Object.entries(s.supplementLogs)) {
            if (
              d >= effectiveDate &&
              (!target.removedFromDate || d < target.removedFromDate) &&
              dayMap[id]
            ) {
              if (!logsChanged) {
                nextLogs = { ...s.supplementLogs };
                logsChanged = true;
              }
              const oldChecks = dayMap[id];
              const migratedChecks = Array.from({ length: nextTarget }, (_, i) =>
                Boolean(oldChecks[i]),
              );
              const updatedDayMap = { ...dayMap, [newId]: migratedChecks };
              delete updatedDayMap[id];
              nextLogs[d] = updatedDayMap;
            }
          }

          return logsChanged
            ? { supplements: nextSupplements, supplementLogs: nextLogs }
            : { supplements: nextSupplements };
        }),

      deleteSupplement: (id, fromDate) =>
        set((s) => {
          const nextSupplements: Supplement[] = [];
          for (const item of s.supplements) {
            if (item.id !== id) {
              nextSupplements.push(item);
              continue;
            }
            const start = item.startDate || '0000-01-01';
            // Si fue agregado hoy o después de fromDate, nunca existió en días pasados (< fromDate)
            if (start >= fromDate) {
              continue;
            }
            // Se quita de fromDate y días futuros, pero se conserva intacto en días pasados (< fromDate)
            const nextRemovedFrom =
              item.removedFromDate && item.removedFromDate < fromDate
                ? item.removedFromDate
                : fromDate;
            nextSupplements.push({
              ...item,
              removedFromDate: nextRemovedFrom,
              alarmTime: undefined,
              alarmNotificationId: undefined,
            });
          }
          return { supplements: nextSupplements };
        }),

      setSupplementAlarm: (id, alarmTime, alarmNotificationId, alarmSound) =>
        set((s) => ({
          supplements: s.supplements.map((item) =>
            item.id === id
              ? {
                  ...item,
                  alarmTime,
                  alarmNotificationId,
                  alarmSound: alarmSound !== undefined ? alarmSound : item.alarmSound,
                }
              : item,
          ),
        })),

      toggleSupplementDose: (date, supplementId, doseIndex, targetCount) =>
        set((s) => {
          const dayMap = { ...(s.supplementLogs[date] || {}) };
          const currentArr = Array.from({ length: targetCount }, (_, i) =>
            Boolean(dayMap[supplementId]?.[i])
          );
          if (doseIndex >= 0 && doseIndex < targetCount) {
            currentArr[doseIndex] = !currentArr[doseIndex];
          }
          dayMap[supplementId] = currentArr;
          return {
            supplementLogs: {
              ...s.supplementLogs,
              [date]: dayMap,
            },
          };
        }),

      // Bienestar: Salud
      healthMetrics: SEED_HEALTH_METRICS,
      healthLogs: SEED_HEALTH_LOGS,

      setHealthLog: (date, metricId, entry) =>
        set((s) => {
          const logs = s.healthLogs || {};
          return {
            healthLogs: {
              ...logs,
              [date]: {
                ...(logs[date] || {}),
                [metricId]: entry,
              },
            },
          };
        }),

      addHealthMetric: (metric) =>
        set((s) => ({
          healthMetrics: [
            ...(s.healthMetrics || SEED_HEALTH_METRICS),
            {
              ...metric,
              id: uid(),
              custom: true,
            },
          ],
        })),

      deleteHealthMetric: (id) =>
        set((s) => ({
          healthMetrics: (s.healthMetrics || SEED_HEALTH_METRICS).filter((m) => m.id !== id),
        })),

      // Bienestar: Sueño y Smartband
      sleepLogs: SEED_SLEEP_LOGS,

      setSleepLog: (date, entry) =>
        set((s) => ({
          sleepLogs: {
            ...(s.sleepLogs || SEED_SLEEP_LOGS),
            [date]: entry,
          },
        })),

      syncWatchData: (date, customData) =>
        set((s) => {
          const today = dateKey(new Date());
          if (date > today) {
            // No permitir sincronizar fechas futuras
            return s;
          }
          const current = s.sleepLogs?.[date] || SEED_SLEEP_LOGS[date] || {
            hours: 7,
            minutes: 35,
            bedtime: '23:20',
            wakeTime: '07:10',
            deepSleepHours: 1.8,
            lightSleepHours: 4.3,
            remSleepHours: 1.5,
            awakeMinutes: 16,
            sleepScore: 87,
            activeCaloriesBurned: 535,
            steps: 8350,
            restingHeartRate: 58,
          };
          const now = new Date();
          const hours12 = now.getHours() % 12 || 12;
          const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
          const timeStr = `Hoy, ${String(hours12).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${ampm}`;
          const updated: SleepLogEntry = {
            ...current,
            ...customData,
            syncedFromDevice: true,
            deviceName: 'Xiaomi Smart Band (Apple Health)',
            source: 'apple_health',
            lastSyncedAt: timeStr,
          };
          return {
            sleepLogs: {
              ...(s.sleepLogs || SEED_SLEEP_LOGS),
              [date]: updated,
            },
          };
        }),

      // Perfil del Usuario
      userProfile: DEFAULT_USER_PROFILE,
      setUserProfile: (profile) =>
        set((s) => ({
          userProfile: { ...(s.userProfile || DEFAULT_USER_PROFILE), ...profile },
          authUser: s.authUser && profile.avatarUri ? { ...s.authUser, avatarUrl: profile.avatarUri } : s.authUser,
        })),

      // Metas & Objetivos
      goals: SEED_GOALS,
      addGoal: (goal) =>
        set((s) => ({
          goals: [
            {
              ...goal,
              id: uid(),
              createdAt: new Date().toISOString().split('T')[0],
              completed: false,
            },
            ...(s.goals || []),
          ],
        })),
      updateGoal: (id, updates) =>
        set((s) => ({
          goals: (s.goals || []).map((g) => (g.id === id ? { ...g, ...updates } : g)),
        })),
      deleteGoal: (id) =>
        set((s) => ({
          goals: (s.goals || []).filter((g) => g.id !== id),
        })),
      toggleGoalCompleted: (id) =>
        set((s) => ({
          goals: (s.goals || []).map((g) =>
            g.id === id
              ? {
                  ...g,
                  completed: !g.completed,
                  completedAt: !g.completed ? new Date().toISOString().split('T')[0] : undefined,
                }
              : g,
          ),
        })),

      // Configuración de Privacidad
      privacySettings: DEFAULT_PRIVACY_SETTINGS,
      updatePrivacySettings: (settings) =>
        set((s) => ({
          privacySettings: { ...s.privacySettings, ...settings },
        })),

      // Amigos & Comunidad
      friends: [],
      friendNotifications: [],
      sentWorkoutInvites: [],
      sentChallenges: [],

      addFriend: (friend) =>
        set((s) => {
          if (s.authToken) {
            apiAddFriend(s.authToken, { friendId: friend.id, friendNickname: friend.nickname }).catch(() => {});
          }
          return {
            friends: s.friends.some((f) => f.id === friend.id) ? s.friends : [...s.friends, friend],
          };
        }),

      removeFriend: (friendId) =>
        set((s) => {
          if (s.authToken) {
            apiRemoveFriend(s.authToken, friendId).catch(() => {});
          }
          return {
            friends: s.friends.filter((f) => f.id !== friendId),
          };
        }),

      acceptFriendRequest: (notificationId) =>
        set((s) => {
          const notif = s.friendNotifications.find((n) => n.id === notificationId);
          if (!notif) return s;
          // Buscar si está en discoverable users o construir friend a partir del notif
          const disc = DISCOVERABLE_USERS.find((u) => u.id === notif.senderId);
          const newFriend: FriendUser = disc || {
            id: notif.senderId,
            name: notif.senderName,
            nickname: notif.senderNickname,
            streak: 10,
            level: notif.senderLevel,
            rank: notif.senderRank,
            todayWorkout: 'Entrenamiento Completado 🔥',
            color: notif.senderColor,
            initials: notif.senderInitials,
            metrics: {
              currentWeight: 75,
              bodyFat: 15,
              avgCalories: 2600,
              avgProtein: 160,
              prs: [{ exercise: 'Press Banca', weight: 100, reps: 5, date: '2026-10-25' }],
              recentWorkouts: [{ id: 'w-rec-1', date: 'Ayer', title: 'Fuerza General', durationMinutes: 60, exercises: ['Press Banca', 'Sentadilla'], totalSets: 12 }],
              activeGoal: 'Superar sus límites este mes',
            },
          };

          const alreadyFriend = s.friends.some((f) => f.id === newFriend.id);
          const updatedFriends = alreadyFriend ? s.friends : [...s.friends, newFriend];

          if (s.authToken) {
            apiRespondFriendRequest(s.authToken, notificationId, true).catch(() => {});
            apiAddFriend(s.authToken, { friendId: notif.senderId, friendNickname: notif.senderNickname }).catch(() => {});
          }

          return {
            friends: updatedFriends,
            friendNotifications: s.friendNotifications.map((n) =>
              n.id === notificationId ? { ...n, status: 'accepted', read: true } : n
            ),
          };
        }),

      rejectFriendRequest: (notificationId) =>
        set((s) => {
          if (s.authToken) {
            apiRespondFriendRequest(s.authToken, notificationId, false).catch(() => {});
          }
          return {
            friendNotifications: s.friendNotifications.map((n) =>
              n.id === notificationId ? { ...n, status: 'rejected', read: true } : n
            ),
          };
        }),

      sendWorkoutInvite: (invite) =>
        set((s) => {
          const newInvite: WorkoutInvite = {
            ...invite,
            id: 'inv-' + Date.now(),
            status: 'pending',
            createdAt: new Date().toISOString(),
          };
          if (s.authToken && invite.friendId) {
            apiSendWorkoutInvite(s.authToken, {
              receiverId: invite.friendId,
              workoutType: invite.workoutType,
              targetDate: invite.date,
              targetTime: invite.time,
              location: invite.location,
              note: invite.note,
            }).catch(() => {});
          }
          return {
            sentWorkoutInvites: [newInvite, ...(s.sentWorkoutInvites || [])],
            friendNotifications: [
              {
                id: 'notif-sent-' + Date.now(),
                type: 'activity',
                senderId: 'me',
                senderName: 'Tú',
                senderNickname: '@yo',
                senderColor: '#3B82F6',
                senderInitials: 'TÚ',
                senderLevel: 1,
                senderRank: 'Atleta',
                date: 'Ahora mismo',
                read: true,
                status: 'accepted',
                message: `Enviaste invitación a ${invite.friendName} para ${invite.workoutType} el ${invite.date} a las ${invite.time}.`,
              },
              ...s.friendNotifications,
            ],
          };
        }),

      respondWorkoutInvite: (notificationId, accept) =>
        set((s) => {
          if (s.authToken) {
            apiRespondWorkoutInvite(s.authToken, notificationId, accept).catch(() => {});
          }
          return {
            friendNotifications: s.friendNotifications.map((n) =>
              n.id === notificationId ? { ...n, status: accept ? 'accepted' : 'rejected', read: true } : n
            ),
          };
        }),

      sendChallenge: (challenge) =>
        set((s) => {
          const newChallenge: FriendChallenge = {
            id: 'chal-' + Date.now(),
            friendId: challenge.friendId,
            friendName: challenge.friendName,
            friendNickname: challenge.friendNickname,
            details: challenge.details,
            status: 'pending',
            createdAt: new Date().toISOString(),
          };
          if (s.authToken && challenge.friendId) {
            apiSendChallenge(s.authToken, {
              receiverId: challenge.friendId,
              targetDate: challenge.details.targetDate,
              variableType: challenge.details.variableType,
              variableLabel: challenge.details.variableLabel,
              muscleOrExercise: challenge.details.muscleOrExercise,
              message: challenge.details.message,
            }).catch(() => {});
          }
          return {
            sentChallenges: [newChallenge, ...(s.sentChallenges || [])],
            friendNotifications: [
              {
                id: 'notif-chal-sent-' + Date.now(),
                type: 'activity',
                senderId: 'me',
                senderName: 'Tú',
                senderNickname: '@yo',
                senderColor: '#EF4444',
                senderInitials: 'TÚ',
                senderLevel: 1,
                senderRank: 'Atleta',
                date: 'Ahora mismo',
                read: true,
                status: 'accepted',
                message: `Retaste a ${challenge.friendName} (${challenge.friendNickname}) en ${challenge.details.variableLabel}${challenge.details.muscleOrExercise ? ' [' + challenge.details.muscleOrExercise + ']' : ''} para ${challenge.details.targetDate} (Duelo 1 vs 1: +50 XP / -25 XP).`,
              },
              ...s.friendNotifications,
            ],
          };
        }),

      respondChallenge: (notificationId, accept) =>
        set((s) => {
          if (s.authToken) {
            apiRespondChallenge(s.authToken, notificationId, accept).catch(() => {});
          }
          return {
            friendNotifications: s.friendNotifications.map((n) =>
              n.id === notificationId
                ? { ...n, status: accept ? 'accepted' : 'rejected', read: true }
                : n
            ),
          };
        }),

      markNotificationsAsRead: () =>
        set((s) => {
          if (s.authToken) {
            apiMarkNotificationsRead(s.authToken).catch(() => {});
          }
          return {
            friendNotifications: s.friendNotifications.map((n) => ({ ...n, read: true })),
          };
        }),

      sendFriendRequestTo: (user) =>
        set((s) => {
          if (s.authToken) {
            apiSendFriendRequest(s.authToken, {
              receiverId: user.id,
              receiverNickname: user.nickname,
            }).catch(() => {});
            apiAddFriend(s.authToken, {
              friendId: user.id,
              friendNickname: user.nickname,
            }).catch(() => {});
          }
          const already = s.friends.some((f) => f.id === user.id);
          const updatedFriends = already ? s.friends : [...s.friends, user];

          return {
            friends: updatedFriends,
            friendNotifications: [
              {
                id: 'req-' + Date.now(),
                type: 'activity',
                senderId: 'me',
                senderName: 'Tú',
                senderNickname: '@yo',
                senderColor: '#10B981',
                senderInitials: 'TÚ',
                senderLevel: 1,
                senderRank: 'Atleta',
                date: 'Ahora mismo',
                read: true,
                status: 'accepted',
                message: `Agregaste a ${user.name} (${user.nickname}) a tus amigos.`,
              },
              ...s.friendNotifications,
            ],
          };
        }),

      setFriendsFromDb: (friends) => set({ friends }),
      setNotificationsFromDb: (notifications) => set({ friendNotifications: notifications }),

      // Personalización
      activePaletteId: 'default',
      customPalettes: [],
      deletedPaletteIds: [],
      typography: DEFAULT_TYPOGRAPHY,
      homeWidgets: DEFAULT_HOME_WIDGETS,

      setActivePalette: (id) => set({ activePaletteId: id }),

      addCustomPalette: (palette) =>
        set((s) => {
          const rawColors =
            palette.colors && palette.colors.length >= 2
              ? palette.colors.slice(0, 5)
              : [palette.primary || '#8B5CF6', palette.secondary || '#F472B6'];
          const primary = rawColors[0] || palette.primary || '#8B5CF6';
          const secondary = rawColors[1] || palette.secondary || '#F472B6';
          const newP: ColorPalette = {
            ...palette,
            colors: rawColors,
            primary,
            secondary,
            accent: primary,
            id: uid(),
            custom: true,
          };
          return {
            customPalettes: [...(s.customPalettes || []), newP],
            activePaletteId: newP.id,
          };
        }),

      updatePalette: (id, updates) =>
        set((s) => {
          const customExists = (s.customPalettes || []).some((p) => p.id === id);
          let updatedCustoms: ColorPalette[];

          if (customExists) {
            updatedCustoms = (s.customPalettes || []).map((p) => {
              if (p.id !== id) return p;
              const newColors = updates.colors || p.colors;
              const primary = newColors[0] || updates.primary || p.primary;
              const secondary = newColors[1] || updates.secondary || p.secondary;
              return {
                ...p,
                ...updates,
                colors: newColors,
                primary,
                secondary,
                accent: primary,
              };
            });
          } else {
            const preset = PRESET_PALETTES.find((p) => p.id === id);
            if (!preset) return s;
            const newColors = updates.colors || preset.colors;
            const primary = newColors[0] || updates.primary || preset.primary;
            const secondary = newColors[1] || updates.secondary || preset.secondary;
            const overriddenPreset: ColorPalette = {
              ...preset,
              ...updates,
              colors: newColors,
              primary,
              secondary,
              accent: primary,
              custom: true,
            };
            updatedCustoms = [...(s.customPalettes || []), overriddenPreset];
          }

          return {
            customPalettes: updatedCustoms,
          };
        }),

      deleteCustomPalette: (id) =>
        set((s) => {
          const newDeleted = Array.from(new Set([...(s.deletedPaletteIds || []), id]));
          const newCustoms = (s.customPalettes || []).filter((p) => p.id !== id);
          let nextActiveId = s.activePaletteId;
          if (s.activePaletteId === id) {
            const availableCustom = newCustoms.find((p) => !newDeleted.includes(p.id));
            const availablePreset = PRESET_PALETTES.find((p) => !newDeleted.includes(p.id));
            nextActiveId = availableCustom?.id || availablePreset?.id || 'default';
          }
          return {
            deletedPaletteIds: newDeleted,
            customPalettes: newCustoms,
            activePaletteId: nextActiveId,
          };
        }),

      deletePalette: (id) =>
        set((s) => {
          const newDeleted = Array.from(new Set([...(s.deletedPaletteIds || []), id]));
          const newCustoms = (s.customPalettes || []).filter((p) => p.id !== id);
          let nextActiveId = s.activePaletteId;
          if (s.activePaletteId === id) {
            const availableCustom = newCustoms.find((p) => !newDeleted.includes(p.id));
            const availablePreset = PRESET_PALETTES.find((p) => !newDeleted.includes(p.id));
            nextActiveId = availableCustom?.id || availablePreset?.id || 'default';
          }
          return {
            deletedPaletteIds: newDeleted,
            customPalettes: newCustoms,
            activePaletteId: nextActiveId,
          };
        }),

      setTypography: (settings) =>
        set((s) => ({
          typography: { ...(s.typography || DEFAULT_TYPOGRAPHY), ...settings },
        })),

      toggleHomeWidget: (widgetKey) =>
        set((s) => {
          const current = s.homeWidgets || DEFAULT_HOME_WIDGETS;
          return {
            homeWidgets: {
              ...current,
              [widgetKey]: !current[widgetKey],
            },
          };
        }),

      // Autenticación & Sesión
      authToken: null,
      authUser: null,
      isAuthenticated: false,
      setAuth: (token, user) =>
        set((s) => ({
          authToken: token,
          authUser: user,
          isAuthenticated: true,
          userProfile: {
            ...(s.userProfile || DEFAULT_USER_PROFILE),
            name: user.name || s.userProfile?.name || 'Usuario',
            nickname: user.nickname || s.userProfile?.nickname || 'Atleta',
          },
        })),
      logout: () =>
        set({
          authToken: null,
          authUser: null,
          isAuthenticated: false,
          ingredients: SEED_INGREDIENTS,
          savedMeals: [],
          logs: {},
          exercises: SEED_EXERCISES,
          workoutLogs: {},
          measurementLogs: {},
          weightLogs: {},
          bodyFatLogs: {},
          photoLogs: {},
          supplements: SEED_SUPPLEMENTS,
          supplementLogs: {},
          healthMetrics: SEED_HEALTH_METRICS,
          healthLogs: SEED_HEALTH_LOGS,
          sleepLogs: SEED_SLEEP_LOGS,
          userProfile: DEFAULT_USER_PROFILE,
          goals: SEED_GOALS,
          privacySettings: DEFAULT_PRIVACY_SETTINGS,
          friends: [],
          friendNotifications: [],
          sentWorkoutInvites: [],
          sentChallenges: [],
          activePaletteId: 'default',
          customPalettes: [],
          deletedPaletteIds: [],
          typography: DEFAULT_TYPOGRAPHY,
          homeWidgets: DEFAULT_HOME_WIDGETS,
          syncStatus: 'idle',
          lastSyncedAt: null,
          syncError: null,
        }),

      // Sincronización con Base de Datos
      syncStatus: 'idle',
      lastSyncedAt: null,
      syncError: null,
      setSyncStatus: (status, lastSyncedAt, syncError) =>
        set((s) => ({
          syncStatus: status,
          lastSyncedAt: lastSyncedAt !== undefined ? lastSyncedAt : s.lastSyncedAt,
          syncError: syncError !== undefined ? syncError : null,
        })),
      applyRemoteData: (records) =>
        set((s) => {
          const updates: Partial<State> = {};
          if (records.ingredients && Array.isArray(records.ingredients)) updates.ingredients = records.ingredients;
          if (records.savedMeals && Array.isArray(records.savedMeals)) updates.savedMeals = records.savedMeals;
          if (records.logs && typeof records.logs === 'object') updates.logs = records.logs;
          if (records.exercises && Array.isArray(records.exercises)) updates.exercises = records.exercises;
          if (records.workoutLogs && typeof records.workoutLogs === 'object') updates.workoutLogs = records.workoutLogs;
          if (records.measurementLogs && typeof records.measurementLogs === 'object') updates.measurementLogs = records.measurementLogs;
          if (records.weightLogs && typeof records.weightLogs === 'object') updates.weightLogs = records.weightLogs;
          if (records.bodyFatLogs && typeof records.bodyFatLogs === 'object') updates.bodyFatLogs = records.bodyFatLogs;
          if (records.photoLogs && typeof records.photoLogs === 'object') updates.photoLogs = records.photoLogs;
          if (records.supplements && Array.isArray(records.supplements)) updates.supplements = records.supplements;
          if (records.supplementLogs && typeof records.supplementLogs === 'object') updates.supplementLogs = records.supplementLogs;
          if (records.healthMetrics && Array.isArray(records.healthMetrics)) updates.healthMetrics = records.healthMetrics;
          if (records.healthLogs && typeof records.healthLogs === 'object') updates.healthLogs = records.healthLogs;
          if (records.sleepLogs && typeof records.sleepLogs === 'object') updates.sleepLogs = records.sleepLogs;
          if (records.userProfile && typeof records.userProfile === 'object') updates.userProfile = records.userProfile;
          if (records.goals && Array.isArray(records.goals)) updates.goals = records.goals;
          if (records.activePaletteId && typeof records.activePaletteId === 'string') updates.activePaletteId = records.activePaletteId;
          if (records.customPalettes && Array.isArray(records.customPalettes)) updates.customPalettes = records.customPalettes;
          if (records.deletedPaletteIds && Array.isArray(records.deletedPaletteIds)) updates.deletedPaletteIds = records.deletedPaletteIds;
          if (records.typography && typeof records.typography === 'object') updates.typography = records.typography;
          if (records.homeWidgets && typeof records.homeWidgets === 'object') updates.homeWidgets = records.homeWidgets;
          if (records.privacySettings && typeof records.privacySettings === 'object') updates.privacySettings = records.privacySettings;
          if (records.friends && Array.isArray(records.friends)) updates.friends = records.friends;
          if (records.friendNotifications && Array.isArray(records.friendNotifications)) updates.friendNotifications = records.friendNotifications;
          if (records.sentWorkoutInvites && Array.isArray(records.sentWorkoutInvites)) updates.sentWorkoutInvites = records.sentWorkoutInvites;
          if (records.sentChallenges && Array.isArray(records.sentChallenges)) updates.sentChallenges = records.sentChallenges;
          return updates;
        }),
      resetUserData: () =>
        set({
          ingredients: SEED_INGREDIENTS,
          savedMeals: [],
          logs: {},
          exercises: SEED_EXERCISES,
          workoutLogs: {},
          measurementLogs: {},
          weightLogs: {},
          bodyFatLogs: {},
          photoLogs: {},
          supplements: SEED_SUPPLEMENTS,
          supplementLogs: {},
          healthMetrics: SEED_HEALTH_METRICS,
          healthLogs: SEED_HEALTH_LOGS,
          sleepLogs: SEED_SLEEP_LOGS,
          userProfile: DEFAULT_USER_PROFILE,
          activePaletteId: 'default',
          customPalettes: [],
          deletedPaletteIds: [],
          typography: DEFAULT_TYPOGRAPHY,
          homeWidgets: DEFAULT_HOME_WIDGETS,
          syncStatus: 'idle',
          lastSyncedAt: null,
          syncError: null,
        }),
    }),
    {
      name: 'evolve-app-data',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...(persistedState || {}),
        authToken: persistedState?.authToken || null,
        authUser: persistedState?.authUser || null,
        isAuthenticated: Boolean(persistedState?.authToken && persistedState?.authUser),
        exercises:
          persistedState && Array.isArray(persistedState.exercises) && persistedState.exercises.length > 0
            ? (() => {
                const existingIds = new Set(persistedState.exercises.map((e: any) => e.id));
                const missingSeeds = SEED_EXERCISES.filter((s) => !existingIds.has(s.id));
                return [...persistedState.exercises, ...missingSeeds];
              })()
            : SEED_EXERCISES,
        healthMetrics:
          persistedState && Array.isArray(persistedState.healthMetrics) && persistedState.healthMetrics.length > 0
            ? persistedState.healthMetrics
            : SEED_HEALTH_METRICS,
        healthLogs:
          persistedState && persistedState.healthLogs && Object.keys(persistedState.healthLogs).length > 0
            ? persistedState.healthLogs
            : SEED_HEALTH_LOGS,
        sleepLogs:
          persistedState && persistedState.sleepLogs && Object.keys(persistedState.sleepLogs).length > 0
            ? persistedState.sleepLogs
            : SEED_SLEEP_LOGS,
        bodyFatLogs:
          persistedState && persistedState.bodyFatLogs && Object.keys(persistedState.bodyFatLogs).length > 0
            ? persistedState.bodyFatLogs
            : currentState.bodyFatLogs,
        userProfile: { ...DEFAULT_USER_PROFILE, ...(persistedState?.userProfile || {}) },
        goals: Array.isArray(persistedState?.goals) ? persistedState.goals : (currentState.goals || SEED_GOALS),
        privacySettings: { ...DEFAULT_PRIVACY_SETTINGS, ...(persistedState?.privacySettings || {}) },
        friends: Array.isArray(persistedState?.friends) ? (persistedState.friends as FriendUser[]).filter((f: FriendUser) => !f.id.startsWith('f-') || !SEED_FRIENDS.some((sf) => sf.id === f.id)) : (currentState.friends || []),
        friendNotifications: Array.isArray(persistedState?.friendNotifications) ? (persistedState.friendNotifications as FriendNotification[]).filter((n: FriendNotification) => !n.id.startsWith('notif-chal-demo') && !n.id.startsWith('notif-1') && !n.id.startsWith('notif-2') && !n.id.startsWith('notif-act-1')) : (currentState.friendNotifications || []),
        sentWorkoutInvites: Array.isArray(persistedState?.sentWorkoutInvites) ? persistedState.sentWorkoutInvites : (currentState.sentWorkoutInvites || []),
        sentChallenges: Array.isArray(persistedState?.sentChallenges) ? persistedState.sentChallenges : [],
        activePaletteId: persistedState?.activePaletteId || 'default',
        customPalettes: Array.isArray(persistedState?.customPalettes) ? persistedState.customPalettes : [],
        deletedPaletteIds: Array.isArray(persistedState?.deletedPaletteIds) ? persistedState.deletedPaletteIds : [],
        typography: { ...DEFAULT_TYPOGRAPHY, ...(persistedState?.typography || {}) },
        homeWidgets: { ...DEFAULT_HOME_WIDGETS, ...(persistedState?.homeWidgets || {}) },
      }),
    },
  ),
);
