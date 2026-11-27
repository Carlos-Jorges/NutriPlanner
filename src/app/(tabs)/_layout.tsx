import { Tabs } from 'expo-router/js-tabs';
import { type ColorValue, Platform } from 'react-native';

import { itemsNeedingAttention } from '@/core/storage-alerts';
import { useGroupData } from '@/state/group-data';
import { useReminderSync } from '@/state/reminders';
import { Icon, type IconName, Loading } from '@/ui/components';
import { color } from '@/ui/theme';

function tabIcon(name: IconName) {
  function TabIcon({ color: tint, size }: { color: ColorValue; size: number }) {
    return <Icon name={name} color={tint as string} size={size} />;
  }
  return TabIcon;
}

const badge = (count: number) => (count > 0 ? count : undefined);

export default function TabsLayout() {
  const data = useGroupData();
  useReminderSync();

  if (!data.ready) return <Loading label="Loading your group" />;

  const urgent = data.isAdmin ? itemsNeedingAttention(data.items, data.now).length : 0;
  const mealApprovals = data.isAdmin ? data.meals.filter((m) => m.status === 'proposed').length : 0;
  const recipeApprovals = data.isAdmin ? data.recipes.filter((r) => r.status === 'pending').length : 0;
  const toBuy = data.shopping.filter((s) => !s.checked).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.evergreen,
        tabBarInactiveTintColor: color.inkFaint,
        // Phones size the bar from their safe area; the browser needs room for icon and label.
        tabBarStyle: [
          { backgroundColor: color.card, borderTopColor: color.line },
          Platform.OS === 'web' ? { height: 64, paddingTop: 4, paddingBottom: 4 } : null,
        ],
        tabBarItemStyle: Platform.OS === 'web' ? { height: 56 } : undefined,
        tabBarLabelStyle: { fontWeight: '600' },
        tabBarBadgeStyle: { backgroundColor: color.tomato, color: color.white, fontSize: 11 },
        sceneStyle: { backgroundColor: color.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Fridges', tabBarIcon: tabIcon('fridge-outline'), tabBarBadge: badge(urgent) }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: tabIcon('calendar-week'), tabBarBadge: badge(mealApprovals) }} />
      <Tabs.Screen name="shopping" options={{ title: 'Shopping', tabBarIcon: tabIcon('cart-outline'), tabBarBadge: badge(toBuy) }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recipes', tabBarIcon: tabIcon('book-open-page-variant-outline'), tabBarBadge: badge(recipeApprovals) }} />
      <Tabs.Screen name="group" options={{ title: 'Group', tabBarIcon: tabIcon('account-group-outline') }} />
    </Tabs>
  );
}
