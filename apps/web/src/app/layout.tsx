import type { Metadata, Viewport } from 'next';
import { Noto_Kufi_Arabic, Nunito } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Providers } from '@/components/app/providers';
import './globals.css';

const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', weight: ['600', '700', '800', '900'], display: 'swap' });
const kufi = Noto_Kufi_Arabic({ subsets: ['arabic'], variable: '--font-kufi', weight: ['500', '700', '800', '900'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Tajriba — learn by living, with Arzino', template: '%s · Tajriba' },
  description: 'The School of 2036: real-life missions, a game you level up in, and Arzino, a little cedar who coaches every student.',
  applicationName: 'Tajriba',
  appleWebApp: { capable: true, title: 'Tajriba', statusBarStyle: 'default' },
  icons: { icon: '/arzino/favicon.png', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#00A651',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={`${nunito.variable} ${kufi.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint to avoid a flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('tj-theme');if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
