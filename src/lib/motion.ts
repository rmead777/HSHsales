// Single source of truth for motion (per the motion-craft system). Components import a
// named token — never inline durations/bounce. Uses Motion's perceptual spring API
// (visualDuration + bounce) so the two knobs stay orthogonal when tuning.
//
// Category decides bounce: FUNCTIONAL (modals, the gate, system/financial state) = 0;
// EXPRESSIVE (a link copied, a QR revealed, success) = 0.12–0.25.
//
// NOTE (motion-craft honesty rule): these values follow the structural rules, but final
// perceptual tuning ("is bounce 0.2 delightful or cheap?") must be done by a human watching
// real pixels. Tune here, in this file, and the rest of the app inherits it.

export const springs = {
  press: { type: 'spring', visualDuration: 0.09, bounce: 0 },
  microFunctional: { type: 'spring', visualDuration: 0.15, bounce: 0 },
  microExpressive: { type: 'spring', visualDuration: 0.18, bounce: 0.12 },
  standardFunctional: { type: 'spring', visualDuration: 0.28, bounce: 0 },
  standardExpressive: { type: 'spring', visualDuration: 0.34, bounce: 0.16 },
  expressive: { type: 'spring', visualDuration: 0.46, bounce: 0.24 },
} as const

// Exits are faster than entrances and never bounce.
export const exitTween = { duration: 0.18, ease: 'easeIn' } as const

// ── Reusable variants (opacity + small transform = spatial meaning) ──

export const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: springs.standardFunctional },
  exit: { opacity: 0, y: 6, transition: exitTween },
} as const

export const scaleIn = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: springs.standardExpressive },
  exit: { opacity: 0, scale: 0.98, transition: exitTween },
} as const

// Stagger container: children 40ms apart. Pair with `staggerItem` on each child.
export const staggerParent = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
} as const

export const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: springs.standardExpressive },
  exit: { opacity: 0, y: 8, transition: exitTween },
} as const

// Press feedback for buttons/cards. Keep scale ≤ ~1.02 on serious controls.
export const pressable = {
  whileHover: { scale: 1.02, transition: springs.press },
  whileTap: { scale: 0.97, transition: springs.press },
} as const
