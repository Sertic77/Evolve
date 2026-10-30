import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform, Modal } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { C, fmt } from './theme';
import { Ingredient, Macros, MealBlock, MealItem, scaleMacros, itemsTotal, uid } from './store';

/* ---------------- Resumen de macros ---------------- */
export function MacroSummary({ m }: { m: Macros }) {
  const size = 150, stroke = 14, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const kc = { carbs: m.carbs * 4, protein: m.protein * 4, fat: m.fat * 9 };
  const total = kc.carbs + kc.protein + kc.fat;
  let offset = 0;
  const segs = (['carbs', 'protein', 'fat'] as const).map((k) => {
    const len = total ? (kc[k] / total) * circ : 0;
    const s = { k, len, offset };
    offset += len;
    return s;
  });
  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.card2} strokeWidth={stroke} fill="none" />
            {segs.map((g) =>
              g.len > 0 ? (
                <Circle key={g.k} cx={size / 2} cy={size / 2} r={r} stroke={C[g.k]} strokeWidth={stroke} fill="none"
                  strokeDasharray={`${g.len} ${circ}`} strokeDashoffset={-g.offset} />
              ) : null,
            )}
          </Svg>
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: C.kcal, fontSize: 30, fontWeight: '800' }}>{Math.round(m.kcal)}</Text>
            <Text style={{ color: C.sub, fontSize: 12 }}>kcal</Text>
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: 18, gap: 12 }}>
          {([['Carbohidratos', 'carbs'], ['Proteínas', 'protein'], ['Grasas', 'fat']] as const).map(([label, k]) => (
            <View key={k}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: C.sub, fontSize: 13 }}>{label}</Text>
                <Text style={{ color: C.text, fontWeight: '700' }}>{fmt(m[k])} g</Text>
              </View>
              <View style={s.barBg}>
                <View style={[s.bar, { backgroundColor: C[k], width: `${total ? (kc[k] / total) * 100 : 0}%` }]} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ---------------- Selector segmentado ---------------- */
export function Segmented({ options, value, onChange }: { options: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o, i) => (
        <Pressable key={o} onPress={() => onChange(i)} style={[s.segBtn, value === i && s.segActive]}>
          <Text style={{ color: value === i ? '#fff' : C.sub, fontWeight: '700', fontSize: 13 }}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ---------------- Selector de fecha ---------------- */
let DateTimePicker: any = null;
if (Platform.OS !== 'web') DateTimePicker = require('@react-native-community/datetimepicker').default;

export function DateSelector({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  const shift = (n: number) => { const d = new Date(date); d.setDate(d.getDate() + n); onChange(d); };
  const isToday = new Date().toDateString() === date.toDateString();
  const label = isToday ? 'Hoy' : date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <View style={[s.row, { justifyContent: 'space-between', marginVertical: 14 }]}>
      <Pressable onPress={() => shift(-1)} style={s.iconBtn}><Ionicons name="chevron-back" size={20} color={C.text} /></Pressable>
      <Pressable onPress={() => setOpen(true)} style={[s.row, s.dateBtn]}>
        <Ionicons name="calendar" size={18} color={C.accent} />
        <Text style={{ color: C.text, fontWeight: '700', marginLeft: 8, textTransform: 'capitalize' }}>{label}</Text>
      </Pressable>
      <Pressable onPress={() => shift(1)} style={s.iconBtn}><Ionicons name="chevron-forward" size={20} color={C.text} /></Pressable>
      {open && DateTimePicker && (
        <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={[s.card, { padding: 8 }]}>
              <DateTimePicker value={date} mode="date" display="inline" themeVariant="dark" accentColor={C.accent}
                locale="es-ES"
                onChange={(_: any, d?: Date) => { if (d) onChange(d); setOpen(false); }} />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

/* ---------------- Buscador de ingredientes ---------------- */
function IngredientSearch({ ingredients, selected, onSelect }: {
  ingredients: Ingredient[]; selected?: Ingredient; onSelect: (i: Ingredient) => void;
}) {
  const [q, setQ] = useState(selected?.name ?? '');
  const [focus, setFocus] = useState(false);
  const results = ingredients.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  return (
    <View style={{ flex: 1, zIndex: 10 }}>
      <TextInput value={focus ? q : selected?.name ?? q} onChangeText={setQ} placeholder="Buscar ingrediente…"
        placeholderTextColor={C.sub} style={s.input}
        onFocus={() => { setFocus(true); setQ(''); }} onBlur={() => setTimeout(() => setFocus(false), 150)} />
      {focus && (
        <View style={s.dropdown}>
          {results.length === 0 && <Text style={{ color: C.sub, padding: 10 }}>Sin resultados</Text>}
          {results.map((i) => (
            <Pressable key={i.id} style={s.dropItem} onPress={() => { onSelect(i); setQ(i.name); setFocus(false); }}>
              <Text style={{ color: C.text }}>{i.name}</Text>
              <Text style={{ color: C.sub, fontSize: 11 }}>{i.kcal} kcal / {i.servingGrams} g</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/* ---------------- Fila de ingrediente ---------------- */
function ItemRow({ item, ingredients, onChange, onDelete, z }: {
  item: MealItem; ingredients: Ingredient[]; onChange: (i: MealItem) => void; onDelete: () => void; z: number;
}) {
  const ing = ingredients.find((i) => i.id === item.ingredientId);
  const m = scaleMacros(ing, item.grams);
  return (
    <View style={[s.itemRow, { zIndex: z }]}>
      <View style={[s.row, { gap: 8 }]}>
        <IngredientSearch ingredients={ingredients} selected={ing}
          onSelect={(i) => onChange({ ...item, ingredientId: i.id, grams: item.grams || i.servingGrams })} />
        <View style={[s.row, s.gramsBox]}>
          <TextInput value={item.grams ? String(item.grams) : ''} keyboardType="decimal-pad" placeholder="0"
            placeholderTextColor={C.sub} style={{ color: C.text, width: 44, textAlign: 'right', paddingVertical: 8 }}
            onChangeText={(t) => onChange({ ...item, grams: parseFloat(t.replace(',', '.')) || 0 })} />
          <Text style={{ color: C.sub, marginLeft: 3 }}>g</Text>
        </View>
        <Pressable onPress={onDelete} hitSlop={8}><Ionicons name="close-circle" size={22} color={C.sub} /></Pressable>
      </View>
      <MacroChips m={m} />
    </View>
  );
}

export function MacroChips({ m }: { m: Macros }) {
  return (
    <View style={[s.row, { gap: 6, marginTop: 8 }]}>
      <Chip color={C.kcal} label={`${Math.round(m.kcal)} kcal`} />
      <Chip color={C.carbs} label={`C ${fmt(m.carbs)}`} />
      <Chip color={C.protein} label={`P ${fmt(m.protein)}`} />
      <Chip color={C.fat} label={`G ${fmt(m.fat)}`} />
    </View>
  );
}
const Chip = ({ color, label }: { color: string; label: string }) => (
  <View style={[s.chip, { backgroundColor: color + '22' }]}><Text style={{ color, fontSize: 12, fontWeight: '700' }}>{label}</Text></View>
);

/* ---------------- Bloque de comida ---------------- */
export function MealBlockCard({ block, ingredients, onChange, onDelete, z = 1, extra }: {
  block: MealBlock; ingredients: Ingredient[]; onChange: (b: MealBlock) => void; onDelete?: () => void; z?: number;
  extra?: React.ReactNode;
}) {
  const total = itemsTotal(block.items, ingredients);
  const setItem = (it: MealItem) => onChange({ ...block, items: block.items.map((x) => (x.id === it.id ? it : x)) });
  return (
    <View style={[s.card, { zIndex: z }]}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <TextInput value={block.name} onChangeText={(name) => onChange({ ...block, name })}
          style={{ color: C.text, fontSize: 18, fontWeight: '800', flex: 1 }} placeholder="Nombre" placeholderTextColor={C.sub} />
        {extra}
        {onDelete && <Pressable onPress={onDelete} hitSlop={8} style={{ marginLeft: 10 }}><Ionicons name="trash-outline" size={20} color={C.danger} /></Pressable>}
      </View>
      <MacroChips m={total} />
      <View style={{ marginTop: 10 }}>
        {block.items.map((it, idx) => (
          <ItemRow key={it.id} item={it} ingredients={ingredients} z={block.items.length - idx} onChange={setItem}
            onDelete={() => onChange({ ...block, items: block.items.filter((x) => x.id !== it.id) })} />
        ))}
      </View>
      <Pressable style={s.addLine}
        onPress={() => onChange({ ...block, items: [...block.items, { id: uid(), ingredientId: null, grams: 0 }] })}>
        <Ionicons name="add" size={18} color={C.accent} />
        <Text style={{ color: C.accent, fontWeight: '700', marginLeft: 4 }}>Agregar ingrediente</Text>
      </Pressable>
    </View>
  );
}

export function PrimaryButton({ icon, label, onPress, ghost }: { icon: any; label: string; onPress: () => void; ghost?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.primary, ghost && s.ghost, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}>
      <Ionicons name={icon} size={18} color={ghost ? C.accent : '#fff'} />
      <Text style={{ color: ghost ? C.accent : '#fff', fontWeight: '800', marginLeft: 6 }}>{label}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  row: { flexDirection: 'row', alignItems: 'center' },
  barBg: { height: 8, backgroundColor: C.card2, borderRadius: 4, marginTop: 5, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  seg: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.border },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segActive: { backgroundColor: C.accent },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  dateBtn: { backgroundColor: C.card, paddingHorizontal: 18, height: 40, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 20 },
  input: { backgroundColor: C.card2, color: C.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: C.border },
  dropdown: { position: 'absolute', top: 42, left: 0, right: 0, backgroundColor: C.card2, borderRadius: 10, borderWidth: 1, borderColor: C.accent + '66', zIndex: 100, elevation: 10 },
  dropItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  itemRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  gramsBox: { backgroundColor: C.card2, borderRadius: 10, paddingHorizontal: 8, borderWidth: 1, borderColor: C.border },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  addLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginTop: 6, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: C.accent + '88' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, paddingVertical: 14, borderRadius: 14, flex: 1 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.accent },
  h1: { color: C.text, fontSize: 30, fontWeight: '800' },
  label: { color: C.sub, fontSize: 12, marginBottom: 4, marginTop: 10 },
});
