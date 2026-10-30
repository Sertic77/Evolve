import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ==========================================================
   TIPOS DE COMIDA
========================================================== */
export type Macros = { kcal: number; carbs: number; protein: number; fat: number };

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
  muscleGroup: string; // ej. Pecho, Espalda, Piernas, Hombros, Brazos, Core, CrossFit, Cardio
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

/* ==========================================================
   TIPOS DE BIENESTAR (SUEÑO Y SUPLEMENTOS)
========================================================== */
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
  { id: 'seed-pb', name: 'Mantequilla de maní', servingGrams: 50, kcal: 110, protein: 12, carbs: 5, fat: 17, unit: 'g' },
  { id: 'seed-egg', name: 'Huevo', servingGrams: 1, kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8, unit: 'ud' },
  { id: 'seed-milk', name: 'Leche entera', servingGrams: 200, kcal: 124, protein: 6.4, carbs: 9.6, fat: 6.8, unit: 'ml' },
  { id: 'seed-rice', name: 'Arroz blanco cocido', servingGrams: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, unit: 'g' },
  { id: 'seed-chicken', name: 'Pechuga de pollo', servingGrams: 100, kcal: 165, protein: 31, carbs: 0, fat: 3.6, unit: 'g' },
  { id: 'seed-oats', name: 'Avena', servingGrams: 40, kcal: 150, protein: 5, carbs: 27, fat: 3, unit: 'g' },
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

  // Peso Corporal
  weightLogs: Record<string, number>;
  setDayWeight: (date: string, weight: number) => void;
  deleteDayWeight: (date: string) => void;

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
    }),
    { name: 'evolve-app-data', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
