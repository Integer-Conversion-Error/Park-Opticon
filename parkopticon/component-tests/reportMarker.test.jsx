import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import ReportMarker from '../src/components/ReportMarker';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: Object.assign(() => null, { font: { ionicons: 'font-asset' } }),
}));
jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('react-native-maps', () => ({
  Marker: ({ children, ...props }) => {
    const { View } = require('react-native');
    return <View {...props} testID="native-marker">{children}</View>;
  },
}));
jest.mock('../src/services/localStore', () => ({
  getReportMeta: () => ({ label: 'Chalking tires', icon: 'create-outline', color: '#C47716' }),
  formatTimeAgo: () => 'Just now',
}));

const report = { id: 'local-report', type: 'chalking', latitude: 37.7779, longitude: -122.4232, createdAt: Date.now() };

beforeEach(() => {
  jest.useFakeTimers();
  useFonts.mockReturnValue([false]);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('waits for font and layout before freezing the marker, then refreshes selection without permanent tracking', async () => {
  const props = { report, isStale: false, isSelected: false, onPress: jest.fn() };
  const view = await render(<ReportMarker {...props} />);
  const tracking = () => view.getByTestId('native-marker').props.tracksViewChanges;
  const advance = (milliseconds) => act(async () => { jest.advanceTimersByTime(milliseconds); });

  // An early native snapshot must not become the permanent, blank marker.
  await advance(1000);
  expect(tracking()).toBe(true);
  useFonts.mockReturnValue([true]);
  await view.rerender(<ReportMarker {...props} />);
  await advance(1000);
  expect(tracking()).toBe(true);

  const markerView = view.getByTestId('native-marker').children[0];
  expect(markerView.props.collapsable).toBe(false);
  await fireEvent(markerView, 'layout', {
    nativeEvent: { layout: { width: 44, height: 44 } },
  });
  await advance(699);
  expect(tracking()).toBe(true);
  await advance(1);
  expect(tracking()).toBe(false);

  await view.rerender(<ReportMarker {...props} isSelected />);
  expect(tracking()).toBe(true);
  expect(view.getByTestId('native-marker').props.accessibilityState).toEqual({ selected: true });
  await advance(700);
  expect(tracking()).toBe(false);

  // Leaving the map during a refresh must cancel its pending snapshot timer.
  const schedule = jest.spyOn(global, 'setTimeout');
  const cancel = jest.spyOn(global, 'clearTimeout');
  await view.rerender(<ReportMarker {...props} />);
  expect(tracking()).toBe(true);
  const snapshotTimerIndex = schedule.mock.calls.findIndex(([, delay]) => delay === 700);
  expect(snapshotTimerIndex).toBeGreaterThanOrEqual(0);
  const snapshotTimer = schedule.mock.results[snapshotTimerIndex].value;
  await view.unmount();
  expect(cancel).toHaveBeenCalledWith(snapshotTimer);
});
