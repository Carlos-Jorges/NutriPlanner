// Add food (any member) or edit an item (admins).

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import type { Fridge, FridgeItem, Unit } from '@/core/types';
import { formatNumber, parseQuantity, UNITS, UNIT_LABEL } from '@/core/units';
import { addItem, MAX_ALERT_DAYS, updateItem } from '@/data/services/storage';
import { useBackend } from '@/state/backend-context';
import { GroupGate, useGroup } from '@/state/group-data';
import { useSession } from '@/state/session';
import { Banner, Button, Chips, EmptyState, Field, HeaderButton, Loading, Row, Screen, Stepper, Txt, useToast } from '@/ui/components';
import { KIND_ICON } from '@/ui/domain';
import { useAction } from '@/ui/use-action';
import { color, space } from '@/ui/theme';

const ALERT_PRESETS = [2, 3, 4, 7, 14, 30, 60, 90, 180];
const days = (n: number) => (n === 1 ? 'day' : 'days');

export default function ItemFormScreen() {
  return (
    <GroupGate fallback={<Loading />}>
      <ItemForm />
    </GroupGate>
  );
}

function ItemForm() {
  const params = useLocalSearchParams<{ id?: string; fridgeId?: string }>();
  const { fridges, items, isAdmin } = useGroup();
  const editing = params.id ? items.find((i) => i.id === params.id) : undefined;

  if (params.id && (!editing || !isAdmin)) {
    return (
      <Screen>
        <EmptyState icon="food-off-outline" title="Cannot edit this item" body="It may have been used up, or only admins can edit it." />
      </Screen>
    );
  }
  if (fridges.length === 0) {
    return (
      <Screen>
        <EmptyState icon="fridge-outline" title="No fridges yet" body="An admin needs to add a fridge or freezer before food can be logged." />
      </Screen>
    );
  }
  const initialFridge = fridges.find((f) => f.id === (editing?.fridgeId ?? params.fridgeId)) ?? fridges[0];
  return <ItemFormBody editing={editing} fridges={fridges} initialFridge={initialFridge} />;
}

function ItemFormBody({ editing, fridges, initialFridge }: { editing?: FridgeItem; fridges: Fridge[]; initialFridge: Fridge }) {
  const { store } = useBackend();
  const { actor } = useSession();
  const { groupId } = useGroup();
  const router = useRouter();
  const toast = useToast();
  const { busy, error, setError, run } = useAction();

  const [fridgeId, setFridgeId] = useState(initialFridge.id);
  const [name, setName] = useState(editing?.name ?? '');
  const [quantityText, setQuantityText] = useState(editing ? formatNumber(editing.quantity) : '');
  const [unit, setUnit] = useState<Unit>(editing?.unit ?? 'g');
  const [alertDays, setAlertDays] = useState(editing?.alertAfterDays ?? initialFridge.defaultAlertDays);
  const [alertTouched, setAlertTouched] = useState(Boolean(editing));
  const [daysStored, setDaysStored] = useState(0);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const quantity = parseQuantity(quantityText);

  const chooseFridge = (id: string) => {
    setFridgeId(id);
    const fridge = fridges.find((f) => f.id === id);
    if (fridge && !alertTouched) setAlertDays(fridge.defaultAlertDays);
  };

  const save = () => {
    if (!actor) return;
    if (quantity === null) return setError('Enter a quantity above zero, for example 500 or 1.5.');
    void run('save', async () => {
      const input = { fridgeId, name, quantity, unit, alertAfterDays: alertDays, notes };
      if (editing) {
        await updateItem(store, groupId, editing.id, input);
        toast(`Saved ${name.trim()}`);
      } else {
        await addItem(store, groupId, actor, { ...input, daysAlreadyStored: daysStored });
        const fridge = fridges.find((f) => f.id === fridgeId);
        toast(`Added ${name.trim()} to ${fridge?.name ?? 'storage'}`);
      }
      router.back();
    });
  };

  return (
    <Screen
      testID="item-form"
      footer={
        <Button
          label={editing ? 'Save changes' : 'Add to storage'}
          loading={busy === 'save'}
          disabled={!name.trim() || !quantityText}
          onPress={save}
          testID="save-item"
        />
      }>
      <Stack.Screen
        options={{
          title: editing ? 'Edit food' : 'Add food',
          headerLeft: () => <HeaderButton label="Close" icon="close" onPress={() => router.back()} />,
        }}
      />
      <Chips
        label="Where"
        options={fridges.map((f) => ({ value: f.id, label: f.name, icon: KIND_ICON[f.kind] }))}
        value={fridgeId}
        onChange={chooseFridge}
        testID="fridge-choice"
      />
      <Field label="What" value={name} onChangeText={setName} placeholder="For example, Chicken thighs" autoCapitalize="sentences" testID="item-name" />
      <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
        <Field
          label="Quantity"
          value={quantityText}
          onChangeText={setQuantityText}
          keyboardType="decimal-pad"
          placeholder="500"
          containerStyle={{ width: 120 }}
          testID="item-quantity"
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Chips label="Unit" options={UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u] }))} value={unit} onChange={setUnit} />
        </View>
      </Row>
      <Stepper
        label="Alert admins after"
        value={alertDays}
        onChange={(n) => {
          setAlertDays(n);
          setAlertTouched(true);
        }}
        min={1}
        max={MAX_ALERT_DAYS}
        unit={days}
        presets={ALERT_PRESETS}
        hint="Admins get a use soon warning once it has been stored this long."
      />
      {!editing ? (
        <Stepper
          label="Already stored for"
          value={daysStored}
          onChange={setDaysStored}
          min={0}
          max={365}
          unit={days}
          presets={[0, 1, 2, 3, 7, 14, 30]}
          hint="Logging food that was already in there? Set how long ago it went in, so the order stays right."
          testID="days-stored"
        />
      ) : null}
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="For example, marinated, use for curry" multiline />
      {error ? <Banner kind="error" text={error} /> : null}
      {editing ? (
        <Txt variant="caption" tone={color.inkSoft}>
          The storage date cannot be changed, so the oldest first order stays honest.
        </Txt>
      ) : null}
    </Screen>
  );
}
