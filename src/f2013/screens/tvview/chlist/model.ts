import type { Channel } from '../../../../tv/channels'

// What the Channel List shows: the TV's channel (navigation) mode and the sort order, the rows for a
// mode, and the Sorting/Mode edge windows' items. Strings: g_ChannelListWStringEng (index noted).

export const S = {
  ALL: 'All', // 1
  TV: 'TV', // 2
  RADIO: 'Radio', // 3
  DATA: 'Data/Other', // 4
  ANALOGUE: 'Analogue', // 5
  MODE: 'Mode', // 9
  EDIT_FAVOURITES: 'Edit Favourites', // 29
  SORTING: 'Sorting', // 30
  NOT_AVAILABLE: "This function isn't available.", // 31
  NUMBER: 'Number', // 32
  NAME: 'Name', // 33
  EMPTY: 'The current channel list is empty.', // 39
  NO_INFORMATION: 'No Information', // 42
  NO_PROGRAMME_NAME: 'No Programme Name', // 48
}

// The channel mode is the TV's navigation mode (CChannelListUtil::m_navigationMode /
// m_subNavigationMode, set with SetNavigationMode); the exhibit keeps it in setting 'tv.chMode'
// (CH +/- and the banner read it). GetModeName (0x029c694c): (0,0) All, (0,1) TV, (0,2) Radio,
// (0,3) Data/Other, (0,7) Analogue, (6,n) Favourites n+1.
export type ChMode = 'all' | 'tv' | 'radio' | 'data' | 'analogue' | 'fav1' | 'fav2' | 'fav3' | 'fav4' | 'fav5'
export type SortMode = 'number' | 'name'

export const MODE_NAME: Record<ChMode, string> = {
  all: S.ALL,
  tv: S.TV,
  radio: S.RADIO,
  data: S.DATA,
  analogue: S.ANALOGUE,
  // CAppUtil::GetFavoriteName; the exhibit's lineup has no favourites, so these never appear (inferred names)
  fav1: 'Favourites 1',
  fav2: 'Favourites 2',
  fav3: 'Favourites 3',
  fav4: 'Favourites 4',
  fav5: 'Favourites 5',
}

// CChannelListUtil::SetChannelConditionToSearch (0x029c76d0): mode (0, n) filters on the DVB service
// type; analogue channels are their own mode (sub mode 7).
export function inMode(ch: Channel, mode: ChMode) {
  switch (mode) {
    case 'all':
      return true
    case 'tv':
      return ch.kind === 'tv' && ch.delivery !== 'ATV'
    case 'radio':
      return ch.kind === 'radio'
    case 'data':
      return ch.kind === 'data'
    case 'analogue':
      return ch.delivery === 'ATV'
    default:
      return false // no favourites in the mocked lineup
  }
}

// The rows of a mode, as indexes into the stored lineup. CChannelListWindow::m_GetChannelSortMode:
// sort mode 0 = by number (ECompType 0), 1 = by name (ECompType 1 for DVB).
export function rowsFor(channels: Channel[], mode: ChMode, sort: SortMode): number[] {
  const rows = channels.map((_, i) => i).filter(i => inMode(channels[i], mode))
  if (sort === 'name') rows.sort((a, b) => channels[a].name.localeCompare(channels[b].name) || channels[a].number - channels[b].number)
  else rows.sort((a, b) => channels[a].number - channels[b].number)
  return rows
}

// An edge-window item (CChannelListEdgeItem). m_AddItem's flag bits: 1 checked (0x404), 2 has a
// value and opens a pop-up (0x405), 4 separator line below (0x406), 8 enabled (0x407).
export type EdgeItem = {
  key: string
  name: string
  value?: string
  checked: boolean
  separator: boolean
  enabled: boolean
}

// CChannelListEdgeWindow::m_CreateSortingList (0x029bd3a4) for the EU set: Number and Name (IsSupport
// 0; enabled when the list is not empty, Number also outside Favourites (IsAvailableNow 1), Name also
// outside Analogue (IsAvailableNow 2)). Genre needs IsSupport 1 (CPMS 0x481 network channel info) and
// View Mode IsSupport 2, which returns 0: neither is listed.
export function sortingItems(mode: ChMode, sort: SortMode, empty: boolean): EdgeItem[] {
  const fav = mode.startsWith('fav')
  return [
    { key: 'number', name: S.NUMBER, checked: sort === 'number' && !(empty || fav), separator: false, enabled: !empty && !fav },
    { key: 'name', name: S.NAME, checked: sort === 'name' && !(empty || fav || mode === 'analogue'), separator: false, enabled: !empty && !fav && mode !== 'analogue' },
  ]
}

// CChannelListEdgeWindow::m_CreateModeList (0x029bdb44): [Antenna (only with more than one aerial
// type, IsSupport 4)], Edit Favourites (flags 4|8: separator, enabled while not recording), the
// favourite lists that have channels, All, then m_AddChannelModeInDVB: TV, Radio, Data/Other and
// Analogue, each only when that mode has channels. m_CheckCurrentMode ticks the current mode.
export function modeItems(channels: Channel[], mode: ChMode): EdgeItem[] {
  const items: EdgeItem[] = [{ key: 'editfav', name: S.EDIT_FAVOURITES, checked: false, separator: true, enabled: true }]
  const modes: ChMode[] = ['all', 'tv', 'radio', 'data', 'analogue']
  for (const m of modes) {
    if (!channels.some(ch => inMode(ch, m))) continue
    items.push({ key: m, name: MODE_NAME[m], checked: m === mode, separator: false, enabled: true })
  }
  return items
}

// CChannelListEdgeWindow::m_SetFocusItemIndex (0x029bc0e4): the first ticked item, else the first
// enabled one, else the first.
export function edgeInitialFocus(items: EdgeItem[]) {
  const c = items.findIndex(i => i.checked)
  if (c >= 0) return c
  const e = items.findIndex(i => i.enabled)
  return e >= 0 ? e : 0
}
