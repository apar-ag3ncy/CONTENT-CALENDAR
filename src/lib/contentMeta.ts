// Central display metadata for content types, post formats, and statuses.
import type { ContentType, ContentStatus, PostFormat } from '../types/database'

export const CONTENT_TYPE_ORDER: ContentType[] = [
  'post',
  'reel',
  'story',
  'caption',
]

export const CONTENT_TYPE_META: Record<
  ContentType,
  { label: string; plural: string; icon: string; dot: string; chip: string }
> = {
  post: {
    label: 'Post',
    plural: 'Posts',
    icon: '🖼️',
    dot: 'bg-brand-600',
    chip: 'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
  },
  reel: {
    label: 'Reel',
    plural: 'Reels',
    icon: '🎬',
    dot: 'bg-purple-600',
    chip: 'bg-purple-50 text-purple-700 ring-1 ring-purple-100',
  },
  story: {
    label: 'Story',
    plural: 'Stories',
    icon: '⏱️',
    dot: 'bg-sky-600',
    chip: 'bg-sky-50 text-sky-700 ring-1 ring-sky-100',
  },
  caption: {
    label: 'Caption',
    plural: 'Captions',
    icon: '✍️',
    dot: 'bg-emerald-600',
    chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
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

export const STATUS_ORDER: ContentStatus[] = [
  'idea',
  'drafting',
  'ready',
  'scheduled',
  'posted',
]

export const STATUS_META: Record<
  ContentStatus,
  { label: string; chip: string }
> = {
  idea: { label: 'Idea', chip: 'bg-slate-100 text-slate-600' },
  drafting: { label: 'Drafting', chip: 'bg-amber-100 text-amber-800' },
  ready: { label: 'Ready', chip: 'bg-sky-100 text-sky-800' },
  scheduled: { label: 'Scheduled', chip: 'bg-violet-100 text-violet-800' },
  posted: { label: 'Posted', chip: 'bg-emerald-100 text-emerald-800' },
}
