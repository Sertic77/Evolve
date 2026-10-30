import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ==========================================================
   TIPOS DE COMIDA
========================================================== */
export type Macros = { kcal: number; carbs: number; protein: number; fat: number };

/** Valores nutricionales tal como vienen en el empaque, para `servingGrams` gramos. */
export type Ingredient = Macros & { id: string; name: string; servingGrams: number };

export type MealItem = { id: string; ingredientId: string | null; grams: number };
export type MealBlock = { id: string; name: string; items: MealItem[] };
export type SavedMeal = MealBlock;

/* ==========================================================
   TIPOS DE ENTRENAMIENTO
========================================================== */
export type Exercise = {
  id: string;
  name: string;
  muscleGroup: string; // ej. Pecho, Espalda, Piernas, Hombros, Brazos, Core
};

export type WorkoutSet = {
  id: string;
  weight: number; // en kg
  reps: number;
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
  | 'glutes'         // Nalgas
  | 'hands'          // Manos (no interactua)
  | 'feet';          // Pies (no interactua)

export type DayMeasurements = Partial<Record<BodyPartKey, number>>;

export type ProgressPhoto = {
  id: string;
  uri: string;
  angle: 'front' | 'side' | 'back';
  timestamp: number;
};

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
export const ZERO: Macros = { kcal: 0, carbs: 0, protein: 0, fat: 0 };

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Escala los macros del ingrediente a la cantidad indicada. */
export function scaleMacros(ing: Ingredient | undefined, grams: number): Macros {
  if (!ing || !ing.servingGrams || !grams) return ZERO;
  const f = grams / ing.servingGrams;
  return { kcal: ing.kcal * f, carbs: ing.carbs * f, protein: ing.protein * f, fat: ing.fat * f };
}

export const addMacros = (a: Macros, b: Macros): Macros => ({
  kcal: a.kcal + b.kcal,
  carbs: a.carbs + b.carbs,
  protein: a.protein + b.protein,
  fat: a.fat + b.fat,
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
  { id: 'seed-pb', name: 'Mantequilla de maní', servingGrams: 50, kcal: 110, protein: 12, carbs: 5, fat: 17 },
  { id: 'seed-egg', name: 'Huevo', servingGrams: 50, kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { id: 'seed-rice', name: 'Arroz blanco cocido', servingGrams: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: 'seed-chicken', name: 'Pechuga de pollo', servingGrams: 100, kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: 'seed-oats', name: 'Avena', servingGrams: 40, kcal: 150, protein: 5, carbs: 27, fat: 3 },
];

const SEED_EXERCISES: Exercise[] = [
  { id: 'ex-bench', name: 'Press de Banca Plano', muscleGroup: 'Pecho' },
  { id: 'ex-squat', name: 'Sentadilla con Barra', muscleGroup: 'Piernas' },
  { id: 'ex-deadlift', name: 'Peso Muerto', muscleGroup: 'Espalda' },
  { id: 'ex-pullup', name: 'Dominadas', muscleGroup: 'Espalda' },
  { id: 'ex-military', name: 'Press Militar', muscleGroup: 'Hombros' },
  { id: 'ex-curl', name: 'Curl de Bíceps', muscleGroup: 'Brazos' },
  { id: 'ex-dips', name: 'Fondos en Paralelas', muscleGroup: 'Pecho' },
  { id: 'ex-press', name: 'Prensa de Piernas', muscleGroup: 'Piernas' },
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

  // Peso Corporal
  weightLogs: Record<string, number>;
  setDayWeight: (date: string, weight: number) => void;
  deleteDayWeight: (date: string) => void;

  // Fotos de Progreso
  photoLogs: Record<string, ProgressPhoto[]>;
  addProgressPhoto: (date: string, photo: ProgressPhoto) => void;
  deleteProgressPhoto: (date: string, photoId: string) => void;

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
      workoutLogs: {},

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

    }),
    { name: 'evolve-app-data', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
