// Fridges: what needs using, what is defrosting, and every fridge and freezer.

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { itemsNeedingAttention, sortFifo, storageAlert } from '@/core/storage-alerts';
import type { Fridge, FridgeItem } from '@/core/types';
import { useGroup } from '@/state/group-data';
import { notifierSupported, requestPermission } from '@/state/notifier';
import { SETTINGS, useSetting, writeSetting } from '@/state/device-settings';
import { Badge, Button, Card, Divider, EmptyState, Icon, PageHeader, Row, Screen, SectionHeader, TapeLabel, Txt } from '@/ui/components';
import { showMessage } from '@/ui/dialogs';
import { ItemRow, KIND_LABEL, KindIcon, tapeDate } from '@/ui/domain';
import { color, space, tones } from '@/ui/theme';

export default function FridgesScreen() {
  const { group, fridges, items, isAdmin, now } = useGroup();
  const router = useRouter();
  const fridgeById = new Map(fridges.map((f) => [f.id, f]));
  const attention = itemsNeedingAttention(items, now);
  const defrosting = sortFifo(items.filter((i) => i.status === 'defrosting'));
  // Fridges (everyday food) first, then freezers.
  const sortedFridges = [...fridges].sort((a, b) => Number(a.kind === 'freezer') - Number(b.kind === 'freezer') || a.name.localeCompare(b.name));

  const openItem = (item: FridgeItem) => router.push({ pathname: '/item/[id]', params: { id: item.id } });

  return (
    <Screen testID="fridges-screen">
      <PageHeader
        eyebrow={group.name}
        title="Fridges"
        right={
          fridges.length > 0 ? (
            <Button small variant="soft" icon="plus" label="Add food" onPress={() => router.push('/item-form')} testID="add-food" />
          ) : undefined
        }
      />

      {isAdmin && items.length === 0 && fridges.length > 0 ? (
        <Card testID="getting-started">
          <Txt variant="heading">Getting started</Txt>
          <Txt variant="callout" tone={color.inkSoft}>
            1. Add what is already in your fridge and freezer, with how many days it has been in there.
          </Txt>
          <Txt variant="callout" tone={color.inkSoft}>
            2. Invite your family from the Group tab.
          </Txt>
          <Txt variant="callout" tone={color.inkSoft}>
            3. Add a few recipes with their defrost times, then plan the week.
          </Txt>
        </Card>
      ) : null}

      {isAdmin ? <RemindersPrompt /> : null}

      {isAdmin && attention.length > 0 ? (
        <Card style={styles.alertCard} testID="use-soon">
          <Row gap={space.sm}>
            <Icon name="clock-alert-outline" size={22} color={color.amber} />
            <Txt variant="heading">Use soon</Txt>
            <Badge label={String(attention.length)} tone="amber" />
          </Row>
          <Txt variant="callout" tone={color.inkSoft}>
            These reached the storage time you set. Plan them into a meal, or take them out.
          </Txt>
          <View>
            {attention.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                <ItemRow item={item} fridge={fridgeById.get(item.fridgeId)} now={now} showFridge onPress={() => openItem(item)} />
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {defrosting.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Defrosting" count={defrosting.length} />
          <Card>
            {defrosting.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                <ItemRow item={item} fridge={fridgeById.get(item.fridgeId)} now={now} showFridge onPress={() => openItem(item)} />
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title="Storage"
          count={fridges.length}
          action={
            isAdmin && fridges.length > 0 ? (
              <Button small variant="ghost" icon="plus" label="Add fridge" onPress={() => router.push('/fridge-form')} testID="add-fridge" />
            ) : undefined
          }
        />
        {sortedFridges.length === 0 ? (
          <Card>
            <EmptyState
              icon="fridge-outline"
              title="No fridges yet"
              body={isAdmin ? 'Add your fridges and freezers to start tracking food.' : 'An admin needs to add the fridges first.'}
              action={isAdmin ? <Button label="Add a fridge" icon="plus" onPress={() => router.push('/fridge-form')} /> : undefined}
            />
          </Card>
        ) : (
          sortedFridges.map((fridge) => (
            <FridgeCard
              key={fridge.id}
              fridge={fridge}
              items={items.filter((i) => i.fridgeId === fridge.id && i.status === 'stored')}
              now={now}
              onPress={() => router.push({ pathname: '/fridge/[id]', params: { id: fridge.id } })}
            />
          ))
        )}
      </View>
    </Screen>
  );
}

function FridgeCard({ fridge, items, now, onPress }: { fridge: Fridge; items: FridgeItem[]; now: number; onPress: () => void }) {
  const fifo = sortFifo(items);
  const next = fifo[0];
  const due = items.filter((i) => storageAlert(i, now).level !== 'ok').length;
  return (
    <Card onPress={onPress} accessibilityLabel={`${fridge.name}, ${items.length} items`} testID={`fridge-${fridge.id}`}>
      <Row gap={space.md}>
        <KindIcon kind={fridge.kind} />
        <View style={styles.flex}>
          <Txt variant="heading">{fridge.name}</Txt>
          <Txt variant="callout" tone={color.inkSoft}>
            {KIND_LABEL[fridge.kind]} · {items.length} {items.length === 1 ? 'item' : 'items'}
          </Txt>
        </View>
        {due > 0 ? <Badge label={`${due} to use`} tone="amber" /> : null}
        <Icon name="chevron-right" size={22} color={color.inkFaint} />
      </Row>
      {next ? (
        <Row gap={space.sm} style={styles.nextRow}>
          <Txt variant="caption" tone={color.inkSoft}>
            Use first
          </Txt>
          <TapeLabel text={tapeDate(next.storedAt)} angle={-1.5} />
          <Txt variant="callout" numberOfLines={1} style={styles.flex}>
            {next.name}
          </Txt>
        </Row>
      ) : (
        <Txt variant="caption" tone={color.inkFaint}>
          Empty
        </Txt>
      )}
    </Card>
  );
}

/** Admins on a phone are offered reminders once; the choice lives in the Group tab after that. */
function RemindersPrompt() {
  const setting = useSetting(SETTINGS.reminders);
  if (!notifierSupported || setting !== null) return null;
  const turnOn = async () => {
    const granted = await requestPermission();
    await writeSetting(SETTINGS.reminders, granted ? 'on' : 'off');
    if (!granted) showMessage('Notifications are off', 'You can allow them for Expo Go or NutriPlanner in your phone settings.');
  };
  return (
    <Card style={{ backgroundColor: tones.frost.bg, borderColor: tones.frost.bg }}>
      <Row gap={space.sm}>
        <Icon name="bell-ring-outline" size={22} color={color.frost} />
        <Txt variant="heading" tone={color.frost}>
          Get reminders on this phone
        </Txt>
      </Row>
      <Txt variant="callout" tone={color.frost}>
        A nudge when food reaches its storage time, and when to take frozen food out for planned meals.
      </Txt>
      <Row gap={space.sm}>
        <Button small label="Turn on" onPress={() => void turnOn()} />
        <Button small variant="ghost" label="Not now" onPress={() => void writeSetting(SETTINGS.reminders, 'off')} />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: { gap: space.sm },
  alertCard: { borderColor: color.amber, borderWidth: 1 },
  nextRow: { paddingTop: space.xs },
});
