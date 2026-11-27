// Shopping list, split into fresh food for this week and frozen or bulk buys.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { pendingConsumptions, splitByCategory } from '@/core/shopping';
import type { ShoppingCategory, ShoppingItem, Unit } from '@/core/types';
import { formatQuantity, parseQuantity, UNITS, UNIT_LABEL } from '@/core/units';
import { addShoppingItem, clearChecked, generateFromUsed, removeShoppingItem, setChecked } from '@/data/services/shopping';
import { useBackend } from '@/state/backend-context';
import { useGroup } from '@/state/group-data';
import { useSession } from '@/state/session';
import { Banner, Button, Card, Checkbox, Chips, Divider, EmptyState, Field, Icon, PageHeader, Row, Screen, SectionHeader, Txt, useToast } from '@/ui/components';
import { useAction } from '@/ui/use-action';
import { color, space } from '@/ui/theme';

const SECTIONS: { category: ShoppingCategory; title: string; hint: string }[] = [
  { category: 'fresh', title: 'Fresh this week', hint: 'For the fridge and this week\'s meals.' },
  { category: 'frozen', title: 'Frozen and bulk', hint: 'Bought to go into the freezer.' },
];

export default function ShoppingScreen() {
  const { group, groupId, shopping, consumptions } = useGroup();
  const { store } = useBackend();
  const { actor } = useSession();
  const router = useRouter();
  const toast = useToast();
  const { busy, error, run } = useAction();
  const split = splitByCategory(shopping);
  const checked = shopping.filter((s) => s.checked);
  const used = pendingConsumptions(consumptions);

  const generate = () => {
    if (!actor) return;
    void run('generate', async () => {
      const { added, updated } = await generateFromUsed(store, groupId, actor, consumptions, shopping);
      const parts = [added ? `${added} added` : '', updated ? `${updated} topped up` : ''].filter(Boolean);
      toast(parts.length ? `Shopping list: ${parts.join(', ')}` : 'Nothing new to add');
    });
  };

  return (
    <Screen
      testID="shopping-screen"
      footer={
        checked.length > 0 ? (
          <Row gap={space.sm}>
            <Button
              label={`Put away ${checked.length}`}
              icon="fridge-outline"
              onPress={() => router.push('/put-away')}
              style={styles.flex}
              testID="put-away"
            />
            <Button
              label="Clear ticked"
              variant="secondary"
              loading={busy === 'clear'}
              onPress={() => void run('clear', () => clearChecked(store, groupId, shopping))}
            />
          </Row>
        ) : undefined
      }>
      <PageHeader eyebrow={group.name} title="Shopping" />

      {used.length > 0 ? (
        <Card style={styles.usedCard} testID="from-used">
          <Row gap={space.sm}>
            <Icon name="history" size={22} color={color.evergreen} />
            <Txt variant="heading" style={styles.flex}>
              {used.length} {used.length === 1 ? 'thing was' : 'things were'} used since the last list
            </Txt>
          </Row>
          <Txt variant="callout" tone={color.inkSoft}>
            {used
              .slice(0, 4)
              .map((c) => c.itemName)
              .join(', ')}
            {used.length > 4 ? ` and ${used.length - 4} more` : ''}. Adding them sorts each one into fresh or frozen.
          </Txt>
          <Button label="Add what was used" icon="playlist-plus" loading={busy === 'generate'} onPress={generate} testID="generate" />
        </Card>
      ) : null}

      <AddLine />
      {error ? <Banner kind="error" text={error} /> : null}

      {shopping.length === 0 ? (
        <Card>
          <EmptyState icon="cart-outline" title="The list is empty" body="Add things above. Food that admins log as used can be added in one tap." />
        </Card>
      ) : (
        SECTIONS.map(({ category, title, hint }) => (
          <View key={category} style={styles.section} testID={`section-${category}`}>
            <SectionHeader title={title} count={split[category].filter((s) => !s.checked).length} />
            {split[category].length === 0 ? (
              <Txt variant="caption" tone={color.inkFaint}>
                Nothing here. {hint}
              </Txt>
            ) : (
              <Card style={styles.list}>
                {split[category].map((line, index) => (
                  <View key={line.id}>
                    {index > 0 ? <Divider /> : null}
                    <ShoppingRow line={line} />
                  </View>
                ))}
              </Card>
            )}
          </View>
        ))
      )}
    </Screen>
  );
}

function ShoppingRow({ line }: { line: ShoppingItem }) {
  const { store } = useBackend();
  const { groupId } = useGroup();
  const toggle = () => void setChecked(store, groupId, line.id, !line.checked).catch(() => undefined);
  return (
    <View style={styles.row} testID={`line-${line.id}`}>
      <Checkbox checked={line.checked} onPress={toggle} label={`${line.name}, ${line.checked ? 'ticked' : 'not ticked'}`} />
      <Pressable onPress={toggle} style={styles.flex} accessibilityElementsHidden importantForAccessibility="no">
        <Txt variant="heading" tone={line.checked ? color.inkFaint : color.ink} style={line.checked ? styles.strike : undefined}>
          {line.name}
        </Txt>
        <Txt variant="caption" tone={color.inkSoft}>
          {formatQuantity(line.quantity, line.unit)} · {line.source === 'auto' ? 'from what was used' : `added by ${line.addedByName}`}
        </Txt>
      </Pressable>
      <Pressable
        onPress={() => void removeShoppingItem(store, groupId, line.id).catch(() => undefined)}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${line.name}`}
        hitSlop={8}
        style={styles.remove}>
        <Icon name="close" size={18} color={color.inkFaint} />
      </Pressable>
    </View>
  );
}

function AddLine() {
  const { store } = useBackend();
  const { actor } = useSession();
  const { groupId } = useGroup();
  const toast = useToast();
  const { busy, error, setError, run } = useAction();
  const [name, setName] = useState('');
  const [quantityText, setQuantityText] = useState('1');
  const [unit, setUnit] = useState<Unit>('pcs');
  const [category, setCategory] = useState<ShoppingCategory>('fresh');
  const [open, setOpen] = useState(false);

  const add = () => {
    if (!actor) return;
    const quantity = parseQuantity(quantityText);
    if (quantity === null) return setError('Enter a quantity above zero.');
    void run('add', async () => {
      await addShoppingItem(store, groupId, actor, { name, quantity, unit, category });
      toast(`Added ${name.trim()}`);
      setName('');
      setQuantityText('1');
    });
  };

  if (!open) {
    return <Button label="Add to the list" variant="soft" icon="plus" onPress={() => setOpen(true)} testID="open-add-line" />;
  }

  return (
    <Card testID="add-line">
      <Field label="Item" value={name} onChangeText={setName} placeholder="For example, Lemons" onSubmitEditing={add} autoFocus testID="line-name" />
      <Row gap={space.md} style={styles.top}>
        <Field label="Quantity" value={quantityText} onChangeText={setQuantityText} keyboardType="decimal-pad" containerStyle={styles.amount} testID="line-qty" />
        <View style={styles.flex}>
          <Chips label="Unit" options={UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u] }))} value={unit} onChange={setUnit} />
        </View>
      </Row>
      <Chips
        label="Section"
        options={[
          { value: 'fresh', label: 'Fresh this week', icon: 'leaf' },
          { value: 'frozen', label: 'Frozen and bulk', icon: 'snowflake' },
        ]}
        value={category}
        onChange={setCategory}
      />
      {error ? <Banner kind="error" text={error} /> : null}
      <Row gap={space.sm}>
        <Button label="Add" icon="plus" loading={busy === 'add'} disabled={!name.trim()} onPress={add} style={styles.flex} testID="add-line-submit" />
        <Button label="Done" variant="ghost" onPress={() => setOpen(false)} />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  top: { alignItems: 'flex-start' },
  section: { gap: space.sm },
  list: { paddingVertical: space.xs, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  strike: { textDecorationLine: 'line-through' },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  amount: { width: 100 },
  usedCard: { backgroundColor: color.evergreenSoft, borderColor: color.evergreenSoft },
});
