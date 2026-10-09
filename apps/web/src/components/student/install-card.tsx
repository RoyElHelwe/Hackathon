'use client';

import { Download, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Arzino } from '@/components/arzino';
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
    <div className="relative flex items-center gap-3 rounded-[20px] bg-med p-4 pe-9 text-white shadow-[0_5px_0_var(--med-d)]" data-testid="install-card">
      <Arzino mood="surprise" size={72} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-black">
          <Download className="me-1 inline size-4" />
          {t('installTitle')}
        </p>
        <p className="text-sm font-semibold text-white/90">{ios ? t('iosInstall') : t('installBody')}</p>
      </div>
      {evt && (
        <Button variant="kidGhost" size="sm" onClick={() => evt.prompt().then(dismiss)}>
          {t('install')}
        </Button>
      )}
      <button onClick={dismiss} className="absolute end-2 top-2 rounded-full p-1 text-white/80 hover:bg-white/15" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  );
}
