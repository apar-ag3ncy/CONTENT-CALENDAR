import { useEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Wraps content and animates it in (fade + slide up) as it scrolls into view,
 * using GSAP ScrollTrigger. Safe under React StrictMode via gsap.context().
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
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          delay,
          ease: 'power3.out',
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
