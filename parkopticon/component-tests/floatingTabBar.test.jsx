import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import FloatingTabBar from '../src/navigation/FloatingTabBar';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-navigation/bottom-tabs', () => ({
  BottomTabBarHeightCallbackContext: require('react').createContext(undefined),
}));

const routes = [{ key: 'map', name: 'Map' }, { key: 'account', name: 'Account' }];
const descriptors = { map: { options: { title: 'Map' } }, account: { options: { title: 'Account' } } };

test('floating destinations preserve tab events and avoid navigating the active tab', async () => {
  const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
  const screen = await render(<FloatingTabBar state={{ index: 0, routes }} descriptors={descriptors} navigation={navigation} insets={{ bottom: 24 }} />);
  await fireEvent.press(screen.getByRole('tab', { name: 'Map' }));
  expect(navigation.emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'map', canPreventDefault: true });
  expect(navigation.navigate).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('tab', { name: 'Account' }));
  expect(navigation.navigate).toHaveBeenCalledWith('Account', undefined);

  navigation.navigate.mockClear();
  navigation.emit.mockReturnValue({ defaultPrevented: true });
  await fireEvent.press(screen.getByRole('tab', { name: 'Account' }));
  expect(navigation.navigate).not.toHaveBeenCalled();
});

test('the floating bar reports a changed layout to screens when system navigation takes more space', async () => {
  const onHeightChange = jest.fn();
  const navigation = { emit: jest.fn(), navigate: jest.fn() };
  const screen = await render(
    <BottomTabBarHeightCallbackContext.Provider value={onHeightChange}>
      <FloatingTabBar state={{ index: 0, routes }} descriptors={descriptors} navigation={navigation} insets={{ bottom: 48 }} />
    </BottomTabBarHeightCallbackContext.Provider>,
  );
  await fireEvent(screen.getByTestId('floating-tab-bar'), 'layout', { nativeEvent: { layout: { height: 128 } } });
  expect(onHeightChange).toHaveBeenCalledWith(128);
  expect(screen.getAllByRole('tab')).toHaveLength(2);
});
