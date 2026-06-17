import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Meldewesen – Last Mile Optimizer',
  description: 'Callcenter Meldewesen für Zustellungen und Abholungen',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <header className="app-header">
          <Link href="/" className="app-header__logo">
            <Image
              src="/lmo-logo.png"
              alt="Last Mile Optimizer"
              width={120}
              height={34}
              priority
            />
            <div className="app-header__divider" />
            <div>
              <div className="app-header__title">Meldewesen</div>
              <div className="app-header__sub">Callcenter · Zustellmeldungen</div>
            </div>
          </Link>
          <nav>
            <Link href="/">Übersicht</Link>
            <Link href="/upload">↑ Liste hochladen</Link>
            <Link href="/neu" className="btn-new">+ Manuell</Link>
          </nav>
        </header>

        <div className="page">{children}</div>

        <footer className="page-footer">
          Last Mile Optimizer GmbH · Meldewesen-App · Internes Tool
        </footer>
      </body>
    </html>
  );
}
