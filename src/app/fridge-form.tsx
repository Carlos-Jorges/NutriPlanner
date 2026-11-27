// Add or edit a fridge or freezer (admins).

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import type { Fridge, StorageKind } from '@/core/types';
import { deleteFridge, MAX_ALERT_DAYS, saveFridge } from '@/data/services/storage';
import { useBackend } from '@/state/backend-context';
import { GroupGate, useGroup } from '@/state/group-data';
import { useSession } from '@/state/session';
import { Banner, Button, Chips, EmptyState, Field, HeaderButton, Loading, Screen, Stepper, useToast } from '@/ui/components';
import { confirmAction } from '@/ui/dialogs';
import { useAction } from '@/ui/use-action';

const DEFAULT_ALERT: Record<StorageKind, number> = { fridge: 3, freezer: 90 };

export default function FridgeFormScreen() {
  return (
    <GroupGate fallback={<Loading />}>
      <FridgeForm />
    </GroupGate>
  );
}

function FridgeForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { fridges, isAdmin } = useGroup();
  const existing = id ? fridges.find((f) => f.id === id) : undefined;
  if (!isAdmin || (id && !existing)) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Admins only" body="Only admins can add or change fridges." />
      </Screen>
    );
  }
  return <FridgeFormBody existing={existing} />;
}

function FridgeFormBody({ existing }: { existing?: Fridge }) {
  const { store } = useBackend();
  const { actor } = useSession();
  const { groupId, items } = useGroup();
  const router = useRouter();
  const toast = useToast();
  const { busy, error, run } = useAction();
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<StorageKind>(existing?.kind ?? 'fridge');
  const [alertDays, setAlertDays] = useState(existing?.defaultAlertDays ?? DEFAULT_ALERT.fridge);
  const [touched, setTouched] = useState(Boolean(existing));

  const save = () => {
    if (!actor) return;
    void run('save', async () => {
      await saveFridge(store, groupId, actor, { name, kind, defaultAlertDays: alertDays }, existing?.id);
      toast(existing ? `Saved ${name.trim()}` : `Added ${name.trim()}`);
      router.back();
    });
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirmAction(`Delete ${existing.name}?`, 'This cannot be undone.', 'Delete', true);
    if (!ok) return;
    void run('delete', async () => {
      await deleteFridge(store, groupId, existing.id, items);
      toast(`Deleted ${existing.name}`);
      router.dismissTo('/');
    });
  };

  return (
    <Screen
      testID="fridge-form"
      footer={<Button label={existing ? 'Save changes' : 'Add fridge'} loading={busy === 'save'} disabled={!name.trim()} onPress={save} testID="save-fridge" />}>
      <Stack.Screen
        options={{
          title: existing ? 'Edit fridge' : 'Add a fridge',
          headerLeft: () => <HeaderButton label="Close" icon="close" onPress={() => router.back()} />,
        }}
      />
      <Field label="Name" value={name} onChangeText={setName} placeholder="For example, Garage freezer" testID="fridge-name" />
      <Chips
        label="Type"
        options={[
          { value: 'fridge', label: 'Fridge', icon: 'fridge-outline' },
          { value: 'freezer', label: 'Freezer', icon: 'snowflake' },
        ]}
        value={kind}
        onChange={(next) => {
          setKind(next);
          if (!touched) setAlertDays(DEFAULT_ALERT[next]);
        }}
      />
      <Stepper
        label="Default alert after"
        value={alertDays}
        onChange={(n) => {
          setAlertDays(n);
          setTouched(true);
        }}
        min={1}
        max={MAX_ALERT_DAYS}
        unit={(n) => (n === 1 ? 'day' : 'days')}
        presets={kind === 'freezer' ? [30, 60, 90, 120, 180] : [2, 3, 4, 5, 7]}
        hint="Used as the starting value for new food in here. Each item can be changed."
      />
      {error ? <Banner kind="error" text={error} /> : null}
      {existing ? <Button label="Delete fridge" variant="danger" loading={busy === 'delete'} onPress={() => void remove()} /> : null}
    </Screen>
  );
}
