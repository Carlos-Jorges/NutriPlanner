// Recipes: the family's approved list, plus proposals waiting for an admin.

import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Recipe } from '@/core/types';
import { reviewRecipe } from '@/data/services/planning';
import { useBackend } from '@/state/backend-context';
import { useGroup } from '@/state/group-data';
import { useSession } from '@/state/session';
import { Badge, Banner, Button, Card, Divider, EmptyState, Icon, PageHeader, Row, Screen, SectionHeader, Txt, useToast } from '@/ui/components';
import { useAction } from '@/ui/use-action';
import { color, space } from '@/ui/theme';

export default function RecipesScreen() {
  const { group, recipes, isAdmin } = useGroup();
  const { actor } = useSession();
  const router = useRouter();
  const approved = recipes.filter((r) => r.status === 'approved').sort((a, b) => a.name.localeCompare(b.name));
  const waiting = recipes
    .filter((r) => r.status !== 'approved' && (isAdmin ? r.status === 'pending' : r.proposedBy === actor?.uid))
    .sort((a, b) => b.createdAt - a.createdAt);
  const open = (recipe: Recipe) => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } });

  return (
    <Screen testID="recipes-screen">
      <PageHeader
        eyebrow={group.name}
        title="Recipes"
        right={<Button small variant="soft" icon="plus" label={isAdmin ? 'New' : 'Propose'} onPress={() => router.push('/recipe-form')} testID="new-recipe" />}
      />

      {waiting.length > 0 ? <Waiting recipes={waiting} onOpen={open} /> : null}

      <View style={styles.section}>
        <SectionHeader title="Recipes" count={approved.length} />
        {approved.length === 0 ? (
          <Card>
            <EmptyState
              icon="book-open-page-variant-outline"
              title="No recipes yet"
              body="Recipes hold the ingredients and how long frozen food needs to defrost, so the plan can tell you when to take it out."
            />
          </Card>
        ) : (
          <Card style={styles.list}>
            {approved.map((recipe, index) => (
              <View key={recipe.id}>
                {index > 0 ? <Divider /> : null}
                <RecipeRow recipe={recipe} onPress={() => open(recipe)} />
              </View>
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}

function RecipeRow({ recipe, onPress, right }: { recipe: Recipe; onPress: () => void; right?: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={recipe.name}
      testID={`recipe-${recipe.id}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.flex}>
        <Txt variant="heading">{recipe.name}</Txt>
        <Row gap={space.xs}>
          {recipe.defrostHours > 0 ? <Icon name="snowflake" size={13} color={color.frost} /> : null}
          <Txt variant="caption" tone={color.inkSoft}>
            {recipe.defrostHours > 0 ? `Defrost ${recipe.defrostHours} h` : 'No defrosting'} · {recipe.ingredients.length}{' '}
            {recipe.ingredients.length === 1 ? 'ingredient' : 'ingredients'}
          </Txt>
        </Row>
      </View>
      {right ?? <Icon name="chevron-right" size={22} color={color.inkFaint} />}
    </Pressable>
  );
}

function Waiting({ recipes, onOpen }: { recipes: Recipe[]; onOpen: (recipe: Recipe) => void }) {
  const { store } = useBackend();
  const { actor } = useSession();
  const { groupId, isAdmin } = useGroup();
  const toast = useToast();
  const { busy, error, run } = useAction();

  const review = (recipe: Recipe, decision: 'approved' | 'rejected') => {
    if (!actor) return;
    void run(`${recipe.id}-${decision}`, async () => {
      await reviewRecipe(store, groupId, actor, recipe, decision);
      toast(decision === 'approved' ? `Added ${recipe.name} to recipes` : `Declined ${recipe.name}`);
    });
  };

  return (
    <View style={styles.section} testID="recipe-approvals">
      <SectionHeader title={isAdmin ? 'Waiting for approval' : 'Your proposals'} count={recipes.length} />
      <Card style={styles.list}>
        {recipes.map((recipe, index) => (
          <View key={recipe.id} style={styles.waiting}>
            {index > 0 ? <Divider /> : null}
            <RecipeRow
              recipe={recipe}
              onPress={() => onOpen(recipe)}
              right={
                !isAdmin ? <Badge label={recipe.status === 'rejected' ? 'Declined' : 'Waiting'} tone={recipe.status === 'rejected' ? 'neutral' : 'amber'} /> : undefined
              }
            />
            {isAdmin ? (
              <>
                <Txt variant="caption" tone={color.inkSoft}>
                  Proposed by {recipe.proposedByName}
                </Txt>
                <Row gap={space.sm}>
                  <Button small label="Approve" icon="check" loading={busy === `${recipe.id}-approved`} onPress={() => review(recipe, 'approved')} />
                  <Button small variant="secondary" label="Decline" loading={busy === `${recipe.id}-rejected`} onPress={() => review(recipe, 'rejected')} />
                </Row>
              </>
            ) : null}
          </View>
        ))}
      </Card>
      {error ? <Banner kind="error" text={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  section: { gap: space.sm },
  list: { paddingVertical: space.xs, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  waiting: { gap: space.sm, paddingBottom: space.sm },
});
