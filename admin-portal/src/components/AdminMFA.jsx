import { useState } from 'react';
import { confirmMFA, enrollMFA, setAccessToken, verifyMFA } from '../api/client';

export default function AdminMFA({ mode, onComplete, onLogout }) {
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const beginEnrollment = async () => {
    setLoading(true);
    setError('');
    try {
      setEnrollment((await enrollMFA()).data);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not start MFA enrollment.');
    } finally {
      setLoading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'enroll') {
        if (!confirmed) {
          const confirmation = await confirmMFA(code);
          setRecoveryCodes(confirmation.data.recovery_codes || []);
          setConfirmed(true);
          return;
        }
      }
      const verified = await verifyMFA(code);
      setAccessToken(verified.data.access_token);
      onComplete();
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Invalid MFA code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin verification</h1>
        <p className="text-gray-600 mt-2">{mode === 'enroll' ? 'Set up an authenticator app before entering the admin portal.' : 'Enter the current code from your authenticator app.'}</p>
        {mode === 'enroll' && !enrollment && <button type="button" onClick={beginEnrollment} disabled={loading} className="mt-6 w-full bg-blue-600 text-white py-2 rounded-lg disabled:opacity-50">{loading ? 'Preparing…' : 'Start MFA setup'}</button>}
        {enrollment && <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm"><p className="font-semibold text-slate-900">Add this secret to your authenticator app</p><code className="block break-all mt-2 text-slate-700">{enrollment.secret}</code><p className="text-slate-600 mt-3">After confirming, save the recovery codes shown once.</p></div>}
        {(mode === 'verify' || enrollment) && <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-medium text-gray-700" htmlFor="mfa-code">Six-digit code</label><input id="mfa-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg tracking-widest" /><button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-lg disabled:opacity-50">{loading ? 'Verifying…' : (mode === 'enroll' && !confirmed ? 'Confirm MFA' : 'Verify and continue')}</button></form>}
        {recoveryCodes.length > 0 && <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm"><p className="font-semibold">Recovery codes</p><p className="mt-2 font-mono break-words">{recoveryCodes.join(' · ')}</p></div>}
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        <button type="button" onClick={onLogout} className="mt-6 text-sm text-gray-600 underline">Sign out</button>
      </div>
    </div>
  );
}
