// Shared UI primitives. Screens compose these; they never style raw
// React Native elements with ad hoc colours or sizes.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ComponentProps, createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AlertLevel } from '@/core/storage-alerts';
import { color, font, maxContentWidth, radius, space, type Tone, tones, type, type TypeVariant } from './theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon(props: ComponentProps<typeof MaterialCommunityIcons>) {
  return <MaterialCommunityIcons {...props} />;
}

// ── Text ──────────────────────────────────────────────────────────────────

export function Txt({ variant = 'body', tone, style, ...rest }: TextProps & { variant?: TypeVariant; tone?: string }) {
  return <Text {...rest} style={[type[variant], { color: tone ?? color.ink }, style]} />;
}

// ── Layout ────────────────────────────────────────────────────────────────

export function Screen({
  children,
  footer,
  scroll = true,
  testID,
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const body = <View style={styles.content}>{children}</View>;
  return (
    <View style={styles.screen} testID={testID}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[styles.scrollContent, { paddingBottom: footer ? space.xl : space.xxl + insets.bottom }]}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

export function Stack({ gap = space.md, children, style }: { gap?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Row({
  gap = space.sm,
  children,
  style,
  wrap,
}: {
  gap?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  wrap?: boolean;
}) {
  return <View style={[styles.row, { gap }, wrap && styles.wrap, style]}>{children}</View>;
}

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
  testID,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}) {
  if (!onPress) return <View style={[styles.card, style]} testID={testID}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
      {children}
    </Pressable>
  );
}

/** Title block for tab screens, which have no native header. */
export function PageHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.pageHeader, { paddingTop: insets.top }]}>
      <View style={styles.flex}>
        {eyebrow ? (
          <Txt variant="label" tone={color.inkSoft} numberOfLines={1}>
            {eyebrow}
          </Txt>
        ) : null}
        <Txt variant="display" accessibilityRole="header">
          {title}
        </Txt>
      </View>
      {right}
    </View>
  );
}

export function HeaderButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
      {icon ? <Icon name={icon} size={22} color={color.evergreen} /> : <Txt variant="heading" tone={color.evergreen}>{label}</Txt>}
    </Pressable>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function SectionHeader({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Row gap={space.sm}>
        <Txt variant="label" tone={color.inkSoft}>
          {title}
        </Txt>
        {count !== undefined ? (
          <Txt variant="label" tone={color.inkFaint}>
            {count}
          </Txt>
        ) : null}
      </Row>
      {action}
    </View>
  );
}

// ── Actions ───────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';

const BUTTON: Record<ButtonVariant, { bg: string; pressed: string; fg: string; border: string }> = {
  primary: { bg: color.evergreen, pressed: color.evergreenPressed, fg: color.white, border: color.evergreen },
  secondary: { bg: color.card, pressed: color.evergreenSoft, fg: color.evergreen, border: color.evergreen },
  soft: { bg: color.evergreenSoft, pressed: '#D3E5DB', fg: color.evergreen, border: color.evergreenSoft },
  ghost: { bg: 'transparent', pressed: color.evergreenSoft, fg: color.evergreen, border: 'transparent' },
  danger: { bg: color.card, pressed: color.tomatoSoft, fg: color.tomato, border: color.tomato },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const v = BUTTON[variant];
  const inactive = Boolean(disabled || loading);
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: pressed ? v.pressed : v.bg, borderColor: v.border },
        disabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={small ? 16 : 19} color={v.fg} /> : null}
          <Text style={[small ? type.callout : type.heading, styles.buttonLabel, { color: v.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// ── Inputs ────────────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  error,
  containerStyle,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string; containerStyle?: StyleProp<ViewStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, containerStyle]}>
      <Txt variant="label" tone={color.inkSoft}>
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={color.inkFaint}
        accessibilityLabel={label}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[styles.input, input.multiline && styles.inputMultiline, focused && styles.inputFocused]}
      />
      {error ? (
        <Txt variant="caption" tone={color.tomato}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="caption" tone={color.inkSoft}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export interface ChipOption<T> {
  value: T;
  label: string;
  icon?: IconName;
}

export function Chips<T extends string | number>({
  label,
  options,
  value,
  onChange,
  testID,
}: {
  label?: string;
  options: readonly ChipOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  testID?: string;
}) {
  return (
    <View style={styles.field} testID={testID}>
      {label ? (
        <Txt variant="label" tone={color.inkSoft}>
          {label}
        </Txt>
      ) : null}
      <View style={[styles.row, styles.wrap, { gap: space.sm }]} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
              {option.icon ? <Icon name={option.icon} size={16} color={selected ? color.white : color.evergreen} /> : null}
              <Text style={[type.callout, styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  unit,
  presets,
  hint,
  testID,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  unit?: (value: number) => string;
  presets?: readonly number[];
  hint?: string;
  testID?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <View style={styles.field} testID={testID}>
      <Txt variant="label" tone={color.inkSoft}>
        {label}
      </Txt>
      <Row gap={space.md}>
        <Pressable
          onPress={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={({ pressed }) => [styles.stepButton, pressed && styles.pressed, value <= min && styles.disabled]}>
          <Icon name="minus" size={20} color={color.evergreen} />
        </Pressable>
        <Text style={[type.title, styles.stepValue]} accessibilityLiveRegion="polite">
          {value}
          {unit ? <Text style={[type.callout, { color: color.inkSoft }]}> {unit(value)}</Text> : null}
        </Text>
        <Pressable
          onPress={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={({ pressed }) => [styles.stepButton, pressed && styles.pressed, value >= max && styles.disabled]}>
          <Icon name="plus" size={20} color={color.evergreen} />
        </Pressable>
      </Row>
      {presets ? (
        <Row wrap gap={space.xs}>
          {presets.map((p) => (
            <Pressable
              key={p}
              onPress={() => onChange(clamp(p))}
              accessibilityRole="button"
              accessibilityLabel={`${p}${unit ? ` ${unit(p)}` : ''}`}
              style={({ pressed }) => [styles.preset, p === value && styles.presetSelected, pressed && styles.pressed]}>
              <Text style={[type.caption, { color: p === value ? color.white : color.inkSoft, fontWeight: '600' }]}>{p}</Text>
            </Pressable>
          ))}
        </Row>
      ) : null}
      {hint ? (
        <Txt variant="caption" tone={color.inkSoft}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function Checkbox({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.checkbox, checked && styles.checkboxOn]}>
      {checked ? <Icon name="check" size={16} color={color.white} /> : null}
    </Pressable>
  );
}

// ── Status ────────────────────────────────────────────────────────────────

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {icon ? <Icon name={icon} size={12} color={t.fg} /> : null}
      <Text style={[type.caption, styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const BANNER: Record<'info' | 'success' | 'warning' | 'error', { tone: Tone; icon: IconName }> = {
  info: { tone: 'frost', icon: 'information-outline' },
  success: { tone: 'leaf', icon: 'check-circle-outline' },
  warning: { tone: 'amber', icon: 'alert-outline' },
  error: { tone: 'tomato', icon: 'alert-circle-outline' },
};

export function Banner({ kind = 'info', title, text }: { kind?: keyof typeof BANNER; title?: string; text: string }) {
  const b = BANNER[kind];
  const t = tones[b.tone];
  return (
    <View
      style={[styles.banner, { backgroundColor: t.bg }]}
      accessibilityRole={kind === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite">
      <Icon name={b.icon} size={20} color={t.fg} />
      <View style={styles.flex}>
        {title ? <Txt variant="heading" tone={t.fg}>{title}</Txt> : null}
        <Txt variant="callout" tone={t.fg}>
          {text}
        </Txt>
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={28} color={color.evergreen} />
      </View>
      <Txt variant="heading" style={styles.center}>
        {title}
      </Txt>
      <Txt variant="callout" tone={color.inkSoft} style={styles.center}>
        {body}
      </Txt>
      {action}
    </View>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={[styles.screen, styles.centerFill]} accessibilityLabel={label}>
      <ActivityIndicator color={color.evergreen} size="large" />
    </View>
  );
}

/** The signature element: masking tape with the date in marker. */
export function TapeLabel({ text, angle = -2, large }: { text: string; angle?: number; large?: boolean }) {
  return (
    <View style={[styles.tape, large && styles.tapeLarge, { transform: [{ rotate: `${angle}deg` }] }]}>
      <Text style={[styles.tapeText, large && styles.tapeTextLarge]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const LEVEL_COLOR: Record<AlertLevel, string> = { ok: color.leaf, soon: color.amber, due: color.tomato };

/** How far through its storage time an item is. */
export function ShelfBar({ progress, level }: { progress: number; level: AlertLevel }) {
  return (
    <View style={styles.shelfTrack}>
      <View style={[styles.shelfFill, { width: `${Math.min(1, progress) * 100}%`, backgroundColor: LEVEL_COLOR[level] }]} />
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  testID,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const content = (
    <>
      {left}
      <View style={styles.flex}>
        <Txt variant="heading" numberOfLines={2}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="callout" tone={color.inkSoft} numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
    </>
  );
  if (!onPress) return <View style={styles.listRow} testID={testID}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<(text: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const show = useCallback((next: string) => {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(null), 2800);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <ToastContext.Provider value={show}>
      {children}
      {text ? (
        <View pointerEvents="none" style={[styles.toastWrap, { top: insets.top + space.sm }]}>
          <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Txt variant="callout" tone={color.white}>
              {text}
            </Txt>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  scrollContent: { paddingHorizontal: space.lg, paddingTop: space.lg },
  content: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', gap: space.lg },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
    backgroundColor: color.card,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  footerInner: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  centerFill: { alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: color.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    gap: space.md,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.line },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  headerButton: { paddingHorizontal: space.sm, paddingVertical: space.xs, minHeight: 36, justifyContent: 'center' },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonSmall: { minHeight: 38, paddingHorizontal: space.md, borderRadius: radius.sm },
  buttonLabel: { fontWeight: '600' },
  field: { gap: space.xs + 2 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.card,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: 16,
    color: color.ink,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top', paddingTop: space.md },
  inputFocused: { borderColor: color.evergreen, borderWidth: 1.5 },
  chip: {
    minHeight: 38,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  chipSelected: { backgroundColor: color.evergreen, borderColor: color.evergreen },
  chipText: { color: color.ink, fontWeight: '500' },
  chipTextSelected: { color: color.white, fontWeight: '600' },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { minWidth: 64, textAlign: 'center', color: color.ink, fontVariant: ['tabular-nums'] },
  preset: {
    minWidth: 36,
    height: 28,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: '#E8EDEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetSelected: { backgroundColor: color.evergreen },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: color.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.card,
  },
  checkboxOn: { backgroundColor: color.leaf, borderColor: color.leaf },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { fontWeight: '700' },
  banner: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, alignItems: 'flex-start' },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl, paddingHorizontal: space.lg },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: color.evergreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  tape: {
    alignSelf: 'flex-start',
    backgroundColor: color.tape,
    borderColor: color.tapeEdge,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  tapeLarge: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  tapeText: { fontFamily: font.marker, fontSize: 13, lineHeight: 18, color: color.tapeInk, letterSpacing: 0.5 },
  tapeTextLarge: { fontSize: 30, lineHeight: 40, letterSpacing: 3 },
  shelfTrack: { height: 4, borderRadius: 2, backgroundColor: '#E5EAE8', overflow: 'hidden' },
  shelfFill: { height: 4, borderRadius: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 56 },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.lg },
  toast: {
    backgroundColor: color.ink,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    maxWidth: 480,
  },
});
