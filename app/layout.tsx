import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'JobHunt — AI Job Application Pipeline',
  description: 'Automated job application system by Francis Albert Ilacad. Scrapes JS/TS fullstack roles, generates truthful AI emails, sends via Gmail, notifies via WhatsApp.',
  openGraph: {
    title: 'JobHunt — AI Job Application Pipeline',
    description: 'Portfolio project: automated job application pipeline with Claude AI, Gmail, and WhatsApp.',
    type: 'website'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
