import { Link } from 'react-router-dom'
import { monthKey } from '../lib/dates'

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

const NAV = ['Home', 'Private Key', 'Product', 'Solution', 'Pricing', 'Community']

/** Floating circuit-node labels, positioned like the reference. */
const LABELS = [
  { t: 'Local HUB', x: '75%', y: '30%' },
  { t: 'Encrypted', x: '30%', y: '47%' },
  { t: 'Center HUB', x: '63%', y: '57%' },
  { t: 'Light speed', x: '33%', y: '63%' },
  { t: 'Secured', x: '8%', y: '64%' },
  { t: 'System', x: '63%', y: '80%' },
]

export default function LandingView() {
  const monthHref = `/month/${monthKey(new Date())}`

  return (
    <div className="relative isolate flex min-h-screen w-full flex-col overflow-hidden bg-[#0a0604] text-white">
      {/* ── Background creative ───────────────────────────────────── */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#0a0604]" />

        {/* molten floor of the flame */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to top, rgba(241,96,1,0.42) 0%, rgba(150,40,10,0.16) 24%, transparent 52%)',
          }}
        />
        {/* bottom-left lava root */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(40% 42% at 6% 100%, rgba(255,150,52,0.78), rgba(241,96,1,0.34) 44%, transparent 72%)',
          }}
        />
        {/* warm haze on the right, softening the peak into the floor */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(72% 92% at 90% 98%, rgba(241,96,1,0.42), transparent 60%)',
          }}
        />
        {/* the smooth flowing flame crest — a luminous ridge sweeping bottom-left → upper-right */}
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{
            backgroundImage:
              'linear-gradient(118deg, transparent 28%, rgba(255,150,55,0.22) 43%, rgba(255,216,152,0.82) 52%, rgba(255,150,55,0.46) 59%, rgba(214,46,20,0.18) 68%, transparent 84%)',
          }}
        />
        {/* flame peak bloom, upper-right */}
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{
            backgroundImage:
              'radial-gradient(48% 70% at 96% 24%, rgba(255,176,72,0.7), rgba(241,96,1,0.3) 42%, transparent 64%)',
          }}
        />

        {/* weight the glow to the right (dark left, like the reference) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(8,5,3,0.82) 0%, rgba(8,5,3,0.34) 24%, transparent 48%)',
          }}
        />
        {/* whisper of vertical panel hairlines (subtle — fades out toward the top) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent 0 44px, rgba(0,0,0,0.2) 44px 45px, transparent 45px 46px)',
            maskImage: 'linear-gradient(to top, black 58%, transparent 92%)',
            WebkitMaskImage: 'linear-gradient(to top, black 58%, transparent 92%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent 0 22px, rgba(255,255,255,0.045) 22px 23px, transparent 23px 45px)',
            maskImage: 'linear-gradient(to top, black 60%, transparent 95%)',
            WebkitMaskImage: 'linear-gradient(to top, black 60%, transparent 95%)',
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

        {/* circuit traces converging toward the orb */}
        <svg
          className="absolute inset-0 h-full w-full opacity-25"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
          stroke="#ff9a4d"
          strokeWidth="1"
        >
          <path d="M30 47 H44 V58" vectorEffect="non-scaling-stroke" />
          <path d="M63 57 H55 V60" vectorEffect="non-scaling-stroke" />
          <path d="M33 63 H46 V60" vectorEffect="non-scaling-stroke" />
          <path d="M8 64 H22 V58 H40" vectorEffect="non-scaling-stroke" />
          <path d="M75 30 V42 H62" vectorEffect="non-scaling-stroke" />
          <path d="M63 80 V70 H52" vectorEffect="non-scaling-stroke" />
          <path d="M46 86 V78 H56" vectorEffect="non-scaling-stroke" />
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
          <span className="text-[17px] font-semibold tracking-tight">Recognito.</span>
        </div>

        <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm lg:flex">
          {NAV.map((n, i) => (
            <Link
              key={n}
              to={i === 0 ? '/' : monthHref}
              className={`rounded-full px-3.5 py-1.5 transition ${
                i === 0 ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white'
              }`}
            >
              {n}
            </Link>
          ))}
        </nav>

        <Link
          to={monthHref}
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#0a0604] transition hover:bg-cream active:scale-[.98]"
        >
          Join Beta
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
            Get early access
          </span>
          <span className="text-white/60">web3.0 beta</span>
        </div>

        {/* headline — medium weight, like the reference */}
        <h1 className="mt-7 text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-[58px]">
          <span className="landing-in block" style={{ animationDelay: '0.2s' }}>
            Meet! Recognito
          </span>
          <span className="landing-in block" style={{ animationDelay: '0.3s' }}>
            Built for a secure Web3 future.
          </span>
        </h1>

        {/* subtitle */}
        <p
          className="landing-in mt-5 max-w-md text-sm leading-relaxed text-white/55"
          style={{ animationDelay: '0.44s' }}
        >
          Empowering blockchain networks with top-tier validation, RPC, and IBC
          relayers—built for decentralized scale.
        </p>

        {/* buttons */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to={monthHref}
            className="landing-in rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0a0604] shadow-[0_14px_40px_-14px_rgba(255,255,255,0.5)] transition hover:bg-cream active:scale-[.98]"
            style={{ animationDelay: '0.54s' }}
          >
            Apply for Beta
          </Link>
          <Link
            to="/grid"
            className="landing-in rounded-full border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10 active:scale-[.98]"
            style={{ animationDelay: '0.62s' }}
          >
            Learn more
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
              <span className="mr-1.5 inline-block h-1 w-1 rounded-full bg-flame-400 shadow-[0_0_7px_rgba(248,127,35,0.95)]" />
              {l.t}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
