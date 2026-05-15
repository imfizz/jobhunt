'use client';

import { useState } from 'react';
import { RESUME } from '@/lib/resume';

type GeneratedApp = {
  subject: string;
  emailBody: string;
  tailoredHighlights: string[];
  matchScore: number;
  matchReasoning: string;
};

type Job = {
  title: string;
  company: string;
  description: string;
  url: string;
  salary?: string;
  location?: string;
  hrEmail?: string;
};

export default function Dashboard() {
  const [mode, setMode] = useState<'url' | 'paste'>('url');
  const [url, setUrl] = useState('');
  const [jobText, setJobText] = useState('');
  const [recipient, setRecipient] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [app, setApp] = useState<GeneratedApp | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [sendStatus, setSendStatus] = useState('');

  async function generate() {
    setLoading(true);
    setError('');
    setApp(null);
    setJob(null);
    try {
      const res = await fetch('/api/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'url' ? { url } : { jobText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setJob(data.job);
      setApp(data.application);
      setEditedSubject(data.application.subject);
      setEditedBody(data.application.emailBody);
      if (data.job.hrEmail) setRecipient(data.job.hrEmail);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function send(draftOnly: boolean) {
    if (!recipient || !editedSubject || !editedBody) {
      setError('Fill in all email fields');
      return;
    }
    setSending(true);
    setError('');
    setSendStatus('');
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient,
          subject: editedSubject,
          body: editedBody,
          jobTitle: job?.title,
          company: job?.company,
          matchScore: app?.matchScore,
          draftOnly,
          jobUrl: job?.url || (mode === 'url' ? url : ''),
          salary: job?.salary,
          location: job?.location,
          source: mode === 'url' ? 'Manual URL' : 'Manual paste',
          jobDescription: job?.description
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSendStatus(draftOnly ? 'Draft saved to Gmail ✓ WhatsApp notified' : 'Email sent ✓ WhatsApp notified');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

      <header style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 600, marginBottom: 6 }}>JobHunt</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
          AI-powered job application pipeline · Built by {RESUME.name}<br/>
          Looking for: Fullstack / JS / TS roles · Remote · ₱{RESUME.minSalaryPHP.toLocaleString()}+ per month
        </p>
      </header>

      <section className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            className={mode === 'url' ? 'primary' : ''}
            onClick={() => setMode('url')}>From URL</button>
          <button
            className={mode === 'paste' ? 'primary' : ''}
            onClick={() => setMode('paste')}>Paste job description</button>
        </div>

        {mode === 'url' ? (
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
              Job posting URL (LinkedIn, Indeed, company careers page, etc.)
            </label>
            <input
              type="url"
              placeholder="https://linkedin.com/jobs/view/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        ) : (
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
              Paste the job description here
            </label>
            <textarea
              rows={8}
              placeholder="Job Title: Senior Fullstack Developer..."
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
            />
          </div>
        )}

        <button
          className="primary"
          style={{ marginTop: 12 }}
          disabled={loading || (mode === 'url' ? !url : !jobText)}
          onClick={generate}>
          {loading ? <><span className="spin">⟳</span> Generating…</> : 'Generate application'}
        </button>
      </section>

      {error && (
        <div style={{ padding: 14, background: '#3a1010', border: '1px solid #5a1c1c', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {job && app && (
        <>
          <section className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{job.title}</h2>
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                  {job.company} · {job.location || 'Remote'} {job.salary ? `· ${job.salary}` : ''}
                </p>
              </div>
              <div style={{
                fontSize: 12,
                padding: '6px 12px',
                background: app.matchScore >= 75 ? '#0d3a1c' : app.matchScore >= 50 ? '#3a2e0d' : '#3a1010',
                color: app.matchScore >= 75 ? '#7ed98c' : app.matchScore >= 50 ? '#e2c570' : '#e27070',
                borderRadius: 20,
                fontWeight: 500
              }}>
                {app.matchScore}/100 match
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{app.matchReasoning}</p>
          </section>

          <section className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, color: 'var(--muted)' }}>
              Tailored resume highlights (truthful, sourced from your real experience)
            </h3>
            <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
              {app.tailoredHighlights.map((h, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{h}</li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Email — review and send</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                Recipient email (HR / recruiter / company contact)
              </label>
              <input
                type="email"
                placeholder="recruiter@company.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Subject</label>
              <input type="text" value={editedSubject} onChange={(e) => setEditedSubject(e.target.value)} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Body</label>
              <textarea rows={14} value={editedBody} onChange={(e) => setEditedBody(e.target.value)} />
            </div>

            {sendStatus && (
              <div style={{ padding: 12, background: '#0d3a1c', border: '1px solid #1a5c2e', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#7ed98c' }}>
                {sendStatus}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={sending} onClick={() => send(true)}>
                {sending ? 'Working…' : 'Save as Gmail draft'}
              </button>
              <button className="primary" disabled={sending} onClick={() => send(false)}>
                {sending ? 'Sending…' : 'Send + notify WhatsApp'}
              </button>
            </div>
          </section>
        </>
      )}

      <footer style={{ marginTop: 60, paddingTop: 24, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
        Built by <a href="https://www.francisilacad.com" style={{ color: 'var(--fg)' }}>Francis Albert Ilacad</a> · Portfolio project · <a href="https://github.com/francisilacad" style={{ color: 'var(--fg)' }}>View source</a>
      </footer>

    </div>
  );
}
