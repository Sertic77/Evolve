import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from './theme';
import {
  useStore, dateKey, itemsTotal, addMacros, ZERO, uid, Ingredient, MealBlock, SavedMeal,
} from './store';
import { MacroSummary, Segmented, DateSelector, MealBlockCard, PrimaryButton, MacroChips, s } from './components';

export default function FoodScreen() {
  const [tab, setTab] = useState(0);
  const [date, setDate] = useState(new Date());
  const key = dateKey(date);
  const { ingredients, logs } = useStore();
  const meals = logs[key] ?? [];
  const total = useMemo(
    () => meals.reduce((acc, m) => addMacros(acc, itemsTotal(m.items, ingredients)), ZERO),
    [meals, ingredients],
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>Comida</Text>
      <Text style={{ color: C.sub, marginBottom: 14 }}>Consumido el día seleccionado</Text>
      <MacroSummary m={total} />
      <Segmented options={['Agregar comidas', 'Ingredientes y comidas']} value={tab} onChange={setTab} />
      {tab === 0 ? <DayLog date={date} setDate={setDate} meals={meals} dayKey={key} /> : <Library />}
    </ScrollView>
  );
}

/* =============== Opción 1: registro del día =============== */
function DayLog({ date, setDate, meals, dayKey }: { date: Date; setDate: (d: Date) => void; meals: MealBlock[]; dayKey: string }) {
  const { ingredients, savedMeals, setDayMeals } = useStore();
  const [pick, setPick] = useState(false);
  const set = (m: MealBlock[]) => setDayMeals(dayKey, m);
  const defaultName = ['Desayuno', 'Almuerzo', 'Cena', 'Snack'][meals.length] ?? `Comida ${meals.length + 1}`;

  return (
    <View>
      <DateSelector date={date} onChange={setDate} />
      {meals.length === 0 && (
        <View style={[s.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <Ionicons name="restaurant-outline" size={36} color={C.sub} />
          <Text style={{ color: C.sub, marginTop: 8 }}>Aún no hay comidas este día</Text>
        </View>
      )}
      {meals.map((m, i) => (
        <MealBlockCard key={m.id} block={m} ingredients={ingredients} z={meals.length - i}
          onChange={(b) => set(meals.map((x) => (x.id === b.id ? b : x)))}
          onDelete={() => set(meals.filter((x) => x.id !== m.id))} />
      ))}
      <View style={[s.row, { gap: 10 }]}>
        <PrimaryButton icon="add-circle" label="Bloque de comida"
          onPress={() => set([...meals, { id: uid(), name: defaultName, items: [{ id: uid(), ingredientId: null, grams: 0 }] }])} />
        <PrimaryButton ghost icon="bookmark" label="Comida guardada" onPress={() => setPick(true)} />
      </View>

      <Modal visible={pick} transparent animationType="slide" onRequestClose={() => setPick(false)}>
        <Pressable style={s.backdrop} onPress={() => setPick(false)}>
          <Pressable style={s.card}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 10 }}>Elegir comida guardada</Text>
            {savedMeals.length === 0 && <Text style={{ color: C.sub }}>No tienes comidas guardadas. Créalas en "Ingredientes y comidas".</Text>}
            {savedMeals.map((sm) => (
              <Pressable key={sm.id} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border }}
                onPress={() => {
                  set([...meals, { id: uid(), name: sm.name, items: sm.items.map((it) => ({ ...it, id: uid() })) }]);
                  setPick(false);
                }}>
                <Text style={{ color: C.text, fontWeight: '700' }}>{sm.name}</Text>
                <MacroChips m={itemsTotal(sm.items, ingredients)} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* =============== Opción 2: biblioteca =============== */
function Library() {
  const [sub, setSub] = useState(0);
  return (
    <View style={{ marginTop: 14 }}>
      <Segmented options={['Ingredientes', 'Comidas guardadas']} value={sub} onChange={setSub} />
      <View style={{ height: 14 }} />
      {sub === 0 ? <IngredientsList /> : <SavedMealsList />}
    </View>
  );
}

const confirm = (msg: string, ok: () => void) => {
  if (Platform.OS === 'web') {
    if ((window as any).confirm(msg)) ok();
    return;
  }
  Alert.alert('Eliminar', msg, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: ok }]);
};

function IngredientsList() {
  const { ingredients, upsertIngredient, deleteIngredient } = useStore();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Ingredient | null>(null);
  const list = ingredients.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <View>
      <View style={[s.row, { gap: 10, marginBottom: 12 }]}>
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar…" placeholderTextColor={C.sub} style={[s.input, { flex: 1 }]} />
        <Pressable style={[s.iconBtn, { backgroundColor: C.accent, borderColor: C.accent }]}
          onPress={() => setEdit({ id: uid(), name: '', servingGrams: 100, kcal: 0, carbs: 0, protein: 0, fat: 0 })}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>
      {list.map((i) => (
        <Pressable key={i.id} style={s.card} onPress={() => setEdit(i)}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, flex: 1 }}>{i.name}</Text>
            <Text style={{ color: C.sub, fontSize: 12 }}>por {i.servingGrams} g</Text>
          </View>
          <MacroChips m={i} />
        </Pressable>
      ))}
      {edit && (
        <IngredientForm ing={edit} onClose={() => setEdit(null)}
          onSave={(i) => { upsertIngredient(i); setEdit(null); }}
          onDelete={ingredients.some((x) => x.id === edit.id)
            ? () => confirm(`¿Eliminar "${edit.name}"?`, () => { deleteIngredient(edit.id); setEdit(null); }) : undefined} />
      )}
    </View>
  );
}

function IngredientForm({ ing, onSave, onClose, onDelete }: {
  ing: Ingredient; onSave: (i: Ingredient) => void; onClose: () => void; onDelete?: () => void;
}) {
  const [f, setF] = useState<Record<string, string>>({
    name: ing.name, servingGrams: String(ing.servingGrams), kcal: String(ing.kcal),
    carbs: String(ing.carbs), protein: String(ing.protein), fat: String(ing.fat),
  });
  const num = (k: string) => parseFloat((f[k] || '0').replace(',', '.')) || 0;
  const field = (k: string, label: string, color?: string) => (
    <View style={{ flex: 1 }}>
      <Text style={[s.label, color && { color }]}>{label}</Text>
      <TextInput value={f[k]} onChangeText={(t) => setF({ ...f, [k]: t })} keyboardType="decimal-pad"
        selectTextOnFocus style={s.input} />
    </View>
  );
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '800' }}>{ing.name ? 'Editar ingrediente' : 'Nuevo ingrediente'}</Text>
          <Text style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>Copia los valores del empaque para la porción que indica.</Text>
          <Text style={s.label}>Nombre</Text>
          <TextInput value={f.name} onChangeText={(t) => setF({ ...f, name: t })} style={s.input}
            placeholder="Ej. Mantequilla de maní" placeholderTextColor={C.sub} />
          <View style={[s.row, { gap: 10 }]}>{field('servingGrams', 'Cantidad (g)')}{field('kcal', 'Calorías', C.kcal)}</View>
          <View style={[s.row, { gap: 10 }]}>
            {field('carbs', 'Carbos (g)', C.carbs)}{field('protein', 'Proteína (g)', C.protein)}{field('fat', 'Grasas (g)', C.fat)}
          </View>
          <View style={[s.row, { gap: 10, marginTop: 18 }]}>
            {onDelete && <PrimaryButton ghost icon="trash" label="Eliminar" onPress={onDelete} />}
            <PrimaryButton icon="checkmark" label="Guardar" onPress={() => {
              if (!f.name.trim() || num('servingGrams') <= 0) return;
              onSave({ id: ing.id, name: f.name.trim(), servingGrams: num('servingGrams'), kcal: num('kcal'),
                carbs: num('carbs'), protein: num('protein'), fat: num('fat') });
            }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SavedMealsList() {
  const { savedMeals, ingredients, upsertSavedMeal, deleteSavedMeal } = useStore();
  const [draft, setDraft] = useState<SavedMeal | null>(null);
  return (
    <View>
      {draft ? (
        <View>
          <MealBlockCard block={draft} ingredients={ingredients} onChange={setDraft} />
          <View style={[s.row, { gap: 10 }]}>
            <PrimaryButton ghost icon="close" label="Cancelar" onPress={() => setDraft(null)} />
            <PrimaryButton icon="checkmark" label="Guardar comida" onPress={() => {
              const items = draft.items.filter((i) => i.ingredientId && i.grams > 0);
              upsertSavedMeal({ ...draft, name: draft.name.trim() || 'Sin nombre', items });
              setDraft(null);
            }} />
          </View>
        </View>
      ) : (
        <>
          <PrimaryButton icon="add-circle" label="Nueva comida"
            onPress={() => setDraft({ id: uid(), name: 'Nueva comida', items: [{ id: uid(), ingredientId: null, grams: 0 }] })} />
          <View style={{ height: 14 }} />
          {savedMeals.length === 0 && <Text style={{ color: C.sub, textAlign: 'center' }}>Aún no tienes comidas guardadas</Text>}
          {savedMeals.map((m) => (
            <Pressable key={m.id} style={s.card} onPress={() => setDraft(JSON.parse(JSON.stringify(m)))}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>{m.name}</Text>
                <Pressable hitSlop={8} onPress={() => confirm(`¿Eliminar "${m.name}"?`, () => deleteSavedMeal(m.id))}>
                  <Ionicons name="trash-outline" size={18} color={C.danger} />
                </Pressable>
              </View>
              <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>
                {m.items.map((it) => ingredients.find((i) => i.id === it.ingredientId)?.name).filter(Boolean).join(' · ')}
              </Text>
              <MacroChips m={itemsTotal(m.items, ingredients)} />
            </Pressable>
          ))}
        </>
      )}
    </View>
  );
}
