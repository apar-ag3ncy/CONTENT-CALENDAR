import { Link } from 'react-router-dom'
import { monthKey } from '../lib/dates'

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

/** Floating circuit-node labels — content-calendar themed. */
const LABELS = [
  { t: 'Posts', x: '75%', y: '30%' },
  { t: 'Reels', x: '30%', y: '47%' },
  { t: 'Calendar', x: '63%', y: '57%' },
  { t: 'Stories', x: '33%', y: '63%' },
  { t: 'Plan', x: '8%', y: '64%' },
  { t: 'Schedule', x: '63%', y: '80%' },
]

/** Circuit-trace paths (viewBox 0 0 100 100); light pulses run along these. */
const TRACES = [
  'M30 47 H44 V58',
  'M63 57 H55 V60',
  'M33 63 H46 V60',
  'M8 64 H22 V58 H40',
  'M75 30 V42 H62',
  'M63 80 V70 H52',
  'M46 86 V78 H56',
]

export default function LandingView() {
  const monthHref = `/month/${monthKey(new Date())}`
  const NAV = [
    { label: 'Home', href: '/' },
    { label: 'Calendar', href: monthHref },
    { label: 'Grid Review', href: '/grid' },
    { label: 'Year', href: '/year' },
    { label: 'Info', href: '/settings' },
  ]

  return (
    <div className="relative isolate flex min-h-screen w-full flex-col overflow-hidden bg-[#0a0604] text-white">
      {/* ── Background creative ───────────────────────────────────── */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#0a0604]" />

        {/* soft ambient under-glow (right-weighted, like the reference) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(58% 60% at 86% 102%, rgba(241,96,1,0.42), transparent 62%), radial-gradient(46% 52% at 8% 102%, rgba(255,150,52,0.5), rgba(241,96,1,0.2) 46%, transparent 72%), linear-gradient(to top, rgba(241,96,1,0.32) 0%, rgba(150,40,10,0.12) 22%, transparent 48%)',
          }}
        />

        {/* ── Flowing fire — fractal-noise displaced fire gradient that rises, falls & flickers ── */}
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="fireGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#fff6dc" />
              <stop offset="15%" stopColor="#ffd589" />
              <stop offset="33%" stopColor="#fb8420" />
              <stop offset="54%" stopColor="#ef4a12" />
              <stop offset="76%" stopColor="#a52c0c" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#2a0d04" stopOpacity="0" />
            </linearGradient>
            <filter id="fireA" x="-25%" y="-25%" width="150%" height="150%">
              <feTurbulence type="fractalNoise" baseFrequency="0.008 0.014" numOctaves="2" seed="4" result="n">
                <animate attributeName="baseFrequency" dur="15s" values="0.008 0.014;0.011 0.021;0.008 0.014" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="n" scale="66" xChannelSelector="R" yChannelSelector="G" />
              <feGaussianBlur stdDeviation="0.7" />
            </filter>
            <filter id="fireB" x="-25%" y="-25%" width="150%" height="150%">
              <feTurbulence type="fractalNoise" baseFrequency="0.011 0.019" numOctaves="2" seed="11" result="n2">
                <animate attributeName="baseFrequency" dur="19s" values="0.011 0.019;0.014 0.027;0.011 0.019" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="n2" scale="46" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
          <g style={{ mixBlendMode: 'screen' }}>
            <rect className="fire-rise" x="-12%" y="34%" width="124%" height="92%" fill="url(#fireGrad)" filter="url(#fireA)" />
            <rect className="fire-rise-2" x="-12%" y="40%" width="124%" height="86%" fill="url(#fireGrad)" filter="url(#fireB)" opacity="0.82" />
          </g>
        </svg>

        {/* weight the glow to the right (dark left, like the reference) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(8,5,3,0.82) 0%, rgba(8,5,3,0.34) 24%, transparent 48%)',
          }}
        />
        {/* dark vertical slats (static) — the fire glows through the gaps, striped like the reference */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(6,3,1,0.62) 0 40px, rgba(6,3,1,0) 40px 76px)',
            maskImage: 'linear-gradient(to top, black 62%, transparent 95%)',
            WebkitMaskImage: 'linear-gradient(to top, black 62%, transparent 95%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent 0 74px, rgba(255,214,150,0.06) 74px 76px)',
            maskImage: 'linear-gradient(to top, black 62%, transparent 95%)',
            WebkitMaskImage: 'linear-gradient(to top, black 62%, transparent 95%)',
          }}
        />
        {/* soft vignette to focus the glow (premium framing) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(132% 120% at 50% 40%, transparent 50%, rgba(0,0,0,0.5) 100%)',
          }}
        />

        {/* circuit traces — faint base lines + a light pulse running along each */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            <filter id="traceGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="0.7" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g stroke="#ff9a4d" strokeWidth="1" opacity="0.22">
            {TRACES.map((d, i) => (
              <path key={`b${i}`} d={d} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          <g stroke="#ffe2b0" strokeWidth="1.5" strokeLinecap="round" filter="url(#traceGlow)">
            {TRACES.map((d, i) => (
              <path
                key={`p${i}`}
                d={d}
                pathLength={200}
                vectorEffect="non-scaling-stroke"
                className="trace-pulse"
                style={{ animationDelay: `${i * 0.55}s` }}
              />
            ))}
          </g>
        </svg>

        {/* top darkening so the headline stays crisp */}
        <div
          className="absolute inset-x-0 top-0 h-1/2"
          style={{ backgroundImage: 'linear-gradient(to bottom, #050301 4%, transparent)' }}
        />
        {/* film grain */}
        <div
          className="absolute inset-0 opacity-[0.13] mix-blend-overlay"
          style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }}
        />
      </div>

      {/* ── Top nav ───────────────────────────────────────────────── */}
      <header className="landing-in relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span
            className="h-7 w-7 rounded-full ring-1 ring-white/10"
            style={{
              background:
                'radial-gradient(circle at 36% 30%, #ffcf8f, #f16001 52%, #2a0f06 90%)',
            }}
          />
          <span className="text-[17px] font-semibold tracking-tight">Chheda&rsquo;s × Apar</span>
        </div>

        <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm lg:flex">
          {NAV.map((n, i) => (
            <Link
              key={n.label}
              to={n.href}
              className={`rounded-full px-3.5 py-1.5 transition ${
                i === 0 ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <Link
          to={monthHref}
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#0a0604] transition hover:bg-cream active:scale-[.98]"
        >
          Calendar
        </Link>
      </header>

      {/* ── Hero (top-aligned, like the reference) ────────────────── */}
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-6 pt-12 text-center sm:pt-16">
        {/* badge */}
        <div
          className="landing-in inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] py-1 pl-1 pr-3 text-xs backdrop-blur"
          style={{ animationDelay: '0.1s' }}
        >
          <span className="rounded-full bg-gradient-to-r from-flame-400 to-brand-600 px-2.5 py-1 font-semibold text-white">
            Internal
          </span>
          <span className="text-white/60">content calendar</span>
        </div>

        {/* headline — medium weight, like the reference */}
        <h1 className="mt-7 text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-[58px]">
          <span className="landing-in block" style={{ animationDelay: '0.2s' }}>
            Chheda&rsquo;s × Apar
          </span>
          <span className="landing-in block" style={{ animationDelay: '0.3s' }}>
            The team&rsquo;s content calendar.
          </span>
        </h1>

        {/* subtitle */}
        <p
          className="landing-in mt-5 max-w-md text-sm leading-relaxed text-white/55"
          style={{ animationDelay: '0.44s' }}
        >
          Plan every post, reel and story in one shared calendar — create,
          review the grid, and schedule it all in one place.
        </p>

        {/* buttons */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to={monthHref}
            className="landing-in rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0a0604] shadow-[0_14px_40px_-14px_rgba(255,255,255,0.5)] transition hover:bg-cream active:scale-[.98]"
            style={{ animationDelay: '0.54s' }}
          >
            Open Calendar
          </Link>
          <Link
            to="/grid"
            className="landing-in rounded-full border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10 active:scale-[.98]"
            style={{ animationDelay: '0.62s' }}
          >
            Grid Review
          </Link>
        </div>
      </main>

      {/* ── Floating circuit-node labels (desktop) ────────────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[4] hidden lg:block">
        {LABELS.map((l, i) => (
          <span key={l.t} style={{ left: l.x, top: l.y }} className="absolute -translate-x-1/2">
            <span
              className="landing-in inline-flex items-center whitespace-nowrap text-[11px] font-medium tracking-wide text-white/45"
              style={{ animationDelay: `${0.8 + i * 0.05}s` }}
            >
              <span
                className="mr-1.5 inline-block h-1 w-1 rounded-full bg-flame-400 shadow-[0_0_7px_rgba(248,127,35,0.95)]"
                style={{ animation: `node-pulse 3.4s ease-in-out ${i * 0.4}s infinite` }}
              />
              {l.t}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
