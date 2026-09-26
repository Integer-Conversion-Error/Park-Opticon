import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8');
const loadAPI = async (url) => {
  const unexpected = () => { throw new Error('Unconfigured requests must stop before I/O'); };
  const context = vm.createContext({ process: { env: { EXPO_PUBLIC_API_URL: url } }, fetch: unexpected });
  const module = new vm.SourceTextModule(source, { context });
  await module.link((name) => {
    const names = name === './secureStorage'
      ? ['clearTokens', 'getAccessToken', 'getRefreshToken', 'saveTokens']
      : ['emitSignedOut'];
    return new vm.SyntheticModule(names, function () {
      for (const key of names) this.setExport(key, unexpected);
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
};

test('missing backend fails explicitly when completing Google sign-in', async () => {
  const { api } = await loadAPI(undefined);
  await assert.rejects(api.socialLogin({ provider: 'google', authorization_code: 'test-code' }), {
    code: 'api_not_configured', message: /no backend address.*EXPO_PUBLIC_API_URL/,
  });
});

test('configured guest mode still rejects account requests as guest mode', async () => {
  const { api, setApiGuestMode } = await loadAPI('https://api.example.com');
  setApiGuestMode(true);
  await assert.rejects(api.profile(), { code: 'guest_mode' });
});
