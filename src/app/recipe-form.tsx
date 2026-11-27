// Create (admins), propose (members) or edit (admins) a recipe.

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Recipe, Unit } from '@/core/types';
import { formatNumber, parseQuantity, UNITS, UNIT_LABEL } from '@/core/units';
import { saveRecipe } from '@/data/services/planning';
import { useBackend } from '@/state/backend-context';
import { GroupGate, useGroup } from '@/state/group-data';
import { useSession } from '@/state/session';
import { Banner, Button, Card, Chips, EmptyState, Field, HeaderButton, Icon, Loading, Row, Screen, SectionHeader, Txt, useToast } from '@/ui/components';
import { useAction } from '@/ui/use-action';
import { color, space } from '@/ui/theme';

const DEFROST_OPTIONS = [0, 6, 12, 24, 36, 48].map((h) => ({ value: h, label: h === 0 ? 'None' : `${h} h` }));

interface Line {
  key: number;
  name: string;
  quantity: string;
  unit: Unit;
}

export default function RecipeFormScreen() {
  return (
    <GroupGate fallback={<Loading />}>
      <RecipeForm />
    </GroupGate>
  );
}

function RecipeForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { recipes, isAdmin } = useGroup();
  const existing = id ? recipes.find((r) => r.id === id) : undefined;
  if (id && (!existing || !isAdmin)) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Cannot edit this recipe" body="Only admins can edit recipes." />
      </Screen>
    );
  }
  return <RecipeFormBody existing={existing} />;
}

function RecipeFormBody({ existing }: { existing?: Recipe }) {
  const { store } = useBackend();
  const { actor } = useSession();
  const { groupId, isAdmin } = useGroup();
  const router = useRouter();
  const toast = useToast();
  const { busy, error, setError, run } = useAction();

  const [name, setName] = useState(existing?.name ?? '');
  const [defrostHours, setDefrostHours] = useState(existing?.defrostHours ?? 0);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [nextKey, setNextKey] = useState(100);
  const [lines, setLines] = useState<Line[]>(
    existing?.ingredients.map((i, key) => ({ key, name: i.name, quantity: formatNumber(i.quantity), unit: i.unit })) ?? [
      { key: 0, name: '', quantity: '', unit: 'g' },
    ],
  );

  const update = (key: number, patch: Partial<Line>) => setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => {
    setLines((all) => [...all, { key: nextKey, name: '', quantity: '', unit: 'g' }]);
    setNextKey((k) => k + 1);
  };
  const removeLine = (key: number) => setLines((all) => (all.length > 1 ? all.filter((l) => l.key !== key) : all));

  const save = () => {
    if (!actor) return;
    const filled = lines.filter((l) => l.name.trim());
    const bad = filled.find((l) => parseQuantity(l.quantity) === null);
    if (bad) return setError(`Give "${bad.name.trim()}" a quantity, for example 500 or 1.5.`);
    void run('save', async () => {
      await saveRecipe(
        store,
        groupId,
        actor,
        isAdmin,
        {
          name,
          defrostHours,
          notes,
          ingredients: filled.map((l) => ({ name: l.name, quantity: parseQuantity(l.quantity) ?? 0, unit: l.unit })),
        },
        existing,
      );
      toast(existing ? 'Recipe saved' : isAdmin ? `Added ${name.trim()}` : 'Proposed. An admin will review it.');
      router.back();
    });
  };

  return (
    <Screen
      testID="recipe-form"
      footer={
        <Button
          label={existing ? 'Save changes' : isAdmin ? 'Save recipe' : 'Propose recipe'}
          loading={busy === 'save'}
          disabled={!name.trim()}
          onPress={save}
          testID="save-recipe"
        />
      }>
      <Stack.Screen
        options={{
          title: existing ? 'Edit recipe' : isAdmin ? 'New recipe' : 'Propose a recipe',
          headerLeft: () => <HeaderButton label="Close" icon="close" onPress={() => router.back()} />,
        }}
      />
      <Field label="Recipe name" value={name} onChangeText={setName} placeholder="For example, Chicken stir fry" testID="recipe-name" />
      <Chips label="Defrost time before cooking" options={DEFROST_OPTIONS} value={defrostHours} onChange={setDefrostHours} />
      <Txt variant="caption" tone={color.inkSoft}>
        Set once here and every planned meal works out its own take out time. As a guide, the fridge needs about a day
        for 500 g of mince or chicken pieces, and longer for large joints.
      </Txt>

      <View style={styles.section}>
        <SectionHeader title="Ingredients" count={lines.filter((l) => l.name.trim()).length} />
        {lines.map((line, index) => (
          <Card key={line.key} style={styles.line}>
            <Row gap={space.sm} style={styles.top}>
              <Field
                label={`Ingredient ${index + 1}`}
                value={line.name}
                onChangeText={(value) => update(line.key, { name: value })}
                placeholder="For example, Chicken thighs"
                containerStyle={styles.flex}
                testID={`ingredient-name-${index}`}
              />
              <Field
                label="Amount"
                value={line.quantity}
                onChangeText={(value) => update(line.key, { quantity: value })}
                keyboardType="decimal-pad"
                placeholder="500"
                containerStyle={styles.amount}
                testID={`ingredient-qty-${index}`}
              />
            </Row>
            <Row gap={space.sm} style={styles.top}>
              <View style={styles.flex}>
                <Chips options={UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u] }))} value={line.unit} onChange={(unit) => update(line.key, { unit })} />
              </View>
              {lines.length > 1 ? (
                <Pressable onPress={() => removeLine(line.key)} accessibilityRole="button" accessibilityLabel={`Remove ingredient ${index + 1}`} hitSlop={8} style={styles.remove}>
                  <Icon name="close" size={20} color={color.inkSoft} />
                </Pressable>
              ) : null}
            </Row>
          </Card>
        ))}
        <Button small variant="soft" icon="plus" label="Add ingredient" onPress={addLine} testID="add-ingredient" />
      </View>

      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Method, tips, serving size" multiline />
      {error ? <Banner kind="error" text={error} /> : null}
      {!isAdmin ? <Banner kind="info" text="An admin reviews new recipes before they join the family list." /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  top: { alignItems: 'flex-start' },
  section: { gap: space.sm },
  line: { padding: space.md, gap: space.sm },
  amount: { width: 96 },
  remove: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
});
