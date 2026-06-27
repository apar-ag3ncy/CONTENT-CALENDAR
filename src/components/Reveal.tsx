import { useEffect, useRef, type ReactNode } from 'react'
import { gsap, prefersReducedMotion, EASE, DUR, STAGGER } from '../lib/motion'

/**
 * Fade + slide-up (+ tiny blur lift) as it scrolls into view, via GSAP ScrollTrigger.
 * Honors prefers-reduced-motion (renders instantly, no transform). StrictMode-safe via gsap.context().
 */
export function Reveal({
  children,
  className,
  y = 26,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  y?: number
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) {
      gsap.set(el, { opacity: 1, y: 0, clearProps: 'filter' })
      return
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y, filter: 'blur(6px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: DUR,
          delay,
          ease: EASE,
          scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        },
      )
    }, el)
    return () => ctx.revert()
  }, [y, delay])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

/**
 * Reveals each DIRECT child in sequence as the container scrolls in.
 * Use for card grids / form sections so they cascade instead of popping as one block.
 * The element it wraps must have the cards as DIRECT children (no wrapper between).
 */
export function StaggerReveal({
  children,
  className,
  y = 22,
  stagger = STAGGER,
}: {
  children: ReactNode
  className?: string
  y?: number
  stagger?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const kids = Array.from(el.children) as HTMLElement[]
    if (kids.length === 0) return
    if (prefersReducedMotion()) {
      gsap.set(kids, { opacity: 1, y: 0, clearProps: 'filter' })
      return
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        kids,
        { opacity: 0, y, filter: 'blur(5px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: DUR,
          ease: EASE,
          stagger,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        },
      )
    }, el)
    return () => ctx.revert()
  }, [y, stagger])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
