'use client';

import { useState, useEffect } from 'react';
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

type ScanJobResult = {
  company: string;
  title: string;
  matchScore?: number;
  status?: string;
  primaryStack?: string[];
  error?: string;
};

type ScanResult = {
  applied: number;
  totalScanned: number;
  totalAnalyzed: number;
  results: ScanJobResult[];
  skipReasons: Record<string, number>;
};

export default function Dashboard() {
  // ── Scan state ────────────────────────────────────────────
  const [minSalary, setMinSalary] = useState(120000);
  const [scanSecret, setScanSecret] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('jobhunt_secret');
    if (saved) setScanSecret(saved);
  }, []);

  async function triggerScan() {
    setScanning(true);
    setScanError('');
    setScanResult(null);
    try {
      const res = await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minSalaryPHP: minSalary, secret: scanSecret })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      setScanResult(data);
    } catch (e: any) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  }

  // ── Manual mode state ─────────────────────────────────────
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

      {/* ── Job Scan ── */}
      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Run Job Scan</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          Searches LinkedIn, JobStreet, Indeed and more. Sends WhatsApp notifications + saves Gmail drafts.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
              Min salary (PHP/month)
            </label>
            <input
              type="number"
              value={minSalary}
              step={10000}
              onChange={e => setMinSalary(Number(e.target.value))}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
              Secret key
            </label>
            <input
              type="password"
              placeholder="Your CRON_SECRET"
              value={scanSecret}
              onChange={e => {
                setScanSecret(e.target.value);
                localStorage.setItem('jobhunt_secret', e.target.value);
              }}
            />
          </div>
        </div>

        <button className="primary" disabled={scanning || !scanSecret} onClick={triggerScan}>
          {scanning ? <><span className="spin">⟳</span> Scanning… this may take 1–2 min</> : 'Run Job Scan'}
        </button>

        {scanError && (
          <div style={{ marginTop: 12, padding: 12, background: '#3a1010', border: '1px solid #5a1c1c', borderRadius: 8, fontSize: 13 }}>
            {scanError}
          </div>
        )}

        {scanResult && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>{scanResult.applied}</strong> draft{scanResult.applied !== 1 ? 's' : ''} saved to Gmail
              &nbsp;·&nbsp; <strong>{scanResult.totalAnalyzed}</strong> analyzed
              &nbsp;·&nbsp; <strong>{scanResult.totalScanned}</strong> found
            </p>

            {Object.keys(scanResult.skipReasons).length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                Filtered: {Object.entries(scanResult.skipReasons).map(([k, v]) => `${v} ${k}`).join(', ')}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {scanResult.results.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: '#0a0a0a', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13
                }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{r.title}</span>
                    <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{r.company}</span>
                    {r.error && <span style={{ color: '#e27070', marginLeft: 8 }}>— {r.error}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {r.matchScore != null && (
                      <span style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 12, fontWeight: 500,
                        background: r.matchScore >= 75 ? '#0d3a1c' : r.matchScore >= 50 ? '#3a2e0d' : '#3a1010',
                        color: r.matchScore >= 75 ? '#7ed98c' : r.matchScore >= 50 ? '#e2c570' : '#e27070'
                      }}>
                        {r.matchScore}/100
                      </span>
                    )}
                    {r.status && (
                      <span style={{ fontSize: 11, color: r.status === 'draft' ? '#7ed98c' : '#e27070' }}>
                        {r.status.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Manual Mode ── */}
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
