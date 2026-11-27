// Plan: proposals waiting for approval, the defrost plan, and the week's
// lunches and dinners.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  addDays,
  dayKey,
  formatClock,
  formatDayLabel,
  formatTime,
  formatWeekRange,
  formatWhen,
  formatWhenInSentence,
  parseDayKey,
  startOfWeek,
  weekDays,
  weekdayName,
} from '@/core/dates';
import { buildDefrostPlan, type DefrostTask } from '@/core/defrost';
import type { Meal, Slot } from '@/core/types';
import { formatQuantity } from '@/core/units';
import { reviewMeal } from '@/data/services/planning';
import { amountForRecipe, takeOut } from '@/data/services/storage';
import { useBackend } from '@/state/backend-context';
import { useGroup } from '@/state/group-data';
import { useSession } from '@/state/session';
import { Badge, Banner, Button, Card, Divider, Icon, PageHeader, Row, Screen, SectionHeader, Txt, useToast } from '@/ui/components';
import { MealChip, slotLabel, tapeDate } from '@/ui/domain';
import { useAction } from '@/ui/use-action';
import { color, radius, space } from '@/ui/theme';

const SLOTS: Slot[] = ['lunch', 'dinner'];

export default function PlanScreen() {
  const data = useGroup();
  const { group, meals, recipes, items, fridges, isAdmin, now } = data;
  const { actor } = useSession();
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);

  const thisWeek = startOfWeek(new Date(now));
  const weekStart = addDays(thisWeek, weekOffset * 7);
  const days = weekDays(weekStart);
  const todayKey = dayKey(new Date(now));
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const times = { lunchTime: group.lunchTime, dinnerTime: group.dinnerTime };
  const plan = buildDefrostPlan({ meals, recipes, items, fridges, times, now });
  const taskByMeal = new Map(plan.map((t) => [t.meal.id, t]));

  const proposals = meals
    .filter((m) => m.status === 'proposed' && (isAdmin || m.proposedBy === actor?.uid))
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));

  const openMeal = (meal: Meal) => router.push({ pathname: '/meal/[id]', params: { id: meal.id } });
  const addMeal = (date: string, slot: Slot) => router.push({ pathname: '/meal-form', params: { date, slot } });

  return (
    <Screen testID="plan-screen">
      <PageHeader eyebrow={group.name} title="Plan" />

      {proposals.length > 0 ? <Proposals proposals={proposals} recipeById={recipeById} /> : null}

      <DefrostPlan tasks={plan.filter((t) => t.status !== 'done' || t.mealAt.getTime() - now < 36 * 3_600_000)} />

      <View style={styles.section}>
        <View style={styles.weekBar}>
          <Pressable onPress={() => setWeekOffset((w) => w - 1)} accessibilityRole="button" accessibilityLabel="Previous week" hitSlop={8} style={styles.weekArrow}>
            <Icon name="chevron-left" size={26} color={color.evergreen} />
          </Pressable>
          <View style={styles.weekLabel}>
            <Txt variant="heading">{formatWeekRange(weekStart)}</Txt>
            {weekOffset !== 0 ? (
              <Pressable onPress={() => setWeekOffset(0)} accessibilityRole="button" hitSlop={8}>
                <Txt variant="caption" tone={color.evergreen}>
                  Back to this week
                </Txt>
              </Pressable>
            ) : (
              <Txt variant="caption" tone={color.inkSoft}>
                This week
              </Txt>
            )}
          </View>
          <Pressable onPress={() => setWeekOffset((w) => w + 1)} accessibilityRole="button" accessibilityLabel="Next week" hitSlop={8} style={styles.weekArrow}>
            <Icon name="chevron-right" size={26} color={color.evergreen} />
          </Pressable>
        </View>

        <Card style={styles.week}>
          {days.map((day, index) => {
            const key = dayKey(day);
            const isToday = key === todayKey;
            const past = key < todayKey;
            return (
              <View key={key}>
                {index > 0 ? <Divider /> : null}
                <View style={[styles.day, isToday && styles.today]} testID={`day-${key}`}>
                  <View style={styles.dayLabel}>
                    <Txt variant="label" tone={isToday ? color.evergreen : color.inkSoft}>
                      {isToday ? 'Today' : weekdayName(day)}
                    </Txt>
                    <Txt variant="title" tone={past ? color.inkFaint : color.ink}>
                      {day.getDate()}
                    </Txt>
                  </View>
                  <View style={styles.slots}>
                    {SLOTS.map((slot) => {
                      const slotMeals = meals.filter((m) => m.date === key && m.slot === slot);
                      return (
                        <View key={slot} style={styles.slot}>
                          <Txt variant="caption" tone={color.inkSoft} style={styles.slotName}>
                            {slotLabel(slot)}
                          </Txt>
                          <View style={styles.slotMeals}>
                            {slotMeals.map((meal) => {
                              const task = taskByMeal.get(meal.id);
                              return (
                                <MealChip
                                  key={meal.id}
                                  meal={meal}
                                  recipe={meal.recipeId ? recipeById.get(meal.recipeId) : undefined}
                                  defrostNote={task ? defrostNote(task, now) : undefined}
                                  onPress={() => openMeal(meal)}
                                />
                              );
                            })}
                            {!past ? (
                              <Pressable
                                onPress={() => addMeal(key, slot)}
                                accessibilityRole="button"
                                accessibilityLabel={`${isAdmin ? 'Add' : 'Propose'} ${slot} for ${formatDayLabel(day)}`}
                                testID={`add-${key}-${slot}`}
                                style={({ pressed }) => [styles.addSlot, pressed && styles.pressed]}>
                                <Icon name="plus" size={14} color={slotMeals.length === 0 ? color.evergreen : color.inkFaint} />
                                {slotMeals.length === 0 ? (
                                  <Txt variant="caption" tone={color.evergreen}>
                                    {isAdmin ? 'Add' : 'Propose'}
                                  </Txt>
                                ) : null}
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
        <Txt variant="caption" tone={color.inkSoft}>
          Lunch {formatClock(group.lunchTime)} · Dinner {formatClock(group.dinnerTime)}.{' '}
          {isAdmin ? 'Change meal times in the Group tab.' : 'Your proposals appear dashed until an admin approves them.'}
        </Txt>
      </View>
    </Screen>
  );
}

function defrostNote(task: DefrostTask, now: number): string {
  if (task.status === 'done') return 'Defrosting';
  if (task.status === 'due') return 'Take out now';
  return `Take out ${formatWhen(task.takeOutAt.getTime(), now)}`;
}

function Proposals({ proposals, recipeById }: { proposals: Meal[]; recipeById: Map<string, ReturnType<typeof useGroup>['recipes'][number]> }) {
  const { store } = useBackend();
  const { actor } = useSession();
  const { groupId, isAdmin } = useGroup();
  const toast = useToast();
  const { busy, error, run } = useAction();

  const review = (meal: Meal, decision: 'confirmed' | 'rejected') => {
    if (!actor) return;
    void run(`${meal.id}-${decision}`, async () => {
      const recipe = meal.recipeId ? (recipeById.get(meal.recipeId) ?? null) : null;
      await reviewMeal(store, groupId, actor, meal, decision, recipe);
      toast(decision === 'confirmed' ? `Added ${meal.title} to the plan` : `Declined ${meal.title}`);
    });
  };

  return (
    <View style={styles.section} testID="proposals">
      <SectionHeader title={isAdmin ? 'Waiting for approval' : 'Your proposals'} count={proposals.length} />
      <Card>
        {proposals.map((meal, index) => {
          const recipe = meal.recipeId ? recipeById.get(meal.recipeId) : undefined;
          return (
            <View key={meal.id} style={styles.proposal}>
              {index > 0 ? <Divider /> : null}
              <Row gap={space.sm} style={styles.top}>
                <View style={styles.flex}>
                  <Txt variant="heading">{meal.title}</Txt>
                  <Txt variant="callout" tone={color.inkSoft}>
                    {formatDayLabel(parseDayKey(meal.date))} {slotLabel(meal.slot).toLowerCase()} · from {meal.proposedByName}
                  </Txt>
                  {recipe?.status === 'pending' ? (
                    <Txt variant="caption" tone={color.amber}>
                      New recipe. Approving the meal approves the recipe too.
                    </Txt>
                  ) : null}
                </View>
                {!isAdmin ? <Badge label="Waiting" tone="amber" /> : null}
              </Row>
              {isAdmin ? (
                <Row gap={space.sm}>
                  <Button small label="Approve" icon="check" loading={busy === `${meal.id}-confirmed`} onPress={() => review(meal, 'confirmed')} testID={`approve-${meal.id}`} />
                  <Button small variant="secondary" label="Decline" loading={busy === `${meal.id}-rejected`} onPress={() => review(meal, 'rejected')} />
                </Row>
              ) : null}
            </View>
          );
        })}
        {error ? <Banner kind="error" text={error} /> : null}
      </Card>
    </View>
  );
}

const TASK_BADGE = {
  due: { label: 'Due', tone: 'amber' },
  upcoming: { label: 'Coming up', tone: 'frost' },
  done: { label: 'Done', tone: 'leaf' },
} as const;

const TASK_HEADING = (task: DefrostTask, now: number) =>
  task.status === 'done' ? 'Defrosting now' : task.status === 'due' ? 'Take out now' : `Take out ${formatWhen(task.takeOutAt.getTime(), now)}`;

function DefrostPlan({ tasks }: { tasks: DefrostTask[] }) {
  const { store } = useBackend();
  const { actor } = useSession();
  const { groupId, isAdmin, now } = useGroup();
  const toast = useToast();
  const { busy, error, run } = useAction();

  const takeOutAll = (task: DefrostTask) => {
    if (!actor) return;
    void run(task.meal.id, async () => {
      for (const pick of task.picks.filter((p) => !p.alreadyDefrosting)) {
        const amount = amountForRecipe(pick.item, pick.ingredient.quantity, pick.ingredient.unit);
        await takeOut(store, groupId, actor, pick.item.id, pick.fridge ?? undefined, 'defrost', amount);
      }
      toast(`Defrosting for ${task.recipe.name}`);
    });
  };

  return (
    <View style={styles.section} testID="defrost-plan">
      <SectionHeader title="Defrost plan" count={tasks.length} />
      {tasks.length === 0 ? (
        <Card>
          <Row gap={space.sm}>
            <Icon name="snowflake-check" size={20} color={color.frost} />
            <Txt variant="callout" tone={color.inkSoft} style={styles.flex}>
              Nothing to defrost in the next 7 days. Recipes with a defrost time show up here once they are on the plan.
            </Txt>
          </Row>
        </Card>
      ) : (
        tasks.map((task) => {
          const badge = TASK_BADGE[task.status];
          const shifted = task.remindAt.getTime() !== task.takeOutAt.getTime();
          const toTake = task.picks.filter((p) => !p.alreadyDefrosting);
          return (
            <Card key={task.meal.id} style={task.status === 'due' ? styles.dueCard : undefined} testID={`defrost-${task.meal.id}`}>
              <Row gap={space.sm} style={styles.top}>
                <View style={styles.flex}>
                  <Txt variant="heading">{TASK_HEADING(task, now)}</Txt>
                  <Txt variant="callout" tone={color.inkSoft}>
                    For {weekdayName(task.mealAt)} {task.meal.slot} at {formatTime(task.mealAt)} · {task.recipe.name} ·{' '}
                    {task.recipe.defrostHours} h defrost
                  </Txt>
                  {task.status === 'due' ? (
                    <Txt variant="caption" tone={color.amber}>
                      Was due {formatWhenInSentence(task.takeOutAt.getTime(), now)}. Take it out now. If it is still frozen at
                      cooking time, finish thawing in the microwave and cook it straight away.
                    </Txt>
                  ) : null}
                  {shifted && task.status === 'upcoming' ? (
                    <Txt variant="caption" tone={color.frost}>
                      That is overnight, so the reminder comes at {formatWhen(task.remindAt.getTime(), now)}.
                    </Txt>
                  ) : null}
                </View>
                <Badge label={badge.label} tone={badge.tone} />
              </Row>
              {task.picks.length === 0 ? (
                <Txt variant="callout" tone={color.inkSoft}>
                  No matching food found in your freezers. Check the recipe ingredients, or add it to the shopping list.
                </Txt>
              ) : (
                <View style={styles.picks}>
                  {task.picks.map((pick) => (
                    <Row key={pick.item.id} gap={space.sm}>
                      <Icon
                        name={pick.alreadyDefrosting ? 'check-circle' : 'snowflake'}
                        size={16}
                        color={pick.alreadyDefrosting ? color.leaf : color.frost}
                      />
                      <Txt variant="callout" style={styles.flex}>
                        {pick.item.name}, {formatQuantity(pick.ingredient.quantity, pick.ingredient.unit)}
                        <Txt variant="callout" tone={color.inkSoft}>
                          {pick.alreadyDefrosting
                            ? ' · defrosting'
                            : ` · ${pick.fridge?.name ?? 'freezer'}, stored ${tapeDate(pick.item.storedAt)}`}
                        </Txt>
                      </Txt>
                    </Row>
                  ))}
                </View>
              )}
              {isAdmin && toTake.length > 0 ? (
                <Button
                  small
                  variant={task.status === 'due' ? 'primary' : 'soft'}
                  icon="snowflake-melt"
                  label={toTake.length === 1 ? 'Move it to defrosting' : `Move all ${toTake.length} to defrosting`}
                  loading={busy === task.meal.id}
                  onPress={() => takeOutAll(task)}
                  testID={`defrost-now-${task.meal.id}`}
                />
              ) : null}
            </Card>
          );
        })
      )}
      {error ? <Banner kind="error" text={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  top: { alignItems: 'flex-start' },
  pressed: { opacity: 0.7 },
  section: { gap: space.sm },
  proposal: { gap: space.sm, paddingVertical: space.xs },
  dueCard: { borderColor: color.amber, borderWidth: 1 },
  picks: { gap: space.xs },
  weekBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  weekArrow: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  weekLabel: { flex: 1, alignItems: 'center' },
  week: { paddingVertical: space.xs, paddingHorizontal: space.md, gap: 0 },
  day: { flexDirection: 'row', gap: space.md, paddingVertical: space.md },
  today: { backgroundColor: color.evergreenSoft, marginHorizontal: -space.md, paddingHorizontal: space.md },
  dayLabel: { width: 48, alignItems: 'flex-start' },
  slots: { flex: 1, gap: space.sm },
  slot: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  slotName: { width: 44, paddingTop: 7 },
  slotMeals: { flex: 1, gap: space.xs },
  addSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
});
