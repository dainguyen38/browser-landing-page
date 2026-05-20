import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'

import w01 from '@/assets/wallpapers/01.jpg'
import w02 from '@/assets/wallpapers/02.jpg'
import w03 from '@/assets/wallpapers/03.jpg'
import w04 from '@/assets/wallpapers/04.jpg'
import w05 from '@/assets/wallpapers/05.jpg'
import w06 from '@/assets/wallpapers/06.jpg'
import w07 from '@/assets/wallpapers/07.jpg'
import w08 from '@/assets/wallpapers/08.jpg'

export type BundledWallpaper = {
  id: string
  url: string
  label: string
}

export type AnimatedWallpaperDef = {
  id: string
  variant: 'aurora' | 'stars' | 'particles' | 'mesh' | 'sakura'
  label: string
  /** CSS background used as a tile preview in the picker */
  preview: string
}

export const ANIMATED_WALLPAPERS: AnimatedWallpaperDef[] = [
  {
    id: 'animated:aurora',
    variant: 'aurora',
    label: 'Aurora',
    preview:
      'linear-gradient(to top, #020617 0%, #0b1437 30%, rgba(16,185,129,0.55) 45%, rgba(139,92,246,0.6) 60%, rgba(6,182,212,0.55) 72%, #020617 100%)',
  },
  {
    id: 'animated:stars',
    variant: 'stars',
    label: 'Starfield',
    preview:
      'radial-gradient(circle at 30% 30%, rgba(59,7,100,0.6) 0%, transparent 50%), radial-gradient(circle at 75% 65%, rgba(30,58,138,0.55) 0%, transparent 55%), radial-gradient(circle at 55% 20%, rgba(131,24,67,0.45) 0%, transparent 45%), #000010',
  },
  {
    id: 'animated:particles',
    variant: 'particles',
    label: 'Fireflies',
    preview:
      'radial-gradient(circle at 20% 70%, rgba(251,191,36,0.5) 0%, transparent 30%), radial-gradient(circle at 70% 30%, rgba(167,139,250,0.55) 0%, transparent 35%), radial-gradient(circle at 60% 80%, rgba(244,114,182,0.4) 0%, transparent 30%), linear-gradient(to top, #0f172a, #1e1b4b, #172554)',
  },
  {
    id: 'animated:mesh',
    variant: 'mesh',
    label: 'Mesh flow',
    preview:
      'radial-gradient(circle at 25% 30%, #8b5cf6 0%, transparent 45%), radial-gradient(circle at 75% 25%, #ec4899 0%, transparent 45%), radial-gradient(circle at 30% 80%, #06b6d4 0%, transparent 40%), radial-gradient(circle at 70% 75%, #f59e0b 0%, transparent 45%), #080814',
  },
  {
    id: 'animated:sakura',
    variant: 'sakura',
    label: 'Sakura',
    preview:
      'radial-gradient(circle at 75% 25%, rgba(254,240,138,0.55) 0%, transparent 45%), linear-gradient(to bottom, #fdf2f8, #fce7f3 40%, #fbcfe8 80%, #f9a8d4)',
  },
]

export function isAnimatedWallpaperId(id: string): boolean {
  return id.startsWith('animated:')
}

export function getAnimatedDef(id: string): AnimatedWallpaperDef | undefined {
  return ANIMATED_WALLPAPERS.find((w) => w.id === id)
}

export const BUNDLED_WALLPAPERS: BundledWallpaper[] = [
  { id: 'bundled:01', url: w01, label: 'Aurora' },
  { id: 'bundled:02', url: w02, label: 'Ridge' },
  { id: 'bundled:03', url: w03, label: 'Drift' },
  { id: 'bundled:04', url: w04, label: 'Lagoon' },
  { id: 'bundled:05', url: w05, label: 'Dunes' },
  { id: 'bundled:06', url: w06, label: 'Bloom' },
  { id: 'bundled:07', url: w07, label: 'Ember' },
  { id: 'bundled:08', url: w08, label: 'Nebula' },
]

export function getBundled(id: string): BundledWallpaper | undefined {
  return BUNDLED_WALLPAPERS.find((w) => w.id === id)
}

const idbKey = (id: string) => `wallpaper:${id}`

export async function saveCustomWallpaper(id: string, blob: Blob): Promise<void> {
  await idbSet(idbKey(id), blob)
}

export async function loadCustomWallpaper(id: string): Promise<Blob | undefined> {
  return (await idbGet<Blob>(idbKey(id))) ?? undefined
}

export async function deleteCustomWallpaper(id: string): Promise<void> {
  await idbDel(idbKey(id))
}
