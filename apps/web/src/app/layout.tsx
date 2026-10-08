import type { Metadata, Viewport } from 'next';
import { Baloo_Bhaijaan_2, Nunito, Tajawal } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Providers } from '@/components/app/providers';
import './globals.css';

const baloo = Baloo_Bhaijaan_2({ subsets: ['latin', 'arabic'], variable: '--font-baloo', weight: ['500', '600', '700', '800'], display: 'swap' });
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' });
const tajawal = Tajawal({ subsets: ['arabic', 'latin'], variable: '--font-tajawal', weight: ['400', '500', '700', '800'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Tajriba — learn by living', template: '%s · Tajriba' },
  description: 'The School of 2036: real-life missions, level up like a game, learn from your peers.',
  applicationName: 'Tajriba',
  appleWebApp: { capable: true, title: 'Tajriba', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#6C4CF1',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={`${baloo.variable} ${nunito.variable} ${tajawal.variable}`} suppressHydrationWarning>
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
