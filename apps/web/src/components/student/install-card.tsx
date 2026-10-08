'use client';

import { Download, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

/** "Install Tajriba" card: native prompt on Android/Chrome, "Add to Home Screen" hint on iOS. */
export function InstallCard() {
  const t = useTranslations('student');
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem('tj-install-dismissed') === '1';
    } catch {
      /* storage unavailable */
    }
    if (standalone || dismissed) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    setHidden(!isIos);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem('tj-install-dismissed', '1');
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="relative flex items-center gap-4 rounded-[20px] bg-gradient-to-br from-sky to-violet p-4 text-white" data-testid="install-card">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-white/20">
        <Download className="size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-extrabold">{t('installTitle')}</p>
        <p className="text-sm text-white/85">{ios ? t('iosInstall') : t('installBody')}</p>
      </div>
      {evt && (
        <Button variant="kidSunny" size="sm" onClick={() => evt.prompt().then(dismiss)}>
          {t('install')}
        </Button>
      )}
      <button onClick={dismiss} className="absolute end-2 top-2 rounded-full p-1 text-white/70 hover:bg-white/10" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  );
}
