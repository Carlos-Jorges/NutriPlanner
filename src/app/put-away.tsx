// After shopping: ticked lines go into fridges, stored today, and leave the list.
// Any member can do this.

import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Fridge, ShoppingItem } from '@/core/types';
import { formatNumber, parseQuantity, UNIT_LABEL } from '@/core/units';
import { putAway, type PutAwayLine } from '@/data/services/shopping';
import { useBackend } from '@/state/backend-context';
import { GroupGate, useGroup } from '@/state/group-data';
import { useSession } from '@/state/session';
import { Banner, Button, Card, Chips, EmptyState, Field, HeaderButton, Loading, Row, Screen, Stepper, Txt, useToast } from '@/ui/components';
import { KIND_ICON } from '@/ui/domain';
import { useAction } from '@/ui/use-action';
import { color, space } from '@/ui/theme';

interface Choice {
  fridgeId: string;
  quantity: string;
  alertAfterDays: number;
}

export default function PutAwayScreen() {
  return (
    <GroupGate fallback={<Loading />}>
      <PutAway />
    </GroupGate>
  );
}

function defaultFridge(line: ShoppingItem, fridges: Fridge[]): Fridge | undefined {
  const wanted = line.category === 'frozen' ? 'freezer' : 'fridge';
  return fridges.find((f) => f.kind === wanted) ?? fridges[0];
}

function PutAway() {
  const { store } = useBackend();
  const { actor } = useSession();
  const { groupId, shopping, fridges } = useGroup();
  const router = useRouter();
  const toast = useToast();
  const { busy, error, setError, run } = useAction();
  const lines = shopping.filter((s) => s.checked).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(
      lines.map((line) => {
        const fridge = defaultFridge(line, fridges);
        return [line.id, { fridgeId: fridge?.id ?? '', quantity: formatNumber(line.quantity), alertAfterDays: fridge?.defaultAlertDays ?? 3 }];
      }),
    ),
  );

  if (fridges.length === 0) {
    return (
      <Screen>
        <EmptyState icon="fridge-outline" title="No fridges yet" body="An admin needs to add a fridge or freezer first." />
      </Screen>
    );
  }
  if (lines.length === 0) {
    return (
      <Screen>
        <EmptyState icon="cart-check" title="Nothing ticked" body="Tick what you bought on the shopping list, then put it away here." />
      </Screen>
    );
  }

  const choose = (id: string, patch: Partial<Choice>) => setChoices((all) => ({ ...all, [id]: { ...all[id], ...patch } }));

  const save = () => {
    if (!actor) return;
    const payload: PutAwayLine[] = [];
    for (const line of lines) {
      const choice = choices[line.id];
      const quantity = choice ? parseQuantity(choice.quantity) : null;
      if (!choice || quantity === null) return setError(`Check the amount for ${line.name}.`);
      payload.push({ shoppingId: line.id, name: line.name, fridgeId: choice.fridgeId, quantity, unit: line.unit, alertAfterDays: choice.alertAfterDays });
    }
    void run('save', async () => {
      await putAway(store, groupId, actor, payload);
      toast(`Put away ${payload.length} ${payload.length === 1 ? 'item' : 'items'}, stored today`);
      router.back();
    });
  };

  return (
    <Screen
      testID="put-away-screen"
      footer={<Button label={`Put away ${lines.length}`} icon="check" loading={busy === 'save'} onPress={save} testID="confirm-put-away" />}>
      <Stack.Screen options={{ headerLeft: () => <HeaderButton label="Close" icon="close" onPress={() => router.back()} /> }} />
      <Txt variant="callout" tone={color.inkSoft}>
        Each item is stored today, so it goes to the back of the queue behind older food.
      </Txt>
      {lines.map((line) => {
        const choice = choices[line.id];
        if (!choice) return null;
        return (
          <Card key={line.id}>
            <Txt variant="heading">{line.name}</Txt>
            <Chips
              options={fridges.map((f) => ({ value: f.id, label: f.name, icon: KIND_ICON[f.kind] }))}
              value={choice.fridgeId}
              onChange={(fridgeId) =>
                choose(line.id, { fridgeId, alertAfterDays: fridges.find((f) => f.id === fridgeId)?.defaultAlertDays ?? choice.alertAfterDays })
              }
            />
            <Row gap={space.md} style={styles.top}>
              <Field
                label={`Amount (${UNIT_LABEL[line.unit]})`}
                value={choice.quantity}
                onChangeText={(quantity) => choose(line.id, { quantity })}
                keyboardType="decimal-pad"
                containerStyle={styles.amount}
              />
              <View style={styles.flex}>
                <Stepper
                  label="Alert after"
                  value={choice.alertAfterDays}
                  onChange={(alertAfterDays) => choose(line.id, { alertAfterDays })}
                  min={1}
                  max={730}
                  unit={(n) => (n === 1 ? 'day' : 'days')}
                />
              </View>
            </Row>
          </Card>
        );
      })}
      {error ? <Banner kind="error" text={error} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  top: { alignItems: 'flex-start' },
  amount: { width: 120 },
});
