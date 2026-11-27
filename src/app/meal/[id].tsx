// One planned meal: its recipe, defrost timing and approval.

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { formatLongDay, formatTime, formatWhen, formatWhenInSentence, mealDateTime, parseDayKey } from '@/core/dates';
import { buildDefrostPlan } from '@/core/defrost';
import { formatQuantity } from '@/core/units';
import { deleteMeal, reviewMeal } from '@/data/services/planning';
import { useBackend } from '@/state/backend-context';
import { GroupGate, useGroup } from '@/state/group-data';
import { useSession } from '@/state/session';
import { Badge, Banner, Button, Card, EmptyState, HeaderButton, Icon, Loading, Row, Screen, Txt, useToast } from '@/ui/components';
import { confirmAction } from '@/ui/dialogs';
import { slotLabel, tapeDate } from '@/ui/domain';
import { useAction } from '@/ui/use-action';
import { color, space } from '@/ui/theme';

export default function MealScreen() {
  return (
    <GroupGate fallback={<Loading />}>
      <MealDetail />
    </GroupGate>
  );
}

const STATUS = {
  confirmed: { label: 'On the plan', tone: 'leaf' },
  proposed: { label: 'Waiting for approval', tone: 'amber' },
  rejected: { label: 'Declined', tone: 'neutral' },
} as const;

function MealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store } = useBackend();
  const { actor } = useSession();
  const { group, groupId, meals, recipes, items, fridges, isAdmin, now } = useGroup();
  const router = useRouter();
  const toast = useToast();
  const { busy, error, run } = useAction();
  const meal = meals.find((m) => m.id === id);

  if (!meal) {
    return (
      <Screen>
        <EmptyState icon="calendar-remove-outline" title="Meal not found" body="It may have been removed from the plan." />
      </Screen>
    );
  }

  const recipe = meal.recipeId ? recipes.find((r) => r.id === meal.recipeId) : undefined;
  const times = { lunchTime: group.lunchTime, dinnerTime: group.dinnerTime };
  const mealAt = mealDateTime(meal.date, meal.slot, times);
  const task = buildDefrostPlan({ meals, recipes, items, fridges, times, now, horizonDays: 60 }).find((t) => t.meal.id === meal.id);
  const mine = meal.proposedBy === actor?.uid;
  const status = STATUS[meal.status];

  const review = (decision: 'confirmed' | 'rejected') => {
    if (!actor) return;
    void run(decision, async () => {
      await reviewMeal(store, groupId, actor, meal, decision, recipe ?? null);
      toast(decision === 'confirmed' ? 'Approved' : 'Declined');
    });
  };

  const remove = async () => {
    const ok = await confirmAction(isAdmin ? 'Remove from the plan?' : 'Withdraw this proposal?', meal.title, isAdmin ? 'Remove' : 'Withdraw', true);
    if (!ok) return;
    void run('delete', async () => {
      await deleteMeal(store, groupId, meal.id);
      toast(isAdmin ? 'Removed from the plan' : 'Proposal withdrawn');
      router.back();
    });
  };

  return (
    <Screen testID="meal-screen">
      <Stack.Screen options={{ title: slotLabel(meal.slot), headerLeft: () => <HeaderButton label="Close" icon="close" onPress={() => router.back()} /> }} />
      <View style={styles.hero}>
        <Txt variant="label" tone={color.inkSoft}>
          {formatLongDay(parseDayKey(meal.date))} · {slotLabel(meal.slot)} at {formatTime(mealAt)}
        </Txt>
        <Txt variant="title">{meal.title}</Txt>
        <Row gap={space.sm}>
          <Badge label={status.label} tone={status.tone} />
          <Txt variant="caption" tone={color.inkSoft}>
            {meal.status === 'proposed' ? `Proposed by ${meal.proposedByName}` : `Added by ${meal.proposedByName}`}
          </Txt>
        </Row>
      </View>

      {meal.status === 'proposed' && isAdmin ? (
        <Card>
          <Txt variant="heading">Approve this meal?</Txt>
          {recipe?.status === 'pending' ? (
            <Txt variant="callout" tone={color.inkSoft}>
              It uses a new recipe from {recipe.proposedByName}. Approving the meal approves the recipe too.
            </Txt>
          ) : null}
          <Row gap={space.sm}>
            <Button label="Approve" icon="check" loading={busy === 'confirmed'} onPress={() => review('confirmed')} style={styles.flex} testID="approve-meal" />
            <Button label="Decline" variant="secondary" loading={busy === 'rejected'} onPress={() => review('rejected')} style={styles.flex} />
          </Row>
        </Card>
      ) : null}

      {task ? (
        <Card style={task.status === 'due' ? styles.due : undefined}>
          <Row gap={space.sm}>
            <Icon name="snowflake-melt" size={20} color={color.frost} />
            <Txt variant="heading">
              {task.status === 'done'
                ? 'Already defrosting'
                : task.status === 'due'
                  ? `Take out now (was due ${formatWhenInSentence(task.takeOutAt.getTime(), now)})`
                  : `Take out ${formatWhen(task.takeOutAt.getTime(), now)}`}
            </Txt>
          </Row>
          <Txt variant="callout" tone={color.inkSoft}>
            {recipe?.name} needs {recipe?.defrostHours} hours in the fridge before cooking.
          </Txt>
          {task.picks.map((pick) => (
            <Txt key={pick.item.id} variant="callout">
              {pick.alreadyDefrosting ? '✓ ' : '• '}
              {pick.item.name}, {formatQuantity(pick.ingredient.quantity, pick.ingredient.unit)}
              <Txt variant="callout" tone={color.inkSoft}>
                {pick.alreadyDefrosting ? ' (defrosting)' : ` from ${pick.fridge?.name ?? 'the freezer'}, stored ${tapeDate(pick.item.storedAt)}`}
              </Txt>
            </Txt>
          ))}
        </Card>
      ) : null}

      {recipe ? (
        <Card onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })} accessibilityLabel={`Open recipe ${recipe.name}`}>
          <Row gap={space.sm}>
            <Txt variant="heading" style={styles.flex}>
              Ingredients
            </Txt>
            <Icon name="chevron-right" size={20} color={color.inkFaint} />
          </Row>
          {recipe.ingredients.map((ingredient, index) => (
            <Row key={`${ingredient.name}-${index}`} gap={space.sm}>
              <Txt variant="callout" style={styles.flex}>
                {ingredient.name}
              </Txt>
              <Txt variant="callout" tone={color.inkSoft}>
                {formatQuantity(ingredient.quantity, ingredient.unit)}
              </Txt>
            </Row>
          ))}
        </Card>
      ) : null}

      {error ? <Banner kind="error" text={error} /> : null}

      {isAdmin || (mine && meal.status !== 'confirmed') ? (
        <Button
          label={isAdmin ? 'Remove from plan' : 'Withdraw proposal'}
          variant="danger"
          loading={busy === 'delete'}
          onPress={() => void remove()}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  due: { borderColor: color.amber, borderWidth: 1 },
});
