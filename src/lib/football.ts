// TheSportsDB free V1 — no API key beyond the public test key "3".
// CORS open (access-control-allow-origin: *). Free tier provides past
// events for the major leagues; the V2 livescore endpoints require a
// paid key, so this widget focuses on recent results + the most recent
// matchday for each league.

export const FOOTBALL_LEAGUES = [
  { id: '4328', code: 'EPL', name: 'Premier League', short: 'EPL' },
  { id: '4335', code: 'LL', name: 'La Liga', short: 'La Liga' },
  { id: '4331', code: 'BL', name: 'Bundesliga', short: 'Bundes' },
  { id: '4332', code: 'SA', name: 'Serie A', short: 'Serie A' },
  { id: '4334', code: 'L1', name: 'Ligue 1', short: 'Ligue 1' },
  { id: '4480', code: 'UCL', name: 'Champions League', short: 'UCL' },
] as const

export type LeagueId = (typeof FOOTBALL_LEAGUES)[number]['id']

export interface FootballMatch {
  id: string
  league: string
  leagueBadge?: string
  home: string
  homeBadge?: string
  away: string
  awayBadge?: string
  homeScore: number | null
  awayScore: number | null
  /** ISO timestamp (UTC) */
  timestamp: string
  /** API status string. 'FT' = finished, '' or 'NS' = not started, others = in-progress codes */
  status: string
  round?: string
  venue?: string
}

interface RawEvent {
  idEvent: string
  strLeague: string
  strLeagueBadge?: string | null
  strHomeTeam: string
  strAwayTeam: string
  strHomeTeamBadge?: string | null
  strAwayTeamBadge?: string | null
  intHomeScore: string | null
  intAwayScore: string | null
  strTimestamp?: string | null
  dateEvent?: string | null
  strTime?: string | null
  strStatus?: string | null
  intRound?: string | null
  strVenue?: string | null
}

function toNum(s: string | null | undefined): number | null {
  if (s === null || s === undefined || s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function mapEvent(e: RawEvent): FootballMatch {
  const ts =
    e.strTimestamp ??
    (e.dateEvent && e.strTime ? `${e.dateEvent}T${e.strTime}Z` : e.dateEvent ?? '')
  return {
    id: e.idEvent,
    league: e.strLeague,
    leagueBadge: e.strLeagueBadge ?? undefined,
    home: e.strHomeTeam,
    away: e.strAwayTeam,
    homeBadge: e.strHomeTeamBadge ?? undefined,
    awayBadge: e.strAwayTeamBadge ?? undefined,
    homeScore: toNum(e.intHomeScore),
    awayScore: toNum(e.intAwayScore),
    timestamp: ts,
    status: e.strStatus ?? '',
    round: e.intRound ?? undefined,
    venue: e.strVenue ?? undefined,
  }
}

const BASE = 'https://www.thesportsdb.com/api/v1/json/3'

/** Most recent results for a league (TheSportsDB returns ~15 past events). */
export async function fetchPastEvents(leagueId: LeagueId): Promise<FootballMatch[]> {
  const res = await fetch(`${BASE}/eventspastleague.php?id=${leagueId}`)
  if (!res.ok) throw new Error(`thesportsdb: ${res.status}`)
  const json = (await res.json()) as { events: RawEvent[] | null }
  const events = json.events ?? []
  // Newest first
  return events.map(mapEvent).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

/** Upcoming fixtures (free tier — may be empty if API restricts a league). */
export async function fetchNextEvents(leagueId: LeagueId): Promise<FootballMatch[]> {
  const res = await fetch(`${BASE}/eventsnextleague.php?id=${leagueId}`)
  if (!res.ok) throw new Error(`thesportsdb: ${res.status}`)
  const json = (await res.json()) as { events: RawEvent[] | null }
  const events = json.events ?? []
  return events.map(mapEvent).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

/** Status helpers */
export function isFinished(m: FootballMatch): boolean {
  const s = (m.status || '').toUpperCase()
  return s === 'FT' || s === 'AET' || s === 'PEN' || (m.homeScore !== null && m.awayScore !== null && s !== 'IN PLAY')
}

export function isUpcoming(m: FootballMatch): boolean {
  return m.homeScore === null && m.awayScore === null
}
