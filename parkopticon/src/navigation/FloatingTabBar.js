import { useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../theme';

export const FLOATING_TAB_HEIGHT = 64;
export const FLOATING_TAB_GAP = 8;
const getControlHeight = (fontScale) => Math.max(FLOATING_TAB_HEIGHT, Math.ceil(46 + 12 * Math.min(fontScale, 2)));
export const getFloatingTabBarHeight = (bottomInset, fontScale = 1) => getControlHeight(fontScale) + FLOATING_TAB_GAP * 2 + bottomInset;

const icons = { Map: 'map-outline', Account: 'person-outline' };

/** The same two-destination control floats above either platform's system bar. */
export default function FloatingTabBar({ state, descriptors, navigation, insets }) {
  const { theme, styles } = useThemedStyles(createStyles);
  const { fontScale } = useWindowDimensions();
  const [reduceTransparency, setReduceTransparency] = useState(true);
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const height = getFloatingTabBarHeight(insets.bottom, fontScale);

  useEffect(() => {
    let mounted = true;
    Promise.resolve(AccessibilityInfo.isReduceTransparencyEnabled()).then((reduced) => {
      if (mounted) setReduceTransparency(Boolean(reduced));
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  return (
    <View
      testID="floating-tab-bar"
      pointerEvents="box-none"
      onLayout={({ nativeEvent }) => onHeightChange?.(nativeEvent.layout.height)}
      style={[styles.reservedSpace, { height, paddingBottom: insets.bottom + FLOATING_TAB_GAP }]}
    >
      <View style={[styles.pill, { minHeight: getControlHeight(fontScale) }, reduceTransparency && { backgroundColor: theme.colors.surface }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = options.title || route.name;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={options.tabBarAccessibilityLabel || label}
              accessibilityState={{ selected: focused }}
              testID={options.tabBarButtonTestID}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [styles.tab, focused && styles.selectedTab, pressed && styles.pressed]}
            >
              <Ionicons name={icons[route.name] || 'ellipse-outline'} size={22} color={focused ? theme.colors.primaryDark : theme.colors.textSecondary} />
              <Text maxFontSizeMultiplier={2} style={[styles.label, focused && styles.selectedLabel]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  reservedSpace: { alignItems: 'center', bottom: 0, justifyContent: 'flex-end', left: 0, paddingTop: FLOATING_TAB_GAP, position: 'absolute', right: 0 },
  pill: { alignItems: 'stretch', backgroundColor: theme.colors.navigationSurface, borderColor: theme.colors.border.light, borderRadius: 32, borderWidth: 1, flexDirection: 'row', gap: 4, minHeight: FLOATING_TAB_HEIGHT, padding: 5, width: 236, ...theme.shadows.large },
  tab: { alignItems: 'center', borderRadius: 28, flex: 1, gap: 2, justifyContent: 'center', minHeight: 52, paddingHorizontal: 8, paddingVertical: 5 },
  selectedTab: { backgroundColor: theme.colors.primaryLight },
  label: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '500', textAlign: 'center' },
  selectedLabel: { color: theme.colors.primaryDark, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
