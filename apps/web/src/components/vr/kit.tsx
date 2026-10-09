'use client';

import { RoundedBox, Text } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

/** Design tokens (same as the 2D app) as three.js colors. */
export const VC = {
  violet: '#6C4CF1',
  violetDark: '#5A3BE0',
  mint: '#2DD4A7',
  sunny: '#FFC83D',
  coral: '#FF7A59',
  sky: '#4CB8FF',
  green: '#5CC45C',
  ink: '#14112B',
  cream: '#FFF9EC',
  white: '#FFFFFF',
  panel: '#FFFFFF',
  panelDark: '#221C45',
  wood: '#D4A77A',
  woodDark: '#9C6F45',
  wall: '#3B3561',
} as const;

/** Self-hosted fonts (troika needs ttf/otf/woff; Tajawal covers Arabic and Latin). */
export const FONT = '/fonts/Tajawal-Medium.ttf';
export const FONT_BOLD = '/fonts/Tajawal-Bold.ttf';

type V3 = [number, number, number];

/**
 * Characters the self-hosted font doesn't have (emoji, arrows, shapes). troika would download fallback fonts from a
 * CDN for them — that fails offline and on locked-down school networks — so 3D text drops them (use EmojiSprite).
 */
const NOT_IN_FONT = /[\p{Extended_Pictographic}\u2190-\u21FF\u2500-\u27BF\uFE0F]/gu;
const clean = (node: ReactNode): ReactNode => (typeof node === 'string' ? node.replace(NOT_IN_FONT, '').replace(/ {2,}/g, ' ').trim() : node);

/** 3D text: wraps, centers, handles Arabic (troika shapes it and lays it out right-to-left). */
export function VText({
  children,
  size = 0.06,
  color = VC.ink,
  bold,
  maxWidth,
  position,
  anchorX = 'center',
  anchorY = 'middle',
  align = 'center',
  outline,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  bold?: boolean;
  maxWidth?: number;
  position?: V3;
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
  align?: 'left' | 'center' | 'right';
  outline?: string;
}) {
  return (
    <Text
      font={bold ? FONT_BOLD : FONT}
      fontSize={size}
      color={color}
      maxWidth={maxWidth}
      position={position}
      anchorX={anchorX}
      anchorY={anchorY}
      textAlign={align}
      direction="auto"
      outlineWidth={outline ? size * 0.08 : 0}
      outlineColor={outline}
      lineHeight={1.25}
    >
      {clean(children)}
    </Text>
  );
}

/** A floating rounded card for VR UI (always faces +z; place it in front of the player). */
export function Panel({ width, height, position, rotation, children, color = VC.panel, opacity = 0.96 }: { width: number; height: number; position?: V3; rotation?: V3; children?: ReactNode; color?: string; opacity?: number }) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[width, height, 0.02]} radius={0.03} smoothness={4}>
        {/* a little self-light so cards read as white paper, not grey plastic */}
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} transparent opacity={opacity} roughness={0.9} />
      </RoundedBox>
      <group position={[0, 0, 0.012]}>{children}</group>
    </group>
  );
}

/**
 * A chunky button that works with a mouse, a controller ray or a hand (pointer events from @react-three/xr).
 * The press sinks like the 2D kid buttons.
 */
export function VButton({
  label,
  onClick,
  position,
  width = 0.42,
  height = 0.11,
  color = VC.violet,
  textColor = VC.white,
  disabled,
  name,
}: {
  label: string;
  onClick: () => void;
  position?: V3;
  width?: number;
  height?: number;
  color?: string;
  textColor?: string;
  disabled?: boolean;
  /** object name, so tests and the debug panel can find it */
  name?: string;
}) {
  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!disabled) onClick();
  };
  return (
    <group position={position} name={name}>
      <RoundedBox
        args={[width, height, 0.03]}
        radius={0.025}
        smoothness={3}
        position={[0, 0, down ? 0.004 : 0.015]}
        onClick={click}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => {
          setHover(false);
          setDown(false);
        }}
        onPointerDown={() => setDown(true)}
        onPointerUp={() => setDown(false)}
      >
        <meshStandardMaterial color={disabled ? '#9a95b8' : color} emissive={hover && !disabled ? color : '#000000'} emissiveIntensity={hover ? 0.35 : 0} roughness={0.6} />
      </RoundedBox>
      <VText size={height * 0.42} color={textColor} bold position={[0, 0, down ? 0.022 : 0.033]}>
        {label}
      </VText>
    </group>
  );
}

/** Color emoji as a sprite (troika fonts have no color emoji). */
export function EmojiSprite({ emoji, size = 0.25, position }: { emoji: string; size?: number; position?: V3 }) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.font = '104px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 64, 72);
    }
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, [emoji]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[size, size, size]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}
