import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
  Platform,
  StyleSheet,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { C, GRADIENTS } from './theme';
import {
  useStore,
  dateKey,
  itemsTotal,
  addMacros,
  ZERO,
  uid,
  Ingredient,
  MealBlock,
  SavedMeal,
} from './store';
import {
  MacroSummary,
  Segmented,
  DateSelector,
  MealBlockCard,
  PrimaryButton,
  MacroChips,
  s,
} from './components';

export default function FoodScreen() {
  const [tab, setTab] = useState(0);
  const [date, setDate] = useState(new Date());
  const [quickCreateName, setQuickCreateName] = useState<string | null>(null);

  const key = dateKey(date);
  const { ingredients, logs, upsertIngredient } = useStore();
  const meals = logs[key] ?? [];

  const total = useMemo(
    () => meals.reduce((acc, m) => addMacros(acc, itemsTotal(m.items, ingredients)), ZERO),
    [meals, ingredients],
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header HUD Anime */}
        <View style={styles.topHeader}>
          <View>
            <View style={styles.cyberTagRow}>
              <View style={styles.cyberDot} />
              <Text style={styles.cyberTagText}>PROTOCOL // NUTRITION</Text>
            </View>
            <Text style={styles.screenTitle}>Comida</Text>
          </View>

          <View style={styles.dateChipMini}>
            <Ionicons name="time-outline" size={13} color={C.accentCyan} />
            <Text style={styles.dateChipMiniText}>
              {date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Resumen de Macros */}
        <MacroSummary m={total} />

        {/* Selector de Pestaña Principal */}
        <Segmented
          options={['Agregar comidas', 'Ingredientes y comidas']}
          value={tab}
          onChange={setTab}
        />

        {/* Contenido según pestaña */}
        {tab === 0 ? (
          <DayLog
            date={date}
            setDate={setDate}
            meals={meals}
            dayKey={key}
            onRequestCreateIngredient={(name) => setQuickCreateName(name)}
          />
        ) : (
          <Library onRequestCreateIngredient={(name) => setQuickCreateName(name)} />
        )}
      </ScrollView>

      {/* Modal de creación rápida si se activa desde el buscador */}
      {quickCreateName !== null && (
        <IngredientFormModal
          ing={{
            id: uid(),
            name: quickCreateName,
            servingGrams: 100,
            kcal: 0,
            carbs: 0,
            protein: 0,
            fat: 0,
          }}
          onClose={() => setQuickCreateName(null)}
          onSave={(newIng) => {
            upsertIngredient(newIng);
            setQuickCreateName(null);
          }}
        />
      )}
    </View>
  );
}

/* ==========================================================
   OPCIÓN 1: REGISTRO DEL DÍA
========================================================== */
function DayLog({
  date,
  setDate,
  meals,
  dayKey,
  onRequestCreateIngredient,
}: {
  date: Date;
  setDate: (d: Date) => void;
  meals: MealBlock[];
  dayKey: string;
  onRequestCreateIngredient: (name: string) => void;
}) {
  const { ingredients, savedMeals, setDayMeals } = useStore();
  const [pickModalOpen, setPickModalOpen] = useState(false);

  const setMeals = (m: MealBlock[]) => setDayMeals(dayKey, m);

  const defaultNames = ['Desayuno', 'Almuerzo', 'Cena', 'Snack', 'Post-Entreno'];
  const nextName = defaultNames[meals.length] ?? `Comida ${meals.length + 1}`;

  return (
    <View style={{ marginTop: 4 }}>
      {/* Selector de Día */}
      <DateSelector date={date} onChange={setDate} />

      {/* Empty State si no hay comidas */}
      {meals.length === 0 && (
        <View style={styles.emptyDayCard}>
          <LinearGradient
            colors={['rgba(24, 32, 54, 0.65)', 'rgba(14, 18, 34, 0.75)']}
            style={styles.emptyDayGradient}
          >
            <View style={styles.emptyIconCircle}>
              <Ionicons name="restaurant-outline" size={32} color={C.accentCyan} />
            </View>
            <Text style={styles.emptyDayTitle}>Sin comidas registradas</Text>
            <Text style={styles.emptyDaySubtitle}>
              Comienza agregando un bloque de comida o cargando una de tus comidas guardadas.
            </Text>
          </LinearGradient>
        </View>
      )}

      {/* Bloques de Comida Registrados */}
      {meals.map((m) => (
        <MealBlockCard
          key={m.id}
          block={m}
          ingredients={ingredients}
          onChange={(updated) => setMeals(meals.map((x) => (x.id === updated.id ? updated : x)))}
          onDelete={() => setMeals(meals.filter((x) => x.id !== m.id))}
          onRequestCreateIngredient={onRequestCreateIngredient}
        />
      ))}

      {/* Botones de Acción */}
      <View style={styles.actionButtonsRow}>
        <PrimaryButton
          icon="add-circle"
          label="Bloque de comida"
          onPress={() =>
            setMeals([
              ...meals,
              {
                id: uid(),
                name: nextName,
                items: [{ id: uid(), ingredientId: null, grams: 0 }],
              },
            ])
          }
        />

        <PrimaryButton
          ghost
          icon="bookmark-outline"
          label="Comida guardada"
          onPress={() => setPickModalOpen(true)}
        />
      </View>

      {/* Modal para Elegir Comida Guardada */}
      <Modal
        visible={pickModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickModalOpen(false)}
      >
        <Pressable style={styles.modalBackdropDismiss} onPress={() => setPickModalOpen(false)}>
          <Pressable style={styles.savedMealsPickerSheet}>
            <LinearGradient
              colors={['rgba(24, 32, 54, 0.98)', 'rgba(12, 16, 28, 0.99)']}
              style={{ padding: 18 }}
            >
              <View style={styles.sheetHandleBar} />
              <View style={styles.pickerHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.hudIconOrb}>
                    <Ionicons name="bookmark" size={16} color={C.accentCyan} />
                  </View>
                  <Text style={styles.sheetHeaderTitle}>CARGAR COMIDA GUARDADA</Text>
                </View>
                <Pressable
                  onPress={() => setPickModalOpen(false)}
                  style={styles.sheetCloseMiniBtn}
                >
                  <Ionicons name="close" size={18} color={C.sub} />
                </Pressable>
              </View>

              {savedMeals.length === 0 ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <Ionicons name="folder-open-outline" size={38} color={C.subMuted} />
                  <Text style={styles.emptySavedText}>No tienes comidas guardadas todavía.</Text>
                  <Text style={styles.emptySavedSubText}>
                    Crea conjuntos de ingredientes en la pestaña "Ingredientes y comidas".
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 380, marginTop: 10 }}>
                  {savedMeals.map((sm) => {
                    const smTotal = itemsTotal(sm.items, ingredients);
                    return (
                      <Pressable
                        key={sm.id}
                        onPress={() => {
                          setMeals([
                            ...meals,
                            {
                              id: uid(),
                              name: sm.name,
                              items: sm.items.map((it) => ({ ...it, id: uid() })),
                            },
                          ]);
                          setPickModalOpen(false);
                        }}
                        style={({ pressed }) => [styles.savedMealSelectCard, pressed && s.btnPressed]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.savedMealSelectName}>{sm.name}</Text>
                          <View style={styles.itemCountBadge}>
                            <Text style={styles.itemCountBadgeText}>{sm.items.length} items</Text>
                          </View>
                        </View>
                        <Text style={styles.savedMealSelectSub} numberOfLines={1}>
                          {sm.items
                            .map((it) => ingredients.find((i) => i.id === it.ingredientId)?.name)
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                        <View style={{ marginTop: 8 }}>
                          <MacroChips m={smTotal} small />
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ==========================================================
   OPCIÓN 2: BIBLIOTECA (INGREDIENTES Y COMIDAS GUARDADAS)
========================================================== */
function Library({ onRequestCreateIngredient }: { onRequestCreateIngredient: (name: string) => void }) {
  const [subTab, setSubTab] = useState(0);

  return (
    <View style={{ marginTop: 6 }}>
      <Segmented
        options={['Ingredientes', 'Comidas guardadas']}
        value={subTab}
        onChange={setSubTab}
      />
      {subTab === 0 ? (
        <IngredientsList onRequestCreateIngredient={onRequestCreateIngredient} />
      ) : (
        <SavedMealsList />
      )}
    </View>
  );
}

const confirmDelete = (msg: string, onConfirm: () => void) => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && (window as any).confirm) {
      if ((window as any).confirm(msg)) onConfirm();
    }
    return;
  }
  Alert.alert('Confirmar eliminación', msg, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Eliminar', style: 'destructive', onPress: onConfirm },
  ]);
};

/* --- Lista de Ingredientes --- */
function IngredientsList({ onRequestCreateIngredient }: { onRequestCreateIngredient: (name: string) => void }) {
  const { ingredients, upsertIngredient, deleteIngredient } = useStore();
  const [query, setQuery] = useState('');
  const [editingIng, setEditingIng] = useState<Ingredient | null>(null);

  const list = useMemo(() => {
    return ingredients
      .filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredients, query]);

  return (
    <View style={{ marginTop: 6 }}>
      {/* Barra de búsqueda y botón añadir */}
      <View style={styles.searchAddRow}>
        <View style={styles.searchBoxGlass}>
          <Ionicons name="search" size={17} color={C.accentCyan} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar en tus ingredientes..."
            placeholderTextColor={C.subMuted}
            style={styles.searchTextInput}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={C.sub} />
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={() =>
            setEditingIng({
              id: uid(),
              name: '',
              servingGrams: 100,
              kcal: 0,
              carbs: 0,
              protein: 0,
              fat: 0,
            })
          }
          style={({ pressed }) => [styles.addSquareBtn, pressed && s.btnPressed]}
        >
          <LinearGradient colors={GRADIENTS.primary} style={styles.addSquareGradient}>
            <Ionicons name="add" size={24} color="#FFF" />
          </LinearGradient>
        </Pressable>
      </View>

      {/* Contador de Ingredientes */}
      <View style={styles.countBadgeRow}>
        <Text style={styles.countBadgeText}>
          {list.length} INGREDIENTE{list.length === 1 ? '' : 'S'} REGISTRADO{list.length === 1 ? '' : 'S'}
        </Text>
      </View>

      {/* Lista de Tarjetas */}
      {list.map((ing) => (
        <Pressable
          key={ing.id}
          onPress={() => setEditingIng(ing)}
          style={({ pressed }) => [styles.ingredientCardWrapper, pressed && s.btnPressed]}
        >
          <LinearGradient
            colors={['rgba(24, 32, 54, 0.75)', 'rgba(14, 18, 34, 0.85)']}
            style={styles.ingredientCardGradient}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.ingredientCardTitle}>{ing.name}</Text>
              <View style={styles.servingBadge}>
                <Ionicons name="scale-outline" size={11} color={C.accentCyan} />
                <Text style={styles.servingBadgeText}>por {ing.servingGrams}g</Text>
              </View>
            </View>

            <View style={{ marginTop: 10 }}>
              <MacroChips m={ing} />
            </View>
          </LinearGradient>
        </Pressable>
      ))}

      {/* Modal de Crear / Editar Ingrediente */}
      {editingIng && (
        <IngredientFormModal
          ing={editingIng}
          onClose={() => setEditingIng(null)}
          onSave={(saved) => {
            upsertIngredient(saved);
            setEditingIng(null);
          }}
          onDelete={
            ingredients.some((x) => x.id === editingIng.id)
              ? () =>
                  confirmDelete(`¿Eliminar permanentemente "${editingIng.name}"?`, () => {
                    deleteIngredient(editingIng.id);
                    setEditingIng(null);
                  })
              : undefined
          }
        />
      )}
    </View>
  );
}

/* --- Formulario Modal de Ingrediente --- */
function IngredientFormModal({
  ing,
  onSave,
  onClose,
  onDelete,
}: {
  ing: Ingredient;
  onSave: (i: Ingredient) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState({
    name: ing.name,
    servingGrams: String(ing.servingGrams || 100),
    kcal: String(ing.kcal || 0),
    carbs: String(ing.carbs || 0),
    protein: String(ing.protein || 0),
    fat: String(ing.fat || 0),
  });

  const parseNum = (k: keyof typeof form) =>
    parseFloat((form[k] || '0').replace(',', '.')) || 0;

  const renderField = (
    key: keyof typeof form,
    label: string,
    color?: string,
    icon?: any,
  ) => (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 }}>
        {icon && <Ionicons name={icon} size={13} color={color || C.sub} />}
        <Text style={[styles.fieldLabel, color && { color }]}>{label}</Text>
      </View>
      <View style={[styles.fieldInputBox, color && { borderColor: color + '40' }]}>
        <TextInput
          value={form[key]}
          onChangeText={(t) => setForm({ ...form, [key]: t })}
          keyboardType="decimal-pad"
          selectTextOnFocus
          style={[styles.fieldTextInput, color && { color }]}
        />
      </View>
    </View>
  );

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.formModalOverlay}
      >
        <Pressable style={styles.formModalBackdrop} onPress={onClose} />
        <View style={styles.formModalSheet}>
          <LinearGradient
            colors={['rgba(24, 32, 54, 0.98)', 'rgba(12, 16, 28, 0.99)']}
            style={{ padding: 20 }}
          >
            <View style={styles.sheetHandleBar} />

            {/* Header del Formulario */}
            <View style={styles.formHeaderRow}>
              <View>
                <Text style={styles.formTitle}>
                  {ing.name ? 'EDITAR INGREDIENTE' : 'NUEVO INGREDIENTE'}
                </Text>
                <Text style={styles.formSubtitle}>
                  Copia los datos del empaque nutricional
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.sheetCloseMiniBtn}>
                <Ionicons name="close" size={20} color={C.sub} />
              </Pressable>
            </View>

            {/* Nombre del Ingrediente */}
            <Text style={styles.fieldLabel}>Nombre del alimento</Text>
            <View style={[styles.fieldInputBox, { marginBottom: 12 }]}>
              <TextInput
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
                placeholder="Ej. Pechuga de pavo, Mantequilla de maní..."
                placeholderTextColor={C.subMuted}
                style={styles.fieldTextInput}
              />
            </View>

            {/* Porción base y Calorías */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              {renderField('servingGrams', 'Porción empaque (g)', C.accentCyan, 'scale-outline')}
              {renderField('kcal', 'Calorías (kcal)', C.kcal, 'flame')}
            </View>

            {/* Carbos, Proteína y Grasas */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {renderField('carbs', 'Carbos (g)', C.carbs, 'leaf')}
              {renderField('protein', 'Proteína (g)', C.protein, 'flash')}
              {renderField('fat', 'Grasas (g)', C.fat, 'water')}
            </View>

            {/* Botones de acción */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {onDelete && (
                <PrimaryButton ghost danger icon="trash" label="Eliminar" onPress={onDelete} />
              )}
              <PrimaryButton
                icon="checkmark-circle"
                label="Guardar ingrediente"
                onPress={() => {
                  if (!form.name.trim() || parseNum('servingGrams') <= 0) {
                    Alert.alert('Datos incompletos', 'Ingresa un nombre y la cantidad de gramos base.');
                    return;
                  }
                  onSave({
                    id: ing.id,
                    name: form.name.trim(),
                    servingGrams: parseNum('servingGrams'),
                    kcal: parseNum('kcal'),
                    carbs: parseNum('carbs'),
                    protein: parseNum('protein'),
                    fat: parseNum('fat'),
                  });
                }}
              />
            </View>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* --- Lista de Comidas Guardadas --- */
function SavedMealsList() {
  const { savedMeals, ingredients, upsertSavedMeal, deleteSavedMeal } = useStore();
  const [draft, setDraft] = useState<SavedMeal | null>(null);

  return (
    <View style={{ marginTop: 6 }}>
      {draft ? (
        <View>
          <View style={styles.editorBanner}>
            <Ionicons name="create-outline" size={16} color={C.accentCyan} />
            <Text style={styles.editorBannerText}>EDITANDO RECETA / COMIDA GUARDADA</Text>
          </View>

          <MealBlockCard block={draft} ingredients={ingredients} onChange={setDraft} />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <PrimaryButton
              ghost
              icon="close"
              label="Cancelar"
              onPress={() => setDraft(null)}
            />
            <PrimaryButton
              icon="checkmark"
              label="Guardar comida"
              onPress={() => {
                const validItems = draft.items.filter((i) => i.ingredientId && i.grams > 0);
                upsertSavedMeal({
                  ...draft,
                  name: draft.name.trim() || 'Comida sin nombre',
                  items: validItems,
                });
                setDraft(null);
              }}
            />
          </View>
        </View>
      ) : (
        <>
          <PrimaryButton
            icon="add-circle"
            label="Crear nueva comida guardada"
            onPress={() =>
              setDraft({
                id: uid(),
                name: 'Mi Comida Favorita',
                items: [{ id: uid(), ingredientId: null, grams: 0 }],
              })
            }
          />

          <View style={{ height: 14 }} />

          {savedMeals.length === 0 && (
            <View style={styles.emptyDayCard}>
              <Ionicons name="fast-food-outline" size={36} color={C.subMuted} />
              <Text style={styles.emptyDayTitle}>No hay comidas guardadas</Text>
              <Text style={styles.emptyDaySubtitle}>
                Crea combinaciones de alimentos que consumas con frecuencia para agregarlas en 1 toque.
              </Text>
            </View>
          )}

          {savedMeals.map((sm) => {
            const smTotal = itemsTotal(sm.items, ingredients);
            return (
              <Pressable
                key={sm.id}
                onPress={() => setDraft(JSON.parse(JSON.stringify(sm)))}
                style={({ pressed }) => [styles.savedMealCardWrapper, pressed && s.btnPressed]}
              >
                <LinearGradient
                  colors={['rgba(24, 32, 54, 0.75)', 'rgba(14, 18, 34, 0.85)']}
                  style={styles.savedMealCardGradient}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.savedMealTitle}>{sm.name}</Text>
                    <Pressable
                      hitSlop={10}
                      onPress={() =>
                        confirmDelete(`¿Eliminar la comida guardada "${sm.name}"?`, () =>
                          deleteSavedMeal(sm.id),
                        )
                      }
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="trash-outline" size={17} color={C.danger} />
                    </Pressable>
                  </View>

                  <Text style={styles.savedMealIngredientsText} numberOfLines={2}>
                    {sm.items
                      .map((it) => {
                        const ing = ingredients.find((i) => i.id === it.ingredientId);
                        return ing ? `${ing.name} (${it.grams}g)` : null;
                      })
                      .filter(Boolean)
                      .join('  •  ')}
                  </Text>

                  <View style={{ marginTop: 10 }}>
                    <MacroChips m={smTotal} />
                  </View>
                </LinearGradient>
              </Pressable>
            );
          })}
        </>
      )}
    </View>
  );
}

/* ==========================================================
   ESTILOS ESPECÍFICOS DE FOOD SCREEN
========================================================== */
const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 130,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  cyberTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  cyberDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accentCyan,
  },
  cyberTagText: {
    color: C.accentCyan,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  screenTitle: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  dateChipMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(28, 36, 62, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
    marginTop: 6,
  },
  dateChipMiniText: {
    color: C.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Empty state
  emptyDayCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderLight,
    marginBottom: 16,
  },
  emptyDayGradient: {
    padding: 28,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.25)',
    marginBottom: 12,
  },
  emptyDayTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyDaySubtitle: {
    color: C.sub,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },

  // Modal selector de comida guardada
  modalBackdropDismiss: {
    flex: 1,
    backgroundColor: 'rgba(4, 6, 12, 0.8)',
    justifyContent: 'flex-end',
  },
  savedMealsPickerSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderGlow,
    backgroundColor: C.cardSolid,
  },
  sheetHandleBar: {
    width: 38,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  hudIconOrb: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  sheetHeaderTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sheetCloseMiniBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySavedText: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySavedSubText: {
    color: C.subMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  savedMealSelectCard: {
    backgroundColor: 'rgba(28, 36, 62, 0.65)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  savedMealSelectName: {
    color: C.text,
    fontSize: 16,
    fontWeight: '800',
  },
  itemCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemCountBadgeText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '600',
  },
  savedMealSelectSub: {
    color: C.sub,
    fontSize: 12,
    marginTop: 3,
  },

  // Búsqueda y Add en Library
  searchAddRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  searchBoxGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 32, 54, 0.8)',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    gap: 8,
  },
  searchTextInput: {
    flex: 1,
    color: C.text,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  addSquareBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
  },
  addSquareGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeRow: {
    marginBottom: 10,
  },
  countBadgeText: {
    color: C.subMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Tarjetas de Ingrediente
  ingredientCardWrapper: {
    borderRadius: 18,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderLight,
    backgroundColor: C.cardSolid,
  },
  ingredientCardGradient: {
    padding: 14,
  },
  ingredientCardTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  servingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.25)',
  },
  servingBadgeText: {
    color: C.accentCyan,
    fontSize: 11,
    fontWeight: '700',
  },

  // Modal Formulario de Ingrediente
  formModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  formModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 6, 12, 0.8)',
  },
  formModalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderGlow,
    backgroundColor: C.cardSolid,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  formTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  formSubtitle: {
    color: C.sub,
    fontSize: 12,
    marginTop: 2,
  },
  fieldLabel: {
    color: C.sub,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  fieldInputBox: {
    backgroundColor: 'rgba(28, 36, 62, 0.8)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    paddingHorizontal: 12,
  },
  fieldTextInput: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 9,
  },

  // Comidas guardadas
  editorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.25)',
    marginBottom: 12,
  },
  editorBannerText: {
    color: C.accentCyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  savedMealCardWrapper: {
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderLight,
    backgroundColor: C.cardSolid,
  },
  savedMealCardGradient: {
    padding: 16,
  },
  savedMealTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '800',
  },
  savedMealIngredientsText: {
    color: C.sub,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
});
