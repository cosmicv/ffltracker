import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';

export function EmailSettings() {
  const [apiKey, setApiKey] = useState('');
  const [sender, setSender] = useState('');
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.emailSettings.get().then(settings => {
      setConfigured(settings.configured);
      setSender(settings.sender);
    }).catch(err => setError(err instanceof Error ? err.message : 'Unable to load email settings'))
      .finally(() => setLoading(false));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const settings = await api.emailSettings.save(apiKey, sender);
      setConfigured(settings.configured);
      setSender(settings.sender);
      setApiKey('');
      setSuccess('Email settings saved. New emails will use these settings immediately.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save email settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-2">Email Settings</h3>
      {error && <p role="alert" className="text-red-700 mb-4">{error}</p>}
      {success && <p role="status" className="text-green-700 mb-4">{success}</p>}
      {loading ? <p>Loading email settings...</p> : (
        <form onSubmit={save} className="max-w-xl space-y-5">
          <p className="text-sm text-gray-600">Resend API key: {configured ? 'Configured' : 'Not configured'}. Your saved key is kept on the server and is never displayed here.</p>
          <div>
            <label htmlFor="resend-api-key" className="block text-sm font-medium text-gray-700 mb-2">Resend API key</label>
            <input id="resend-api-key" type="password" autoComplete="new-password" value={apiKey}
              onChange={event => setApiKey(event.target.value)} required={!configured} disabled={saving}
              placeholder={configured ? 'Leave blank to keep the existing key' : 're_...'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label htmlFor="email-sender" className="block text-sm font-medium text-gray-700 mb-2">Sender address</label>
            <input id="email-sender" type="text" value={sender} required disabled={saving} maxLength={254}
              onChange={event => setSender(event.target.value)} placeholder="Loan Tracker <loans@example.com>"
              className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            <p className="text-sm text-gray-500 mt-2">Use an address on a domain you have verified in Resend.</p>
          </div>
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save email settings'}
          </button>
        </form>
      )}
    </section>
  );
}
