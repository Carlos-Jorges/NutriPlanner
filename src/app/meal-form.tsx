// Plan a meal (admins) or propose one (members).

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dayKey, formatLongDay, isDayKey, parseDayKey, startOfDay, startOfWeek, weekDays } from '@/core/dates';
import type { Recipe, Slot } from '@/core/types';
import { planMeal } from '@/data/services/planning';
import { useBackend } from '@/state/backend-context';
import { GroupGate, useGroup } from '@/state/group-data';
import { useSession } from '@/state/session';
import { Banner, Button, Card, Chips, Divider, Field, HeaderButton, Icon, Loading, Row, Screen, SectionHeader, Txt, useToast } from '@/ui/components';
import { useAction } from '@/ui/use-action';
import { color, space } from '@/ui/theme';

export default function MealFormScreen() {
  return (
    <GroupGate fallback={<Loading />}>
      <MealForm />
    </GroupGate>
  );
}

function MealForm() {
  const params = useLocalSearchParams<{ date?: string; slot?: string; recipeId?: string }>();
  const { store } = useBackend();
  const { actor } = useSession();
  const { groupId, recipes, isAdmin, now } = useGroup();
  const router = useRouter();
  const toast = useToast();
  const { busy, error, run } = useAction();

  const today = startOfDay(new Date(now));
  const initialDate = params.date && isDayKey(params.date) ? params.date : dayKey(today);
  const [date, setDate] = useState(initialDate);
  const [slot, setSlot] = useState<Slot>(params.slot === 'lunch' ? 'lunch' : 'dinner');
  const [recipeId, setRecipeId] = useState<string | null>(params.recipeId ?? null);
  const [title, setTitle] = useState('');

  const choosable = recipes
    .filter((r) => r.status === 'approved' || (r.status === 'pending' && r.proposedBy === actor?.uid))
    .sort((a, b) => a.name.localeCompare(b.name));
  const chosen = recipeId ? recipes.find((r) => r.id === recipeId) : undefined;
  const days = weekDays(startOfWeek(parseDayKey(initialDate))).filter((d) => dayKey(d) >= dayKey(today));
  const dayOptions = (days.length > 0 ? days : [today]).map((d) => ({ value: dayKey(d), label: formatLongDay(d).split(' ').slice(0, 2).join(' ') }));
  if (!dayOptions.some((o) => o.value === date)) dayOptions.unshift({ value: date, label: formatLongDay(parseDayKey(date)) });

  const save = () => {
    if (!actor) return;
    void run('save', async () => {
      await planMeal(store, groupId, actor, isAdmin, { date, slot, recipeId: chosen?.id ?? null, title: chosen?.name ?? title });
      toast(isAdmin ? `Planned ${chosen?.name ?? title.trim()}` : 'Proposed. An admin will approve it.');
      router.back();
    });
  };

  return (
    <Screen
      testID="meal-form"
      footer={
        <>
          {!isAdmin ? (
            <Txt variant="caption" tone={color.inkSoft}>
              An admin approves proposals before they are confirmed on the plan.
            </Txt>
          ) : null}
          <Button
            label={isAdmin ? 'Add to plan' : 'Propose meal'}
            loading={busy === 'save'}
            disabled={!chosen && !title.trim()}
            onPress={save}
            testID="save-meal"
          />
        </>
      }>
      <Stack.Screen
        options={{
          title: isAdmin ? 'Plan a meal' : 'Propose a meal',
          headerLeft: () => <HeaderButton label="Close" icon="close" onPress={() => router.back()} />,
        }}
      />
      <Chips label="Day" options={dayOptions} value={date} onChange={setDate} />
      <Chips
        label="Meal"
        options={[
          { value: 'lunch', label: 'Lunch', icon: 'weather-sunny' },
          { value: 'dinner', label: 'Dinner', icon: 'weather-night' },
        ]}
        value={slot}
        onChange={setSlot}
      />

      <View style={styles.section}>
        <SectionHeader
          title="Recipe"
          action={<Button small variant="ghost" icon="plus" label="New recipe" onPress={() => router.push('/recipe-form')} />}
        />
        <Card style={styles.list}>
          {choosable.length === 0 ? (
            <Txt variant="callout" tone={color.inkSoft}>
              No recipes yet. Add one, or just type what you are eating below.
            </Txt>
          ) : (
            choosable.map((recipe, index) => (
              <View key={recipe.id}>
                {index > 0 ? <Divider /> : null}
                <RecipeOption recipe={recipe} selected={recipe.id === recipeId} onPress={() => setRecipeId(recipe.id === recipeId ? null : recipe.id)} />
              </View>
            ))
          )}
        </Card>
      </View>

      {!chosen ? (
        <Field
          label="Or something else"
          value={title}
          onChangeText={setTitle}
          placeholder="For example, Leftovers or Eating out"
          testID="meal-title"
        />
      ) : null}
      {error ? <Banner kind="error" text={error} /> : null}
      <Txt variant="caption" tone={color.inkSoft}>
        Planning for {formatLongDay(parseDayKey(date))}
        {date === dayKey(today) ? ' (today)' : ''}.
      </Txt>
    </Screen>
  );
}

function RecipeOption({ recipe, selected, onPress }: { recipe: Recipe; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={recipe.name}
      testID={`recipe-option-${recipe.id}`}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
      <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={selected ? color.evergreen : color.inkFaint} />
      <View style={styles.flex}>
        <Txt variant="heading">{recipe.name}</Txt>
        <Row gap={space.xs}>
          {recipe.defrostHours > 0 ? <Icon name="snowflake" size={13} color={color.frost} /> : null}
          <Txt variant="caption" tone={color.inkSoft}>
            {recipe.defrostHours > 0 ? `Defrost ${recipe.defrostHours} h before` : 'No defrosting'} · {recipe.ingredients.length} ingredients
            {recipe.status === 'pending' ? ' · waiting for approval' : ''}
          </Txt>
        </Row>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  section: { gap: space.sm },
  list: { paddingVertical: space.xs, gap: 0 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
});
