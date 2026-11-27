// One fridge or freezer, oldest food first.

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { sortFifo } from '@/core/storage-alerts';
import { GroupGate, useGroup } from '@/state/group-data';
import { Badge, Button, Card, Divider, EmptyState, HeaderButton, Loading, Row, Screen, Txt } from '@/ui/components';
import { ItemRow, KIND_LABEL, KIND_TONE, KindIcon } from '@/ui/domain';
import { color, space } from '@/ui/theme';

export default function FridgeScreen() {
  return (
    <GroupGate fallback={<Loading />}>
      <FridgeDetail />
    </GroupGate>
  );
}

function FridgeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { fridges, items, isAdmin, now } = useGroup();
  const router = useRouter();
  const fridge = fridges.find((f) => f.id === id);

  if (!fridge) {
    return (
      <Screen>
        <EmptyState icon="fridge-off-outline" title="Fridge not found" body="It may have been removed by an admin." />
      </Screen>
    );
  }

  const inside = sortFifo(items.filter((i) => i.fridgeId === fridge.id));

  return (
    <Screen testID="fridge-screen">
      <Stack.Screen
        options={{
          title: fridge.name,
          headerRight: isAdmin
            ? () => <HeaderButton label="Edit" onPress={() => router.push({ pathname: '/fridge-form', params: { id: fridge.id } })} />
            : undefined,
        }}
      />
      <Row gap={space.md}>
        <KindIcon kind={fridge.kind} size={48} />
        <View style={styles.flex}>
          <Txt variant="title">{fridge.name}</Txt>
          <Row gap={space.sm}>
            <Badge label={KIND_LABEL[fridge.kind]} tone={KIND_TONE[fridge.kind]} />
            <Txt variant="caption" tone={color.inkSoft}>
              Alerts after {fridge.defaultAlertDays} days by default
            </Txt>
          </Row>
        </View>
      </Row>

      <Button
        label={`Add food to ${fridge.name}`}
        variant="soft"
        icon="plus"
        onPress={() => router.push({ pathname: '/item-form', params: { fridgeId: fridge.id } })}
        testID="add-food-here"
      />

      {inside.length === 0 ? (
        <Card>
          <EmptyState icon="tray" title="Nothing in here" body="Food added here is listed oldest first, so the next thing to use is always at the top." />
        </Card>
      ) : (
        <View style={styles.section}>
          <Txt variant="caption" tone={color.inkSoft}>
            Oldest first. Use from the top.
          </Txt>
          <Card>
            {inside.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                <ItemRow item={item} now={now} onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })} />
              </View>
            ))}
          </Card>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  section: { gap: space.sm },
});
