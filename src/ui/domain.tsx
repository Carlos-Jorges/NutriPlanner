// Components that know about NutriPlanner's domain: food items, fridges, meals.

import { Pressable, StyleSheet, View } from 'react-native';

import { formatShortDate } from '@/core/dates';
import { describeAlert, storageAlert } from '@/core/storage-alerts';
import type { Fridge, FridgeItem, Meal, Recipe, StorageKind } from '@/core/types';
import { formatQuantity } from '@/core/units';
import { Badge, Icon, type IconName, Row, ShelfBar, TapeLabel, Txt } from './components';
import { color, radius, space, type Tone, tones } from './theme';

export const KIND_ICON: Record<StorageKind, IconName> = { fridge: 'fridge-outline', freezer: 'snowflake' };
export const KIND_TONE: Record<StorageKind, Tone> = { fridge: 'leaf', freezer: 'frost' };
export const KIND_LABEL: Record<StorageKind, string> = { fridge: 'Fridge', freezer: 'Freezer' };

export function tapeDate(ms: number): string {
  return formatShortDate(ms).toUpperCase();
}

export function KindIcon({ kind, size = 40 }: { kind: StorageKind; size?: number }) {
  const t = tones[KIND_TONE[kind]];
  return (
    <View style={[styles.kindIcon, { width: size, height: size, backgroundColor: t.bg }]}>
      <Icon name={KIND_ICON[kind]} size={size * 0.5} color={t.fg} />
    </View>
  );
}

/** One stored item: tape label with the storage date, name, amount and its storage clock. */
export function ItemRow({
  item,
  fridge,
  now,
  onPress,
  showFridge,
}: {
  item: FridgeItem;
  fridge?: Fridge;
  now: number;
  onPress?: () => void;
  showFridge?: boolean;
}) {
  const alert = storageAlert(item, now);
  const badge =
    item.status === 'defrosting'
      ? { label: alert.level === 'due' ? 'Cook now' : 'Defrosting', tone: alert.level === 'due' ? 'tomato' : 'frost' }
      : alert.level === 'due'
        ? { label: 'Use now', tone: 'tomato' }
        : alert.level === 'soon'
          ? { label: 'Soon', tone: 'amber' }
          : null;
  const details = [formatQuantity(item.quantity, item.unit), showFridge && fridge ? fridge.name : null].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${item.name}, ${details}, stored ${formatShortDate(item.storedAt)}, ${describeAlert(item, now)}`}
      testID={`item-${item.id}`}
      style={({ pressed }) => [styles.itemRow, pressed && styles.pressed]}>
      <View style={styles.tapeColumn}>
        <TapeLabel text={tapeDate(item.storedAt)} angle={item.id.length % 2 === 0 ? -2.5 : 1.5} />
      </View>
      <View style={styles.flex}>
        <Row gap={space.sm} style={styles.spread}>
          <Txt variant="heading" numberOfLines={1} style={styles.flex}>
            {item.name}
          </Txt>
          {badge ? <Badge label={badge.label} tone={badge.tone as Tone} /> : null}
        </Row>
        <Txt variant="callout" tone={color.inkSoft} numberOfLines={1}>
          {details}
        </Txt>
        <View style={styles.clock}>
          <ShelfBar progress={alert.progress} level={alert.level} />
          <Txt variant="caption" tone={alert.level === 'ok' ? color.inkSoft : tones[alert.level === 'due' ? 'tomato' : 'amber'].fg}>
            {describeAlert(item, now)}
          </Txt>
        </View>
      </View>
    </Pressable>
  );
}

export function slotLabel(slot: Meal['slot']): string {
  return slot === 'lunch' ? 'Lunch' : 'Dinner';
}

/** A meal in the calendar. Proposals have a dashed outline until an admin approves them. */
export function MealChip({
  meal,
  recipe,
  defrostNote,
  onPress,
}: {
  meal: Meal;
  recipe: Recipe | undefined;
  defrostNote?: string;
  onPress: () => void;
}) {
  const proposed = meal.status === 'proposed';
  const rejected = meal.status === 'rejected';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${meal.title}${proposed ? `, proposed by ${meal.proposedByName}` : ''}${rejected ? ', declined' : ''}`}
      style={({ pressed }) => [
        styles.mealChip,
        proposed && styles.mealProposed,
        rejected && styles.mealRejected,
        pressed && styles.pressed,
      ]}>
      <Row gap={space.xs}>
        {recipe && recipe.defrostHours > 0 && !rejected ? <Icon name="snowflake" size={13} color={color.frost} /> : null}
        <Txt
          variant="callout"
          numberOfLines={2}
          style={[styles.flex, styles.mealTitle, rejected && styles.strike]}
          tone={rejected ? color.inkFaint : color.ink}>
          {meal.title}
        </Txt>
      </Row>
      {proposed ? (
        <Txt variant="caption" tone={color.amber}>
          Proposed by {meal.proposedByName}
        </Txt>
      ) : rejected ? (
        <Txt variant="caption" tone={color.inkFaint}>
          Declined
        </Txt>
      ) : defrostNote ? (
        <Txt variant="caption" tone={color.frost}>
          {defrostNote}
        </Txt>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  spread: { justifyContent: 'space-between' },
  pressed: { opacity: 0.7 },
  kindIcon: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  itemRow: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, alignItems: 'flex-start' },
  tapeColumn: { width: 70, paddingTop: 2, alignItems: 'flex-start' },
  clock: { gap: 4, marginTop: 6 },
  mealChip: {
    borderRadius: radius.sm,
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    gap: 2,
  },
  mealProposed: { borderStyle: 'dashed', borderColor: color.amber, backgroundColor: color.amberSoft },
  mealRejected: { backgroundColor: 'transparent' },
  mealTitle: { fontWeight: '600' },
  strike: { textDecorationLine: 'line-through' },
});
