import { programmeAt, type Channel, type GuideProgramme } from '../../../../../tv/channels'

// Data the INFO banner shows, derived the way CViewerInfo::GetItemData (0x024d8ea4) and the
// CViewerChannelData(DVB)::t_Read* readers derive it, from the mocked tuner (src/tv/channels.ts).
// Every value here is what one reader returns for the "channel session" (the channel the banner is
// on, which Up/Down can move away from the tuned one) and the "programme session" (the programme
// shown, which Left/Right can move away from the one on air).

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] // g_CommonWStringEng 151,103,156,167,153,86,138
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] // CTimerUtil::GetMonthName 0x018c44d0
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] // t_ReadProgramDay table 0x0610a620 -> TVViewer 362,239,375,397,367,156,323

const mm = (n: number) => String(n).padStart(2, '0')

// CCountryUtil::GetDateTimeStr (0x018c6f50) for target location 3, read as the pan-European location
// (inferred: the order matches Samsung's PL_TV_TARGET_LOCATION list, KOR 0, USA 1, BRA 2, PANEURO 3):
//   type 2 (time)        '%h:%N'            -> "9:05"
//   type 4 (date + time) '%h:%N %a %d %b'   -> "9:05 Sat 18 Oct"
//   type 1 (date)        '%a %d %b'         -> "Sat 18 Oct"
// CTimerUtil::GetDateByFormat (0x018c6660): %h hour and %d day without padding, %N minutes '%02d'.
export function timeStr(d: Date) {
  return `${d.getHours()}:${mm(d.getMinutes())}`
}
export function dateTimeStr(d: Date) {
  return `${timeStr(d)} ${WEEKDAY_ABBR[d.getDay()]} ${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`
}
function dateStr(d: Date) {
  return `${WEEKDAY_ABBR[d.getDay()]} ${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`
}

// t_GetProgramTimeStr (0x0246f6e8 -> 0x0246f4d4): start + ' - ' + end, both type 2.
export function termStr(p: GuideProgramme) {
  return `${timeStr(p.start)} - ${timeStr(p.end)}`
}

function dayIndex(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return Math.round(x.getTime() / 86400000)
}

// t_ReadProgramDay (0x024724ec): only for a programme other than the one on air (t_CheckSameProgram
// == 2): '(' + Today 371 / Tomorrow 372 / weekday within this week / the date + ')'.
export function programDayStr(p: GuideProgramme, now: Date) {
  const days = dayIndex(p.start) - dayIndex(now)
  let s: string
  if (days === 0) s = 'Today'
  else if (days === 1) s = 'Tomorrow'
  else if (days > 7 - now.getDay()) s = dateStr(p.start) // 7 - weekday < day difference
  else s = WEEKDAY[p.start.getDay()]
  return `(${s})`
}

// m_GetProgramProgresss (0x0246e604): elapsed share of the programme in percent (integer division).
export function progressPct(p: GuideProgramme, now: Date) {
  const t = now.getTime()
  const a = p.start.getTime()
  const b = p.end.getTime()
  if (t < a) return 0
  if (t > b) return 100
  return Math.floor(((t - a) * 100) / (b - a))
}

// The programme `offset` steps after the one on air (0 = on air). Left/Right move it
// (NewProgramSessionData 7/6); there is no step before the programme on air
// (t_ReadPreProgramEnable needs t_CheckSameProgram == 2).
export function programmeFor(ch: Channel, offset: number, now: Date): GuideProgramme {
  let p = programmeAt(ch, now)
  for (let i = 0; i < offset; i++) p = programmeAt(ch, p.end)
  return p
}

// Resolution / aspect / definition icons of the picture (t_GetResolutionInfoListData 0x0246fcc4,
// t_GetAspectInfoListData 0x02470698, t_GetDefinitionInfoListData 0x024703e0). The firmware asks the
// video decoder; the mocked broadcast is 1080i for the DVB-T2 HD services and 576i for the SD ones,
// 16:9 throughout (inferred, mocked hardware). Only for the tuned channel's programme on air and only
// with a picture (CheckValidSignal), so none for radio and data services.
export function iconList(ch: Channel): string[] {
  if (ch.kind !== 'tv') return []
  return ch.hd
    ? ['Common/icon_1080i.bmp', 'Common/icon_16_9.bmp', 'Common/icon_hd.bmp'] // image ids 80, 73, 86
    : ['Common/icon_576i.bmp', 'Common/icon_16_9.bmp', 'Common/icon_sd.bmp'] // 77, 73, 87
}

// Audio of the stream (t_ReadAudio 0x02470ab0 -> CViewerChannelDataDVB::t_GetDigitalAudioInfo
// 0x02472a00): an MPEG audio track reports its dual-sound mode, Stereo (TVViewer string 356) for the
// mocked services (inferred, mocked hardware). Tuned channel and programme on air only.
export function audioStr(ch: Channel): string {
  return ch.kind === 'data' ? '' : 'Stereo'
}

// Channel type (t_ReadChType -> CCountryOption::t_GetChannelType 0x023ad7d8): DVB-T services are
// type 2 -> g_CommonWStringEng 72 'DTV Air' (the reference footage's German "DTV Kabel" is the cable
// form of the same string); analogue (types 1/3) -> 36 'ATV'.
export function chTypeStr(ch: Channel): string {
  return ch.delivery === 'ATV' ? 'ATV' : 'DTV Air'
}
