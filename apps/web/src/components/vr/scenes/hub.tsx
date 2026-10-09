'use client';

import { XROrigin } from '@react-three/xr';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { canEnterExam } from '@/lib/campus/use-campus';
import type { MyExam } from '@/lib/campus/types';
import { useApi } from '@/lib/hooks';
import { Bousla3D } from '../bousla-3d';
import { EmojiSprite, Panel, VButton, VC, VText } from '../kit';
import { useVRNav, type VRScene } from '../nav';
import { useDesktopView } from '../stage';

/** One door in the hub: a card with an emoji, a title and a Go button. */
function Tile({ x, rotY, emoji, title, body, color, onGo, disabled, name }: { x: number; rotY: number; emoji: string; title: string; body: string; color: string; onGo: () => void; disabled?: boolean; name: string }) {
  const t = useTranslations('vr.hub');
  return (
    <Panel width={0.56} height={0.62} position={[x, 1.3, -1.45 + Math.abs(x) * 0.35]} rotation={[0, rotY, 0]}>
      <EmojiSprite emoji={emoji} size={0.2} position={[0, 0.17, 0.02]} />
      <VText size={0.055} bold position={[0, 0.02, 0]}>
        {title}
      </VText>
      <VText size={0.03} color="#5b5675" maxWidth={0.48} position={[0, -0.07, 0]}>
        {body}
      </VText>
      <VButton label={t('go')} onClick={onGo} disabled={disabled} color={color} position={[0, -0.21, 0]} name={name} />
    </Panel>
  );
}

/** The VR lobby: Arzino and three doors (Shadow Lab, Campus, Exam room). */
export function HubScene() {
  const t = useTranslations('vr.hub');
  const { go } = useVRNav();
  const desktop = useDesktopView();
  const exams = useApi<MyExam[]>('/exams/mine');
  const exam = exams.data?.find(canEnterExam);

  useEffect(() => desktop.look([0, 1.55, 0.9], [0, 1.25, -1.4]), [desktop]);

  const open = (s: VRScene) => () => go(s);
  return (
    <>
      <XROrigin position={[0, 0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[7, 48]} />
        <meshStandardMaterial color="#e9fbf4" />
      </mesh>
      <directionalLight position={[3, 6, 3]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
      <VText size={0.14} bold color={VC.violet} position={[0, 2.25, -2]} outline={VC.white}>
        Tajriba VR
      </VText>
      <VText size={0.06} color={VC.ink} position={[0, 2.05, -2]}>
        {t('hello')}
      </VText>
      {/* beside the doors, turned toward you (below them it hides behind the middle card from eye height) */}
      <Bousla3D mood="happy" position={[-1.3, 1.2, -1.75]} rotationY={0.6} scale={0.9} />
      <Tile x={-0.7} rotY={0.45} emoji="🌞" title={t('shadowLab.title')} body={t('shadowLab.body')} color={VC.sunny} onGo={open({ kind: 'shadow-lab' })} name="tile-shadow-lab" />
      <Tile x={0} rotY={0} emoji="🏫" title={t('campus.title')} body={t('campus.body')} color={VC.mint} onGo={open({ kind: 'campus' })} name="tile-campus" />
      <Tile
        x={0.7}
        rotY={-0.45}
        emoji="🎙️"
        title={t('exam.title')}
        body={exam ? exam.title : t('examNone')}
        color={VC.sky}
        disabled={!exam}
        onGo={() => exam && go({ kind: 'exam', id: exam.attemptId })}
        name="tile-exam"
      />
    </>
  );
}
