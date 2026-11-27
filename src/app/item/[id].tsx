// One food item: its storage clock and, for admins, taking it out.

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatShortDate, formatWhen } from '@/core/dates';
import { describeAlert, storageAlert } from '@/core/storage-alerts';
import type { FridgeItem, TakeOutPurpose } from '@/core/types';
import { formatNumber, formatQuantity, parseQuantity, roundQty, UNIT_LABEL } from '@/core/units';
import { deleteItem, takeOut } from '@/data/services/storage';
import { useBackend } from '@/state/backend-context';
import { GroupGate, useGroup } from '@/state/group-data';
import { useSession } from '@/state/session';
import {
  Banner,
  Button,
  Card,
  type ChipOption,
  Chips,
  EmptyState,
  Field,
  HeaderButton,
  Loading,
  Row,
  Screen,
  ShelfBar,
  TapeLabel,
  Txt,
  useToast,
} from '@/ui/components';
import { confirmAction } from '@/ui/dialogs';
import { KIND_LABEL, KindIcon, tapeDate } from '@/ui/domain';
import { useAction } from '@/ui/use-action';
import { color, space } from '@/ui/theme';

export default function ItemScreen() {
  return (
    <GroupGate fallback={<Loading />}>
      <ItemDetail />
    </GroupGate>
  );
}

const PURPOSE_COPY: Record<TakeOutPurpose, { button: string; done: string; hint: string }> = {
  defrost: {
    button: 'Move to defrosting',
    done: 'Moved to defrosting',
    hint: 'It stays on the list as defrosting, with a 2 day cook by clock.',
  },
  use: {
    button: 'Log as used',
    done: 'Logged as used',
    hint: 'Used food is added to the shopping list next time someone taps "Add what was used".',
  },
  discard: {
    button: 'Log as thrown out',
    done: 'Logged as thrown out',
    hint: 'Thrown out food is recorded but not added back to the shopping list.',
  },
};

function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, fridges, isAdmin, groupId, now } = useGroup();
  const item = items.find((i) => i.id === id);
  if (!item) {
    return (
      <Screen>
        <EmptyState icon="food-off-outline" title="Already gone" body="This item was used up or removed." />
      </Screen>
    );
  }
  return <ItemBody key={item.id} item={item} fridge={fridges.find((f) => f.id === item.fridgeId)} isAdmin={isAdmin} groupId={groupId} now={now} />;
}

function ItemBody({
  item,
  fridge,
  isAdmin,
  groupId,
  now,
}: {
  item: FridgeItem;
  fridge: ReturnType<typeof useGroup>['fridges'][number] | undefined;
  isAdmin: boolean;
  groupId: string;
  now: number;
}) {
  const { store } = useBackend();
  const { actor } = useSession();
  const router = useRouter();
  const toast = useToast();
  const { busy, error, run } = useAction();

  const canDefrost = fridge?.kind === 'freezer' && item.status === 'stored';
  const purposes: ChipOption<TakeOutPurpose>[] = [
    ...(canDefrost ? [{ value: 'defrost' as const, label: 'Defrost', icon: 'snowflake-melt' as const }] : []),
    { value: 'use', label: 'Use', icon: 'silverware-fork-knife' },
    { value: 'discard', label: 'Throw out', icon: 'delete-outline' },
  ];
  const [purpose, setPurpose] = useState<TakeOutPurpose>(canDefrost ? 'defrost' : 'use');
  const [amountText, setAmountText] = useState(formatNumber(item.quantity));
  const amount = parseQuantity(amountText);
  const alert = storageAlert(item, now);

  const submit = () => {
    if (!actor || amount === null) return;
    void run('take', async () => {
      await takeOut(store, groupId, actor, item.id, fridge, purpose, Math.min(amount, item.quantity));
      toast(`${PURPOSE_COPY[purpose].done}: ${item.name}`);
      router.back();
    });
  };

  const remove = async () => {
    const ok = await confirmAction(`Delete ${item.name}?`, 'Use this for mistakes. To record food that was eaten or thrown out, use Take out instead.', 'Delete', true);
    if (!ok) return;
    void run('delete', async () => {
      await deleteItem(store, groupId, item.id);
      toast(`Deleted ${item.name}`);
      router.back();
    });
  };

  return (
    <Screen testID="item-screen">
      <Stack.Screen
        options={{
          title: item.name,
          headerLeft: () => <HeaderButton label="Close" icon="close" onPress={() => router.back()} />,
          headerRight: isAdmin
            ? () => <HeaderButton label="Edit" onPress={() => router.push({ pathname: '/item-form', params: { id: item.id } })} />
            : undefined,
        }}
      />

      <View style={styles.hero}>
        <TapeLabel text={tapeDate(item.storedAt)} angle={-3} large />
        <Txt variant="title">{item.name}</Txt>
        <Txt variant="heading" tone={color.inkSoft}>
          {formatQuantity(item.quantity, item.unit)}
        </Txt>
      </View>

      <Card>
        {fridge ? (
          <Row gap={space.md}>
            <KindIcon kind={fridge.kind} size={36} />
            <View style={styles.flex}>
              <Txt variant="heading">{fridge.name}</Txt>
              <Txt variant="caption" tone={color.inkSoft}>
                {KIND_LABEL[fridge.kind]}
              </Txt>
            </View>
          </Row>
        ) : null}
        <View style={styles.clock}>
          <ShelfBar progress={alert.progress} level={alert.level} />
          <Txt variant="callout">{describeAlert(item, now)}</Txt>
          <Txt variant="caption" tone={color.inkSoft}>
            {item.status === 'defrosting' && item.defrostStartedAt
              ? `Defrosting since ${formatWhen(item.defrostStartedAt, now)}. Cook within 2 days.`
              : `Stored ${formatShortDate(item.storedAt)} by ${item.addedByName}. Admins are alerted after ${item.alertAfterDays} ${item.alertAfterDays === 1 ? 'day' : 'days'}.`}
          </Txt>
        </View>
        {item.notes ? <Txt variant="callout">{item.notes}</Txt> : null}
      </Card>

      {isAdmin ? (
        <Card testID="take-out">
          <Txt variant="title">Take out</Txt>
          <Chips options={purposes} value={purpose} onChange={setPurpose} testID="purpose" />
          <Field
            label={`Amount (${UNIT_LABEL[item.unit]})`}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            error={amount === null ? 'Enter an amount above zero.' : amount > item.quantity ? `Only ${formatQuantity(item.quantity, item.unit)} left; the rest will be taken.` : undefined}
            testID="amount"
          />
          <Row gap={space.sm}>
            <Button small variant="soft" label="All" onPress={() => setAmountText(formatNumber(item.quantity))} />
            <Button small variant="soft" label="Half" onPress={() => setAmountText(formatNumber(roundQty(item.quantity / 2)))} />
          </Row>
          <Txt variant="caption" tone={color.inkSoft}>
            {PURPOSE_COPY[purpose].hint}
          </Txt>
          {error ? <Banner kind="error" text={error} /> : null}
          <Button
            label={PURPOSE_COPY[purpose].button}
            variant={purpose === 'discard' ? 'danger' : 'primary'}
            loading={busy === 'take'}
            disabled={amount === null}
            onPress={submit}
            testID="take-out-submit"
          />
          <Button label="Delete entry" variant="ghost" small loading={busy === 'delete'} onPress={() => void remove()} />
        </Card>
      ) : (
        <Banner kind="info" text="Only admins can take food out of storage. Want this eaten soon? Propose a meal that uses it." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.sm, alignItems: 'flex-start' },
  flex: { flex: 1, minWidth: 0 },
  clock: { gap: space.xs },
});
