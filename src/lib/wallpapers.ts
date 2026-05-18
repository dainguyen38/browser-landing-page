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
