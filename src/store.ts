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
    }),
    { name: 'evolve-app-data', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
