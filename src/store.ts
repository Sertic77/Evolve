import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Macros = { kcal: number; carbs: number; protein: number; fat: number };

/** Valores nutricionales tal como vienen en el empaque, para `servingGrams` gramos. */
export type Ingredient = Macros & { id: string; name: string; servingGrams: number };

export type MealItem = { id: string; ingredientId: string | null; grams: number };
export type MealBlock = { id: string; name: string; items: MealItem[] };
export type SavedMeal = MealBlock;

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

type State = {
  ingredients: Ingredient[];
  savedMeals: SavedMeal[];
  logs: Record<string, MealBlock[]>;

  upsertIngredient: (ing: Ingredient) => void;
  deleteIngredient: (id: string) => void;
  upsertSavedMeal: (m: SavedMeal) => void;
  deleteSavedMeal: (id: string) => void;

  setDayMeals: (date: string, meals: MealBlock[]) => void;
};

const SEED: Ingredient[] = [
  { id: 'seed-pb', name: 'Mantequilla de maní', servingGrams: 50, kcal: 110, protein: 12, carbs: 5, fat: 17 },
  { id: 'seed-egg', name: 'Huevo', servingGrams: 50, kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { id: 'seed-rice', name: 'Arroz blanco cocido', servingGrams: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: 'seed-chicken', name: 'Pechuga de pollo', servingGrams: 100, kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: 'seed-oats', name: 'Avena', servingGrams: 40, kcal: 150, protein: 5, carbs: 27, fat: 3 },
];

export const useStore = create<State>()(
  persist(
    (set) => ({
      ingredients: SEED,
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
    }),
    { name: 'evolve-food', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
