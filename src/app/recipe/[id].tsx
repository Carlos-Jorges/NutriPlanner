// One recipe: ingredients, what is in storage for it, and planning it.

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { nameMatchScore } from '@/core/names';
import { sortFifo } from '@/core/storage-alerts';
import { formatQuantity } from '@/core/units';
import { deleteRecipe, reviewRecipe } from '@/data/services/planning';
import { useBackend } from '@/state/backend-context';
import { GroupGate, useGroup } from '@/state/group-data';
import { useSession } from '@/state/session';
import { Badge, Banner, Button, Card, EmptyState, HeaderButton, Icon, Loading, Row, Screen, Txt, useToast } from '@/ui/components';
import { confirmAction } from '@/ui/dialogs';
import { tapeDate } from '@/ui/domain';
import { useAction } from '@/ui/use-action';
import { color, space } from '@/ui/theme';

export default function RecipeScreen() {
  return (
    <GroupGate fallback={<Loading />}>
      <RecipeDetail />
    </GroupGate>
  );
}

function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store } = useBackend();
  const { actor } = useSession();
  const { groupId, recipes, items, fridges, isAdmin } = useGroup();
  const router = useRouter();
  const toast = useToast();
  const { busy, error, run } = useAction();
  const recipe = recipes.find((r) => r.id === id);

  if (!recipe) {
    return (
      <Screen>
        <EmptyState icon="book-remove-outline" title="Recipe not found" body="It may have been deleted." />
      </Screen>
    );
  }

  const fridgeById = new Map(fridges.map((f) => [f.id, f]));
  const stored = sortFifo(items.filter((i) => i.status === 'stored'));
  const mine = recipe.proposedBy === actor?.uid;

  const review = (decision: 'approved' | 'rejected') => {
    if (!actor) return;
    void run(decision, async () => {
      await reviewRecipe(store, groupId, actor, recipe, decision);
      toast(decision === 'approved' ? 'Approved' : 'Declined');
    });
  };

  const remove = async () => {
    const ok = await confirmAction(`Delete ${recipe.name}?`, 'Meals already planned keep their name.', 'Delete', true);
    if (!ok) return;
    void run('delete', async () => {
      await deleteRecipe(store, groupId, recipe.id);
      toast(`Deleted ${recipe.name}`);
      router.back();
    });
  };

  return (
    <Screen
      testID="recipe-screen"
      footer={
        recipe.status === 'approved' || mine ? (
          <Button
            label={isAdmin ? 'Plan this meal' : 'Propose this meal'}
            icon="calendar-plus"
            onPress={() => router.push({ pathname: '/meal-form', params: { recipeId: recipe.id } })}
          />
        ) : undefined
      }>
      <Stack.Screen
        options={{
          title: recipe.name,
          headerRight: isAdmin ? () => <HeaderButton label="Edit" onPress={() => router.push({ pathname: '/recipe-form', params: { id: recipe.id } })} /> : undefined,
        }}
      />
      <View style={styles.hero}>
        <Txt variant="title">{recipe.name}</Txt>
        <Row gap={space.sm} wrap>
          {recipe.status !== 'approved' ? (
            <Badge label={recipe.status === 'pending' ? 'Waiting for approval' : 'Declined'} tone={recipe.status === 'pending' ? 'amber' : 'neutral'} />
          ) : null}
          <Badge
            label={recipe.defrostHours > 0 ? `Defrost ${recipe.defrostHours} h before` : 'No defrosting'}
            tone={recipe.defrostHours > 0 ? 'frost' : 'neutral'}
            icon={recipe.defrostHours > 0 ? 'snowflake' : undefined}
          />
          <Txt variant="caption" tone={color.inkSoft}>
            From {recipe.proposedByName}
          </Txt>
        </Row>
      </View>

      {recipe.status === 'pending' && isAdmin ? (
        <Card>
          <Txt variant="heading">Add this to the family recipes?</Txt>
          <Row gap={space.sm}>
            <Button label="Approve" icon="check" loading={busy === 'approved'} onPress={() => review('approved')} style={styles.flex} />
            <Button label="Decline" variant="secondary" loading={busy === 'rejected'} onPress={() => review('rejected')} style={styles.flex} />
          </Row>
        </Card>
      ) : null}

      <Card>
        <Txt variant="heading">Ingredients</Txt>
        {recipe.ingredients.map((ingredient, index) => {
          const match = stored.find((item) => nameMatchScore(ingredient.name, item.name) > 0);
          const where = match ? fridgeById.get(match.fridgeId) : undefined;
          return (
            <View key={`${ingredient.name}-${index}`} style={styles.ingredient}>
              <Row gap={space.sm}>
                <Txt variant="body" style={styles.flex}>
                  {ingredient.name}
                </Txt>
                <Txt variant="callout" tone={color.inkSoft}>
                  {formatQuantity(ingredient.quantity, ingredient.unit)}
                </Txt>
              </Row>
              <Row gap={space.xs}>
                <Icon name={match ? 'check-circle-outline' : 'cart-outline'} size={14} color={match ? color.leaf : color.inkFaint} />
                <Txt variant="caption" tone={match ? color.leaf : color.inkFaint}>
                  {match
                    ? `${formatQuantity(match.quantity, match.unit)} in ${where?.name ?? 'storage'}, stored ${tapeDate(match.storedAt)}`
                    : 'Not in storage'}
                </Txt>
              </Row>
            </View>
          );
        })}
      </Card>

      {recipe.notes ? (
        <Card>
          <Txt variant="heading">Notes</Txt>
          <Txt variant="body">{recipe.notes}</Txt>
        </Card>
      ) : null}

      {error ? <Banner kind="error" text={error} /> : null}
      {isAdmin || (mine && recipe.status !== 'approved') ? (
        <Button label={isAdmin ? 'Delete recipe' : 'Withdraw proposal'} variant="danger" loading={busy === 'delete'} onPress={() => void remove()} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  ingredient: { gap: 2, paddingVertical: space.xs },
});
