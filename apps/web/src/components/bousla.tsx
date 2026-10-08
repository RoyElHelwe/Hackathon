'use client';

import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

export type BouslaMood = 'happy' | 'thinking' | 'cheering' | 'curious' | 'sleepy';

interface Props {
  mood?: BouslaMood;
  size?: number;
  /** needle heading in degrees (0 = up). Points toward the next mission. */
  heading?: number;
  className?: string;
  animate?: boolean;
  title?: string;
}

/** Bousla (بوصلة, "compass") — Tajriba's original mascot, built from simple shapes. */
export function Bousla({ mood = 'happy', size = 120, heading = 35, className, animate = true, title = 'Bousla' }: Props) {
  const reduce = useReducedMotion();
  const live = animate && !reduce;
  const eyesClosed = mood === 'sleepy';

  return (
    <motion.svg
      role="img"
      aria-label={title}
      viewBox="0 0 120 130"
      width={size}
      height={(size * 130) / 120}
      className={cn('select-none overflow-visible', className)}
      animate={live ? (mood === 'cheering' ? { y: [0, -10, 0] } : { y: [0, -3, 0] }) : undefined}
      transition={live ? { duration: mood === 'cheering' ? 0.6 : 2.6, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      <title>{title}</title>
      {/* shadow */}
      <ellipse cx="60" cy="124" rx="30" ry="4.5" fill="#14112B" opacity="0.12" />

      {/* arms (cheering) */}
      {mood === 'cheering' && (
        <>
          <motion.path d="M20 70 Q8 52 14 40" stroke="#6C4CF1" strokeWidth="7" strokeLinecap="round" fill="none"
            animate={live ? { rotate: [0, -12, 0] } : undefined} transition={{ duration: 0.6, repeat: Infinity }} style={{ transformBox: 'view-box', transformOrigin: '20px 70px' }} />
          <motion.path d="M100 70 Q112 52 106 40" stroke="#6C4CF1" strokeWidth="7" strokeLinecap="round" fill="none"
            animate={live ? { rotate: [0, 12, 0] } : undefined} transition={{ duration: 0.6, repeat: Infinity }} style={{ transformBox: 'view-box', transformOrigin: '100px 70px' }} />
        </>
      )}

      {/* feet */}
      <ellipse cx="44" cy="117" rx="10" ry="5" fill="#5A3BE0" />
      <ellipse cx="76" cy="117" rx="10" ry="5" fill="#5A3BE0" />

      {/* body: compass case */}
      <circle cx="60" cy="70" r="46" fill="#6C4CF1" />
      <circle cx="60" cy="70" r="46" fill="url(#bousla-sheen)" />
      <circle cx="60" cy="70" r="38" fill="#FFF9EC" />
      {/* compass ticks */}
      {[0, 90, 180, 270].map((a) => (
        <rect key={a} x="58.5" y="34" width="3" height="7" rx="1.5" fill="#FFC83D" transform={`rotate(${a} 60 70)`} />
      ))}
      {[45, 135, 225, 315].map((a) => (
        <circle key={a} cx="60" cy="36.5" r="1.6" fill="#D9D2F7" transform={`rotate(${a} 60 70)`} />
      ))}

      {/* crown ring + needle on top */}
      <circle cx="60" cy="22" r="7" fill="none" stroke="#FFC83D" strokeWidth="4" />
      <motion.g
        style={{ transformBox: 'view-box', transformOrigin: '60px 22px' }}
        animate={live && mood === 'thinking' ? { rotate: [heading, heading + 360] } : { rotate: mood === 'curious' ? heading - 30 : heading }}
        transition={live && mood === 'thinking' ? { duration: 2.2, repeat: Infinity, ease: 'linear' } : { type: 'spring', stiffness: 120, damping: 8 }}
      >
        <path d="M60 4 L64 22 L60 22 Z" fill="#FF7A59" />
        <path d="M60 4 L56 22 L60 22 Z" fill="#FF9B80" />
        <path d="M60 40 L64 22 L60 22 Z" fill="#B7AEE6" opacity="0" />
      </motion.g>
      <circle cx="60" cy="22" r="2.6" fill="#14112B" />

      {/* cheeks */}
      <ellipse cx="38" cy="82" rx="6" ry="4" fill="#FF7A59" opacity="0.35" />
      <ellipse cx="82" cy="82" rx="6" ry="4" fill="#FF7A59" opacity="0.35" />

      {/* eyes */}
      {eyesClosed ? (
        <>
          <path d="M40 68 Q47 74 54 68" stroke="#14112B" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M66 68 Q73 74 80 68" stroke="#14112B" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <motion.g
          animate={live ? { scaleY: [1, 1, 0.1, 1, 1] } : undefined}
          transition={{ duration: 4, repeat: Infinity, times: [0, 0.92, 0.95, 0.98, 1] }}
          style={{ transformBox: 'view-box', transformOrigin: '60px 66px' }}
        >
          <ellipse cx="47" cy="66" rx="8.5" ry={mood === 'cheering' ? 9 : 10} fill="#14112B" />
          <ellipse cx="73" cy="66" rx="8.5" ry={mood === 'cheering' ? 9 : 10} fill="#14112B" />
          {(() => {
            const dx = mood === 'thinking' ? 2 : mood === 'curious' ? 2.5 : 0;
            const dy = mood === 'thinking' ? -4 : 0;
            return (
              <>
                <circle cx={50 + dx} cy={62 + dy} r="3.4" fill="#fff" />
                <circle cx={76 + dx} cy={62 + dy} r="3.4" fill="#fff" />
                <circle cx={45 + dx} cy={70 + dy} r="1.5" fill="#fff" opacity="0.8" />
                <circle cx={71 + dx} cy={70 + dy} r="1.5" fill="#fff" opacity="0.8" />
              </>
            );
          })()}
        </motion.g>
      )}

      {/* eyebrows */}
      {mood === 'curious' && <path d="M65 52 Q73 46 81 51" stroke="#14112B" strokeWidth="3" strokeLinecap="round" fill="none" />}
      {mood === 'thinking' && <path d="M39 53 L54 51" stroke="#14112B" strokeWidth="3" strokeLinecap="round" />}

      {/* mouth */}
      {mood === 'happy' && <path d="M50 86 Q60 95 70 86" stroke="#14112B" strokeWidth="3.5" strokeLinecap="round" fill="none" />}
      {mood === 'cheering' && <path d="M47 84 Q60 102 73 84 Z" fill="#14112B" />}
      {mood === 'cheering' && <path d="M53 92 Q60 97 67 92" fill="#FF7A59" />}
      {mood === 'thinking' && <path d="M53 89 Q58 87 66 90" stroke="#14112B" strokeWidth="3.5" strokeLinecap="round" fill="none" />}
      {mood === 'curious' && <ellipse cx="62" cy="89" rx="4.5" ry="5" fill="#14112B" />}
      {mood === 'sleepy' && <path d="M54 88 Q60 91 66 88" stroke="#14112B" strokeWidth="3" strokeLinecap="round" fill="none" />}

      {/* extras */}
      {mood === 'thinking' &&
        [0, 1, 2].map((i) => (
          <motion.circle key={i} cx={98 + i * 8} cy={30 - i * 6} r={2.5 + i} fill="#B7AEE6"
            animate={live ? { opacity: [0.2, 1, 0.2] } : undefined} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25 }} />
        ))}
      {mood === 'curious' && <text x="96" y="40" fontSize="22" fontWeight="800" fill="#FF7A59" fontFamily="Arial">?</text>}
      {mood === 'sleepy' && (
        <motion.text x="92" y="38" fontSize="16" fontWeight="800" fill="#4CB8FF" fontFamily="Arial"
          animate={live ? { y: [38, 28, 38], opacity: [0.4, 1, 0.4] } : undefined} transition={{ duration: 2.5, repeat: Infinity }}>z</motion.text>
      )}
      {mood === 'cheering' &&
        [
          [14, 22],
          [104, 18],
          [110, 60],
          [8, 58],
        ].map(([x, y], i) => (
          <motion.path key={i} d={`M${x} ${y - 6} L${x + 2} ${y - 2} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 2} Z`} fill="#FFC83D"
            animate={live ? { scale: [0.6, 1.2, 0.6], rotate: [0, 45, 0] } : undefined} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} style={{ transformBox: 'view-box', transformOrigin: `${x}px ${y}px` }} />
        ))}

      <defs>
        <radialGradient id="bousla-sheen" cx="0.35" cy="0.25" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </motion.svg>
  );
}

/** Speech bubble next to Bousla. */
export function BouslaSays({ mood = 'happy', children, size = 72, className }: { mood?: BouslaMood; children: React.ReactNode; size?: number; className?: string }) {
  return (
    <div className={cn('flex items-end gap-3', className)}>
      <Bousla mood={mood} size={size} className="shrink-0" />
      <div className="relative mb-4 rounded-[20px] rounded-es-md border-2 border-violet/20 bg-card px-4 py-3 text-base font-semibold leading-snug shadow-sm">
        {children}
      </div>
    </div>
  );
}
