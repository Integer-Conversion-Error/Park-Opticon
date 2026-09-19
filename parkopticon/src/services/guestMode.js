import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_MODE_KEY = 'parkopticon.guestMode.v1';

export const getGuestMode = async () => (await AsyncStorage.getItem(GUEST_MODE_KEY)) === 'true';

export const setGuestMode = () => AsyncStorage.setItem(GUEST_MODE_KEY, 'true');

export const clearGuestMode = () => AsyncStorage.removeItem(GUEST_MODE_KEY);
