import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'

// Register once for the whole app (idempotent — gsap dedupes).
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)

/** True when the user asked the OS to minimise motion. Read live so it reacts to setting changes. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** Premium house easing + timings. Centralised so every reveal feels like one system. */
export const EASE = 'power3.out'
export const DUR = 0.62
export const STAGGER = 0.07

export { gsap, ScrollTrigger }
