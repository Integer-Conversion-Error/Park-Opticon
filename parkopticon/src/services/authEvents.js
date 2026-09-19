const listeners = new Set();

export const subscribeAuthState = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const emitSignedOut = () => {
  listeners.forEach((listener) => listener(false));
};
