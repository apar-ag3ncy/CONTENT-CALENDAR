// One Instagram-style carousel used everywhere media has multiple slides.
//  • Native horizontal scroll-snap → real touch swipe + trackpad scroll.
//  • Hover arrows (desktop), dot indicators, and a 1/N counter.
//  • Active-slide tracking so videos only play on the slide you're viewing.
import { useEffect, useRef, useState, type ReactNode } from 'react'

const Chevron = ({ left = false }: { left?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d={left ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>
)

export function Carousel({
  count,
  renderSlide,
  className = '',
  viewportClassName = '',
  ariaLabel = 'Media carousel',
}: {
  count: number
  /** Render one slide. `active` is true for the slide currently in view. */
  renderSlide: (index: number, active: boolean) => ReactNode
  /** Applied to the carousel root (sizing in the parent layout). */
  className?: string
  /** Applied to the scrolling viewport (e.g. a fixed height). */
  viewportClassName?: string
  ariaLabel?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)
  const multi = count > 1

  const goTo = (i: number) => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }
  const onScroll = () => {
    const el = ref.current
    if (!el || el.clientWidth === 0) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    setIdx((prev) => (prev === i ? prev : Math.max(0, Math.min(count - 1, i))))
  }

  return (
    <div className={`group/car relative ${className}`} aria-roledescription="carousel" aria-label={ariaLabel}>
      <div
        ref={ref}
        onScroll={onScroll}
        className={`flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${viewportClassName}`}
      >
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="w-full flex-none snap-center snap-always">
            {renderSlide(i, i === idx)}
          </div>
        ))}
      </div>

      {multi ? (
        <>
          <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
            {idx + 1}/{count}
          </span>
          {idx > 0 ? (
            <button
              type="button"
              aria-label="Previous"
              onClick={(e) => {
                e.stopPropagation()
                goTo(idx - 1)
              }}
              className="absolute left-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-slate-800 opacity-0 shadow-md transition hover:bg-white focus-visible:opacity-100 group-hover/car:opacity-100"
            >
              <Chevron left />
            </button>
          ) : null}
          {idx < count - 1 ? (
            <button
              type="button"
              aria-label="Next"
              onClick={(e) => {
                e.stopPropagation()
                goTo(idx + 1)
              }}
              className="absolute right-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-slate-800 opacity-0 shadow-md transition hover:bg-white focus-visible:opacity-100 group-hover/car:opacity-100"
            >
              <Chevron />
            </button>
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
            {Array.from({ length: count }, (_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/55'}`} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

/** A muted, looping video that plays only while it's the active carousel slide. */
export function CarouselVideo({
  src,
  poster,
  active,
  className = '',
  controls = true,
}: {
  src: string
  poster?: string
  active: boolean
  className?: string
  controls?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    if (active) v.play().catch(() => {})
    else v.pause()
  }, [active])
  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      controls={controls}
      className={className}
    />
  )
}
