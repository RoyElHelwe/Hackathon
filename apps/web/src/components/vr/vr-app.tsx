'use client';

import { ArrowLeft, Glasses, Home } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { VRNavCtx, parseScene, sceneParam, type VRScene } from './nav';
import { HubScene } from './scenes/hub';
import { CampusScene } from './scenes/campus';
import { ExamScene } from './scenes/exam';
import { ShadowLab } from './scenes/shadow-lab';
import { StudyScene } from './scenes/study';
import { XRStage, useVRStore, useVRSupported } from './stage';
import { vrTest } from './test-hook';

/**
 * Tajriba VR: one page, one XR session, several experiences (hub, Shadow Lab, campus, study room, exam room).
 * On a laptop it is a normal 3D page (drag to look around); on a Meta Quest, "Enter VR" puts you inside.
 */
export default function VRApp() {
  const t = useTranslations('vr');
  const params = useSearchParams();
  const store = useVRStore();
  const [scene, setScene] = useState<VRScene>(() => parseScene(params.get('scene'), params.get('mission')));
  const [inVR, setInVR] = useState(false);
  const supported = useVRSupported(store).vr;
  const debug = params.get('debug') === '1';

  const go = useCallback((next: VRScene) => {
    setScene(next);
    // keep the URL in sync (reload lands in the same place) without a navigation, which would end the XR session
    const url = new URL(window.location.href);
    url.searchParams.set('scene', sceneParam(next));
    if (next.kind !== 'shadow-lab' || !next.missionId) url.searchParams.delete('mission');
    window.history.replaceState(null, '', url);
  }, []);
  const nav = useMemo(() => ({ scene, go }), [scene, go]);

  const enter = useCallback(async () => {
    await store.enterVR();
  }, [store]);

  useEffect(() => {
    vrTest({ scene: sceneParam(scene), step: 0, enterVR: enter, setScene: (s: string) => go(parseScene(s)) });
  }, [scene, enter, go]);

  return (
    <VRNavCtx.Provider value={nav}>
      <div className="fixed inset-0 bg-[#d9ecff]" data-testid="vr-app" data-scene={sceneParam(scene)} data-session={inVR ? 'immersive-vr' : 'none'}>
        <XRStage store={store} debug={debug} onSession={setInVR}>
          {scene.kind === 'hub' ? (
            <HubScene />
          ) : scene.kind === 'shadow-lab' ? (
            <ShadowLab key="lab" missionId={scene.missionId} />
          ) : scene.kind === 'campus' ? (
            <CampusScene key="campus" />
          ) : scene.kind === 'study' ? (
            <StudyScene key={`study-${scene.id}`} id={scene.id} />
          ) : (
            <ExamScene key={`exam-${scene.id}`} id={scene.id} />
          )}
        </XRStage>

        <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 p-3">
          <Button asChild variant="kidGhost" size="sm" className="pointer-events-auto">
            <Link href="/student">
              <ArrowLeft className="rtl-flip" /> {t('back')}
            </Link>
          </Button>
          {scene.kind !== 'hub' && (
            <Button variant="kidGhost" size="sm" className="pointer-events-auto" onClick={() => go({ kind: 'hub' })} data-testid="vr-home">
              <Home /> {t('hub.home')}
            </Button>
          )}
          <div className="flex-1" />
          {supported && !inVR && (
            <Button variant="kid" className="pointer-events-auto" onClick={enter} data-testid="enter-vr">
              <Glasses /> {t('enter')}
            </Button>
          )}
        </header>
        {!inVR && (
          <p className="pointer-events-none absolute inset-x-3 bottom-3 mx-auto max-w-xl rounded-full bg-card/90 px-4 py-2 text-center text-sm font-semibold shadow">
            {supported === false ? t('notSupported') : t('desktopHint')}
          </p>
        )}
      </div>
    </VRNavCtx.Provider>
  );
}
