'use client';

import { useState, type FormEvent } from 'react';

type Message = { who: 'officer' | 'assistant'; text: string };
export default function OfficerAiChat({ department, organizationName }: { department: string; organizationName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const prompt = question.trim();
    if (!prompt || busy || !acknowledged) return;
    setError('');
    setQuestion('');
    setMessages(old => [...old, { who: 'officer', text: prompt }]);
    setBusy(true);
    try {
      const response = await fetch(`/api/ai/${encodeURIComponent(department)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ question: prompt, acknowledgeDataTransfer: acknowledged }),
        cache: 'no-store',
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Unable to answer.');
      setMessages(old => [...old, { who: 'assistant', text: String(json.answer) }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally { setBusy(false); }
  }

  return <section className="card rounded-4 shadow-sm" aria-label="CLEAR AI conversation">
    <div className="card-header bg-transparent d-flex justify-content-between align-items-center p-3">
      <div><strong>Assistant</strong><div className="small text-secondary">{organizationName} · authorized modules only</div></div>
      <span className="badge rounded-pill text-bg-light border">Read-only</span>
    </div>
    <div className="card-body d-flex flex-column gap-3" style={{ minHeight: 290, maxHeight: 520, overflowY: 'auto' }} aria-live="polite">
      {messages.length === 0 && <div className="text-center my-auto">
        <i className="bi bi-stars fs-2 text-primary" aria-hidden="true" />
        <h2 className="h5 mt-2">How can I help?</h2>
        <p className="text-secondary small mb-1">Ask for a current-period summary, explanation or draft report.</p>
        <p className="text-secondary small">I cannot modify transactions or retrieve student-level information.</p>
      </div>}
      {messages.map((item, index) => <div key={index}
        className={`p-3 rounded-4 ${item.who === 'officer' ? 'bg-primary text-white align-self-end' : 'bg-body-tertiary align-self-start'}`}
        style={{ maxWidth: '90%', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        <strong className="small">{item.who === 'officer' ? 'You' : 'CLEAR AI'}</strong>
        <div>{item.text}</div>
      </div>)}
      {busy && <div className="text-secondary small" role="status">Gemini is generating a response…</div>}
    </div>
    <div className="card-footer bg-transparent p-3">
      {error && <div className="alert alert-warning small" role="alert">{error}</div>}
      <label className="small d-flex align-items-start gap-2 mb-3">
        <input type="checkbox" className="form-check-input mt-1" checked={acknowledged}
          onChange={e => setAcknowledged(e.target.checked)} />
        <span>I understand that my question and a limited, authorized aggregate summary may be transmitted to Google Gemini.
        I will not submit student names, identifiers, passwords, receipts, or banking details. AI responses must be verified
        against CLEAR records.</span>
      </label>
      <form onSubmit={send} className="d-flex gap-2">
        <input className="form-control" type="text" aria-label="Ask CLEAR AI" placeholder="Ask CLEAR AI…" value={question}
          maxLength={1200} disabled={busy} onChange={e => setQuestion(e.target.value)} />
        <button className="btn btn-primary" type="submit" disabled={!question.trim() || busy || !acknowledged}>Send</button>
      </form>
      <small className="text-secondary">Questions are processed by Google Gemini. The assistant cannot change CLEAR financial records.</small>
    </div>
  </section>;
}
