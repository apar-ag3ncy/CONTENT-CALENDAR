// Central display metadata for content types, post formats, and statuses.
import type { ContentType, ContentStatus, PostFormat } from '../types/database'

export const CONTENT_TYPE_ORDER: ContentType[] = [
  'post',
  'reel',
  'story',
  'caption',
]

// ─────────────────────────── chip colours ───────────────────────────
// Chips are the primary visual encoding across Week, Day and the Grid modal,
// so they have to read in BOTH themes.
//
// Two rules make that work, and both matter:
//
// 1. Tints are expressed as an OPACITY of the mid tone (e.g. brand-500/10)
//    rather than the -50/-100 steps. index.css carries a global dark-mode shim
//    (`.dark .bg-brand-50 { … }`, `.dark .bg-slate-100 { … }`, …) that rewrites
//    those exact class names; because the shim sits at the end of the file it
//    beats Tailwind's `dark:` utilities on equal specificity, so a `dark:`
//    variant on a shimmed class silently loses. Opacity tints aren't shimmed.
//
// 2. Every chip states its dark colours explicitly. Relying on the shim gave a
//    mixed result: the brand chip's background was darkened while its text
//    stayed brand-700, landing at 2.15:1 (unreadable), while the purple/sky/
//    emerald chips weren't shimmed at all and rendered as bright light-mode
//    stickers on the dark UI.
//
// The class strings are written out in full on purpose — Tailwind's scanner
// only sees literal strings, so a `bg-${hue}-500/10` helper would compile to
// classes that were never generated.
export const CONTENT_TYPE_META: Record<
  ContentType,
  { label: string; plural: string; icon: string; dot: string; chip: string }
> = {
  post: {
    label: 'Post',
    plural: 'Posts',
    icon: '🖼️',
    dot: 'bg-brand-600',
    chip:
      'bg-brand-500/10 text-brand-700 ring-1 ring-brand-500/20 ' +
      'dark:bg-brand-500/20 dark:text-brand-200 dark:ring-brand-400/30',
  },
  reel: {
    label: 'Reel',
    plural: 'Reels',
    icon: '🎬',
    dot: 'bg-purple-600',
    chip:
      'bg-purple-500/10 text-purple-700 ring-1 ring-purple-500/20 ' +
      'dark:bg-purple-500/20 dark:text-purple-200 dark:ring-purple-400/30',
  },
  story: {
    label: 'Story',
    plural: 'Stories',
    icon: '⏱️',
    dot: 'bg-sky-600',
    chip:
      'bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/20 ' +
      'dark:bg-sky-500/20 dark:text-sky-200 dark:ring-sky-400/30',
  },
  caption: {
    label: 'Caption',
    plural: 'Captions',
    icon: '✍️',
    dot: 'bg-emerald-600',
    chip:
      'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 ' +
      'dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/30',
  },
}

export const POST_FORMAT_ORDER: PostFormat[] = ['static', 'carousel']

export const POST_FORMAT_META: Record<
  PostFormat,
  { label: string; icon: string }
> = {
  static: { label: 'Static', icon: '🖼️' },
  carousel: { label: 'Carousel', icon: '🎠' },
}

export const STATUS_ORDER: ContentStatus[] = ['scheduled', 'posted', 'backup']

// Same two rules as the type chips above: opacity tints (not the shimmed -100
// step) and explicit dark colours. Status chips stay pill-shaped while type
// chips are square-cornered, so the two remain tellable apart at a glance even
// where their hues are close.
export const STATUS_META: Record<
  ContentStatus,
  { label: string; chip: string }
> = {
  scheduled: {
    label: 'Scheduled',
    chip: 'bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
  },
  posted: {
    label: 'Posted',
    chip: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  },
  backup: {
    label: 'Backup',
    chip: 'bg-amber-500/15 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200',
  },
}

/**
 * Safe status lookup. Items created before the status model changed may carry
 * legacy values (e.g. "idea"); fall back gracefully instead of crashing.
 */
export function statusMeta(status: string): { label: string; chip: string } {
  return (
    STATUS_META[status as ContentStatus] ?? {
      label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown',
      chip: 'bg-slate-500/15 text-slate-600 dark:bg-white/10 dark:text-neutral-300',
    }
  )
}
