import React, { useMemo, useState, useRef, useEffect } from 'react';
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
  Keyboard,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { C, GRADIENTS, registerThemeSheet, getPaletteColorWithAlpha } from './theme';
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
  FoodUnit,
  getActivePalette,
} from './store';
import {
  MacroSummary,
  MainNavigationSegmented,
  Segmented,
  DateSelector,
  MealBlockCard,
  PrimaryButton,
  MacroChips,
  IngredientPickerModal,
  s,
} from './components';

export default function FoodScreen() {
  const activePaletteId = useStore((s) => s.activePaletteId);
  const customPalettes = useStore((s) => s.customPalettes);
  const palette = getActivePalette({ activePaletteId, customPalettes });
  const [tab, setTab] = useState(0);
  const [date, setDate] = useState(new Date());
  const [quickCreateName, setQuickCreateName] = useState<string | null>(null);

  // Target para el selector de ingredientes: { blockId, itemId, isSavedMealDraft }
  const [pickerTarget, setPickerTarget] = useState<{
    blockId: string;
    itemId: string;
    isSavedMealDraft?: boolean;
  } | null>(null);

  // Guarda a cuál fila se le debe asignar el nuevo ingrediente cuando se termine de crear
  const [pendingTargetForNewIng, setPendingTargetForNewIng] = useState<{
    blockId: string;
    itemId: string;
    isSavedMealDraft?: boolean;
  } | null>(null);

  // Draft para comida guardada si se está editando en la biblioteca
  const [savedMealDraft, setSavedMealDraft] = useState<SavedMeal | null>(null);

  const key = dateKey(date);
  const { ingredients, logs, setDayMeals, upsertIngredient } = useStore();
  const meals = logs[key] ?? [];

  const total = useMemo(
    () => meals.reduce((acc, m) => addMacros(acc, itemsTotal(m.items, ingredients)), ZERO),
    [meals, ingredients],
  );

  // Animación suave de transición de contenido entre pestañas
  const contentFadeAnim = useRef(new Animated.Value(1)).current;
  const contentSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    contentFadeAnim.setValue(0);
    contentSlideAnim.setValue(6);
    Animated.parallel([
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentSlideAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [tab]);

  // Asigna un ingrediente directamente a un target (bloque/item)
  const assignIngredientToTarget = (
    target: { blockId: string; itemId: string; isSavedMealDraft?: boolean },
    selectedIng: Ingredient,
  ) => {
    if (target.isSavedMealDraft && savedMealDraft) {
      setSavedMealDraft({
        ...savedMealDraft,
        items: savedMealDraft.items.map((it) =>
          it.id === target.itemId
            ? {
                ...it,
                ingredientId: selectedIng.id,
                grams: it.grams > 0 ? it.grams : selectedIng.servingGrams,
                unit: selectedIng.unit || 'g',
              }
            : it,
        ),
      });
    } else {
      setDayMeals(
        key,
        meals.map((b) =>
          b.id === target.blockId
            ? {
                ...b,
                items: b.items.map((it) =>
                  it.id === target.itemId
                    ? {
                        ...it,
                        ingredientId: selectedIng.id,
                        grams: it.grams > 0 ? it.grams : selectedIng.servingGrams,
                        unit: selectedIng.unit || 'g',
                      }
                    : it,
                ),
              }
            : b,
        ),
      );
    }
  };

  const handleSelectIngredient = (selectedIng: Ingredient) => {
    if (!pickerTarget) return;
    assignIngredientToTarget(pickerTarget, selectedIng);
    setPickerTarget(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          tab === 1 && { paddingBottom: 320 }, // <--- Espacio amplio para scrollear libremente sobre el teclado
        ]}
        stickyHeaderIndices={[2]}
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Anime Pastel Claro */}
        <View style={styles.topHeader}>
          <View>
            <View style={styles.cyberTagRow}>
              <Ionicons name="sparkles" size={11} color={palette.primary} />
              <Text style={[styles.cyberTagText, { color: palette.primary }]}>✦ EVOLVE // PROTOCOLO ✦</Text>
            </View>
            <Text style={styles.screenTitle}>Comida</Text>
          </View>

          <View style={[styles.dateChipMini, { borderColor: getPaletteColorWithAlpha(palette.primary, 0.25), backgroundColor: getPaletteColorWithAlpha(palette.primary, 0.08) }]}>
            <Ionicons name="time-outline" size={13} color={palette.primary} />
            <Text style={[styles.dateChipMiniText, { color: palette.primary }]}>
              {date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Resumen de Macros Animado */}
        <MacroSummary m={total} />

        {/* Selector Maestro de Pestaña Principal (Sticky al hacer scroll down) */}
        <View style={styles.stickyTabsContainer}>
          <MainNavigationSegmented
            value={tab}
            onChange={setTab}
          />
        </View>

        {/* Contenido animado ultra smooth según pestaña */}
        <Animated.View
          style={{
            opacity: contentFadeAnim,
            transform: [{ translateY: contentSlideAnim }],
          }}
        >
          {tab === 0 ? (
            <DayLog
              date={date}
              setDate={setDate}
              meals={meals}
              dayKey={key}
              onOpenPicker={(blockId, itemId) =>
                setPickerTarget({ blockId, itemId, isSavedMealDraft: false })
              }
            />
          ) : (
            <Library
              draft={savedMealDraft}
              setDraft={setSavedMealDraft}
              onOpenPickerForDraft={(itemId) =>
                setPickerTarget({
                  blockId: savedMealDraft?.id || '',
                  itemId,
                  isSavedMealDraft: true,
                })
              }
            />
          )}
        </Animated.View>
      </ScrollView>

      {/* MODAL GLOBAL DE BÚSQUEDA DE INGREDIENTES */}
      <IngredientPickerModal
        visible={pickerTarget !== null}
        ingredients={ingredients}
        onClose={() => setPickerTarget(null)}
        onSelect={handleSelectIngredient}
        onCreateNew={(initialName) => {
          // Guardamos la fila donde estábamos agregando para asignárselo de inmediato
          if (pickerTarget) {
            setPendingTargetForNewIng(pickerTarget);
          }
          setPickerTarget(null);
          setQuickCreateName(initialName);
        }}
      />

      {/* Modal de creación de ingrediente (asignación directa al terminar) */}
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
          onClose={() => {
            setQuickCreateName(null);
            setPendingTargetForNewIng(null);
          }}
          onSave={(newIng) => {
            upsertIngredient(newIng);
            // Si venía de una fila en la que estaba buscando, lo asignamos de una vez
            if (pendingTargetForNewIng) {
              assignIngredientToTarget(pendingTargetForNewIng, newIng);
              setPendingTargetForNewIng(null);
            }
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
  onOpenPicker,
}: {
  date: Date;
  setDate: (d: Date) => void;
  meals: MealBlock[];
  dayKey: string;
  onOpenPicker: (blockId: string, itemId: string) => void;
}) {
  const { ingredients, savedMeals, setDayMeals, upsertSavedMeal, activePaletteId, customPalettes } = useStore();
  const palette = getActivePalette({ activePaletteId, customPalettes });
  const [pickModalOpen, setPickModalOpen] = useState(false);

  const setMeals = (m: MealBlock[]) => setDayMeals(dayKey, m);

  const defaultNames = ['Desayuno', 'Almuerzo', 'Cena', 'Snack', 'Post-Entreno'];
  const nextName = defaultNames[meals.length] ?? `Comida ${meals.length + 1}`;

  // Guarda un bloque directamente en la biblioteca de comidas guardadas
  const handleSaveBlockAsRecipe = (block: MealBlock) => {
    const validItems = block.items.filter((it) => it.ingredientId && it.grams > 0);
    if (validItems.length === 0) {
      Alert.alert(
        'Comida sin alimentos',
        'Agrega al menos un ingrediente con su cantidad antes de guardarla como receta.',
      );
      return;
    }
    upsertSavedMeal({
      id: uid(),
      name: block.name.trim() || 'Comida guardada',
      items: validItems.map((it) => ({ ...it, id: uid() })),
    });
    Alert.alert(
      '¡Comida guardada!',
      `"${block.name.trim() || 'Comida guardada'}" ya está en tus recetas guardadas para usarla en cualquier día.`,
    );
  };

  return (
    <View style={{ marginTop: 4 }}>
      {/* Selector de Día */}
      <DateSelector date={date} onChange={setDate} />

      {/* Empty State si no hay comidas */}
      {meals.length === 0 && (
        <View style={[styles.emptyDayCard, { backgroundColor: 'transparent', borderColor: getPaletteColorWithAlpha(palette.primary, 0.22) }]}>
          <LinearGradient
            colors={[getPaletteColorWithAlpha(palette.primary, 0.08), getPaletteColorWithAlpha(palette.primary, 0.02)]}
            style={styles.emptyDayGradient}
          >
            <View style={[styles.emptyIconCircle, { backgroundColor: getPaletteColorWithAlpha(palette.primary, 0.12), borderColor: getPaletteColorWithAlpha(palette.primary, 0.28) }]}>
              <Ionicons name="restaurant-outline" size={30} color={palette.primary} />
            </View>
            <Text style={styles.emptyDayTitle}>Sin comidas registradas</Text>
            <Text style={styles.emptyDaySubtitle}>
              Toca en "Bloque de comida" o carga una comida guardada para empezar el registro.
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
          onSaveAsRecipe={() => handleSaveBlockAsRecipe(m)}
          onOpenPickerForItem={(itemId) => onOpenPicker(m.id, itemId)}
        />
      ))}

      {/* Botones de Acción */}
      <View style={styles.actionButtonsRow}>
        <PrimaryButton
          icon="add-circle"
          label="Bloque de comida"
          onPress={() => {
            const newItemId = uid();
            const newBlockId = uid();
            setMeals([
              ...meals,
              {
                id: newBlockId,
                name: nextName,
                items: [{ id: newItemId, ingredientId: null, grams: 0 }],
              },
            ]);
            onOpenPicker(newBlockId, newItemId);
          }}
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
              colors={[getPaletteColorWithAlpha(palette.primary, 0.08), getPaletteColorWithAlpha(palette.primary, 0.02)]}
              style={{ padding: 18 }}
            >
              <View style={styles.sheetHandleBar} />
              <View style={styles.pickerHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.hudIconOrb, { backgroundColor: getPaletteColorWithAlpha(palette.primary, 0.14) }]}>
                    <Ionicons name="bookmark" size={16} color={palette.primary} />
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
                  <Text style={styles.emptySavedText}>Aún no tienes comidas guardadas.</Text>
                  <Text style={styles.emptySavedSubText}>
                    Crea recetas en "Ingredientes y comidas" para agregarlas en 1 toque.
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
                        style={({ pressed }) => [styles.savedMealSelectCard, { borderColor: getPaletteColorWithAlpha(palette.primary, 0.25) }, pressed && s.btnPressed]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.savedMealSelectName}>{sm.name}</Text>
                          <View style={[styles.itemCountBadge, { backgroundColor: getPaletteColorWithAlpha(palette.primary, 0.14) }]}>
                            <Text style={[styles.itemCountBadgeText, { color: palette.primary }]}>{sm.items.length} items</Text>
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
function Library({
  draft,
  setDraft,
  onOpenPickerForDraft,
}: {
  draft: SavedMeal | null;
  setDraft: (d: SavedMeal | null) => void;
  onOpenPickerForDraft: (itemId: string) => void;
}) {
  const [subTab, setSubTab] = useState(0);

  // Animación suave de transición de contenido para la biblioteca
  const subContentFadeAnim = useRef(new Animated.Value(1)).current;
  const subContentSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    subContentFadeAnim.setValue(0);
    subContentSlideAnim.setValue(6);
    Animated.parallel([
      Animated.timing(subContentFadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(subContentSlideAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [subTab]);

  return (
    <View style={{ marginTop: 2 }}>
      <Segmented
        options={['Ingredientes', 'Comidas guardadas']}
        value={subTab}
        onChange={setSubTab}
      />
      <Animated.View
        style={{
          opacity: subContentFadeAnim,
          transform: [{ translateY: subContentSlideAnim }],
        }}
      >
        {subTab === 0 ? (
          <IngredientsList />
        ) : (
          <SavedMealsList
            draft={draft}
            setDraft={setDraft}
            onOpenPickerForDraft={onOpenPickerForDraft}
          />
        )}
      </Animated.View>
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
  Alert.alert('Eliminar', msg, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Eliminar', style: 'destructive', onPress: onConfirm },
  ]);
};

/* --- Lista de Ingredientes con Buscador Seguro --- */
function IngredientsList() {
  const { ingredients, upsertIngredient, deleteIngredient, activePaletteId, customPalettes } = useStore();
  const palette = getActivePalette({ activePaletteId, customPalettes });
  const [query, setQuery] = useState('');
  const [editingIng, setEditingIng] = useState<Ingredient | null>(null);

  const list = useMemo(() => {
    return ingredients
      .filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredients, query]);

  return (
    <View style={{ marginTop: 6 }}>
      {/* Barra de búsqueda interactiva con botón de descartar teclado */}
      <View style={styles.searchAddRow}>
        <View style={[styles.searchBoxGlass, { backgroundColor: getPaletteColorWithAlpha(palette.primary, 0.06), borderColor: getPaletteColorWithAlpha(palette.primary, 0.22) }]}>
          <Ionicons name="search" size={17} color={C.pastelPurple} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar entre tus alimentos..."
            placeholderTextColor={C.subMuted}
            style={styles.searchTextInput}
            clearButtonMode="while-editing"
          />
          {query.length > 0 && Platform.OS !== 'ios' && (
            <Pressable onPress={() => setQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={16} color={C.sub} />
            </Pressable>
          )}
          <Pressable onPress={() => Keyboard.dismiss()} style={{ padding: 4 }}>
            <Ionicons name="chevron-down-circle-outline" size={18} color={C.pastelPurple} />
          </Pressable>
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
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>

      {/* Contador de Ingredientes */}
      <View style={styles.countBadgeRow}>
        <Text style={styles.countBadgeText}>
          ✦ {list.length} ALIMENTO{list.length === 1 ? '' : 'S'} REGISTRADO{list.length === 1 ? '' : 'S'} ✦
        </Text>
      </View>

      {/* Mensaje si la búsqueda no arroja resultados */}
      {list.length === 0 && (
        <View style={styles.emptySearchListBox}>
          <Ionicons name="search-outline" size={32} color={C.subMuted} />
          <Text style={styles.emptySearchListTitle}>Sin resultados para "{query}"</Text>
          <Text style={styles.emptySearchListSub}>Toca en el botón '+' de arriba para crearlo ahora mismo.</Text>
        </View>
      )}

      {/* Lista de Tarjetas */}
      {list.map((ing) => (
        <Pressable
          key={ing.id}
          onPress={() => {
            Keyboard.dismiss();
            setEditingIng(ing);
          }}
          style={({ pressed }) => [
            styles.ingredientCardWrapper,
            { backgroundColor: 'transparent', borderColor: getPaletteColorWithAlpha(palette.primary, 0.2) },
            pressed && s.btnPressed,
          ]}
        >
          <LinearGradient
            colors={[getPaletteColorWithAlpha(palette.primary, 0.08), getPaletteColorWithAlpha(palette.primary, 0.02)]}
            style={styles.ingredientCardGradient}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.ingredientCardTitle}>{ing.name}</Text>
              <View style={styles.servingBadge}>
                <Ionicons name="scale-outline" size={11} color="#94A3B8" />
                <Text style={styles.servingBadgeText}>por {ing.servingGrams}{ing.unit || 'g'}</Text>
              </View>
            </View>

            <View style={{ marginTop: 10 }}>
              <MacroChips m={ing} />
            </View>
          </LinearGradient>
        </Pressable>
      ))}

      {/* Modal de Crear / Editar Ingrediente con Altura Segura */}
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

/* --- Formulario Modal de Ingrediente (Robusto y Seguro contra Teclado) --- */
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
  const palette = getActivePalette(useStore.getState());
  const [unit, setUnit] = useState<FoodUnit>(ing.unit || 'g');
  const [form, setForm] = useState({
    name: ing.name,
    servingGrams: String(ing.servingGrams || (ing.unit === 'ud' ? 1 : 100)),
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
      <View style={[styles.fieldInputBox, color && { borderColor: color + '50' }]}>
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
      <View style={styles.formModalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.formModalSheetContainer}
        >
          <View style={styles.formModalSheetContent}>
            <LinearGradient
              colors={[getPaletteColorWithAlpha(palette.primary, 0.08), getPaletteColorWithAlpha(palette.primary, 0.02)]}
              style={{ padding: 20 }}
            >
              <View style={styles.sheetHandleBar} />

              {/* Header del Formulario */}
              <View style={styles.formHeaderRow}>
                <View>
                  <Text style={styles.formTitle}>
                    {ing.name ? 'EDITAR ALIMENTO' : 'NUEVO ALIMENTO'}
                  </Text>
                  <Text style={styles.formSubtitle}>
                    Introduce los valores tal como figuran en el empaque
                  </Text>
                </View>
                <Pressable onPress={onClose} style={styles.sheetCloseMiniBtn}>
                  <Ionicons name="close" size={20} color={C.text} />
                </Pressable>
              </View>

              {/* Nombre del Ingrediente */}
              <Text style={styles.fieldLabel}>Nombre del alimento</Text>
              <View style={[styles.fieldInputBox, { marginBottom: 12 }]}>
                <TextInput
                  value={form.name}
                  onChangeText={(t) => setForm({ ...form, name: t })}
                  placeholder="Ej. Mantequilla de maní, Leche, Huevos..."
                  placeholderTextColor={C.subMuted}
                  style={styles.fieldTextInput}
                />
              </View>

              {/* Selector de Unidad de Medida */}
              <Text style={styles.fieldLabel}>Unidad de medida</Text>
              <View style={styles.unitSelectorRow}>
                {(
                  [
                    { key: 'g' as FoodUnit, label: 'Gramos (g)', icon: 'scale-outline' },
                    { key: 'ml' as FoodUnit, label: 'Mililitros (ml)', icon: 'water-outline' },
                    { key: 'ud' as FoodUnit, label: 'Unidades (ud)', icon: 'egg-outline' },
                  ] as const
                ).map((u) => {
                  const active = unit === u.key;
                  return (
                    <Pressable
                      key={u.key}
                      onPress={() => {
                        setUnit(u.key);
                        if (u.key === 'ud' && (form.servingGrams === '100' || form.servingGrams === '0')) {
                          setForm((prev) => ({ ...prev, servingGrams: '1' }));
                        } else if (u.key !== 'ud' && form.servingGrams === '1') {
                          setForm((prev) => ({ ...prev, servingGrams: u.key === 'ml' ? '200' : '100' }));
                        }
                      }}
                      style={[styles.unitPillBtn, active && styles.unitPillBtnActive]}
                    >
                      <Ionicons
                        name={u.icon as any}
                        size={13}
                        color={active ? '#334155' : '#94A3B8'}
                      />
                      <Text style={[styles.unitPillText, active && styles.unitPillTextActive]}>
                        {u.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Porción base y Calorías */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                {renderField('servingGrams', `Porción base (${unit})`, C.pastelPurple, 'scale-outline')}
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
                  label="Guardar alimento"
                  onPress={() => {
                    if (!form.name.trim() || parseNum('servingGrams') <= 0) {
                      Alert.alert('Datos incompletos', 'Ingresa un nombre y la cantidad de porción base.');
                      return;
                    }
                    onSave({
                      id: ing.id,
                      name: form.name.trim(),
                      servingGrams: parseNum('servingGrams'),
                      unit,
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
      </View>
    </Modal>
  );
}

/* --- Lista de Comidas Guardadas --- */
function SavedMealsList({
  draft,
  setDraft,
  onOpenPickerForDraft,
}: {
  draft: SavedMeal | null;
  setDraft: (d: SavedMeal | null) => void;
  onOpenPickerForDraft: (itemId: string) => void;
}) {
  const { savedMeals, ingredients, upsertSavedMeal, deleteSavedMeal, activePaletteId, customPalettes } = useStore();
  const palette = getActivePalette({ activePaletteId, customPalettes });

  return (
    <View style={{ marginTop: 6 }}>
      {draft ? (
        <View>
          <View style={styles.editorBanner}>
            <Ionicons name="create-outline" size={16} color={palette.primary} />
            <Text style={styles.editorBannerText}>EDITANDO RECETA / COMIDA GUARDADA</Text>
          </View>

          <MealBlockCard
            block={draft}
            ingredients={ingredients}
            onChange={setDraft}
            onOpenPickerForItem={onOpenPickerForDraft}
          />

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

          {/* MENSAJE VACÍO DE COMIDAS GUARDADAS: 100% ALINEADO Y CENTRADO */}
          {savedMeals.length === 0 && (
            <View style={[styles.emptySavedBoxWrapper, { backgroundColor: getPaletteColorWithAlpha(palette.primary, 0.06), borderColor: getPaletteColorWithAlpha(palette.primary, 0.22) }]}>
              <View style={[styles.emptyIconCircle, { backgroundColor: getPaletteColorWithAlpha(palette.primary, 0.12), borderColor: getPaletteColorWithAlpha(palette.primary, 0.28) }]}>
                <Ionicons name="fast-food-outline" size={32} color={palette.primary} />
              </View>
              <Text style={styles.emptyDayTitle}>No tienes comidas guardadas</Text>
              <Text style={styles.emptyDaySubtitle}>
                Crea combinaciones de alimentos que consumes con frecuencia para cargarlas en 1 toque.
              </Text>
            </View>
          )}

          {savedMeals.map((sm) => {
            const smTotal = itemsTotal(sm.items, ingredients);
            return (
              <Pressable
                key={sm.id}
                onPress={() => setDraft(JSON.parse(JSON.stringify(sm)))}
                style={({ pressed }) => [
                  styles.savedMealCardWrapper,
                  { backgroundColor: 'transparent', borderColor: getPaletteColorWithAlpha(palette.primary, 0.2) },
                  pressed && s.btnPressed,
                ]}
              >
                <LinearGradient
                  colors={[getPaletteColorWithAlpha(palette.primary, 0.08), getPaletteColorWithAlpha(palette.primary, 0.02)]}
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
   ESTILOS ESPECÍFICOS DE FOOD SCREEN (PASTEL ANIME CLARO)
========================================================== */
const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 130,
  },
  stickyTabsContainer: {
    backgroundColor: 'transparent',
    paddingTop: 2,
    paddingBottom: 8,
    zIndex: 25,
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
    gap: 5,
    marginBottom: 2,
  },
  cyberTagText: {
    color: C.pastelPurple,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  screenTitle: {
    color: C.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  dateChipMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
    marginTop: 6,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  dateChipMiniText: {
    color: C.textSub,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Empty state Búsqueda Lista
  emptySearchListBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: C.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  emptySearchListTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
  emptySearchListSub: {
    color: C.sub,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },

  // Empty state Día
  emptyDayCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderLight,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyDayGradient: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    marginBottom: 12,
  },
  emptyDayTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDaySubtitle: {
    color: C.sub,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  // MENSAJE VACÍO DE COMIDAS GUARDADAS CENTRADO
  emptySavedBoxWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: C.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 16,
  },

  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },

  // Modal selector de comida guardada
  modalBackdropDismiss: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  savedMealsPickerSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderPastelPurple,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetHandleBar: {
    width: 38,
    height: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
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
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
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
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySavedText: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  emptySavedSubText: {
    color: C.subMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  savedMealSelectCard: {
    backgroundColor: '#F8FAFC',
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
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    gap: 8,
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
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
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
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
    backgroundColor: '#FFFFFF',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  servingBadgeText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },

  // Modal Formulario de Ingrediente
  formModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  formModalSheetContainer: {
    width: '100%',
  },
  formModalSheetContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderPastelPurple,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
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
    backgroundColor: '#F8FAFC',
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
  unitSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  unitPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitPillBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#94A3B8',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  unitPillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  unitPillTextActive: {
    color: C.text,
    fontWeight: '800',
  },

  // Comidas guardadas
  editorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    marginBottom: 12,
  },
  editorBannerText: {
    color: C.pastelPurple,
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
    backgroundColor: '#FFFFFF',
    shadowColor: C.pastelPurple,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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

registerThemeSheet(styles);


