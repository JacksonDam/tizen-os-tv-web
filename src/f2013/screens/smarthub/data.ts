import { F13 } from '../../assets'

// Smart Hub 2013 (exeDSP CHomePanelApp / CHomePanelMainWindow). Values come from CHomeOSDInfo statics:
// .data arrays dumped from exeDSP, and the .bss values CHomeOSDInfo::t_InitResolution /
// t_InitCommonResolution / t_InitFullHDResolution write for the 1920x1080 OSD (coordinates below are
// OSD px = stage px). Spec with addresses: samsung-tv-qemu/extract/f13/spec/smarthub.md.

export const IMG = `${F13}/smarthub`

// Internal panel ids (CHomePanelMainWindow::m_CreateHomePanel @02bb9328). Every per-panel table in
// CHomeOSDInfo is indexed by them.
export const SOCIAL = 0      // CHomeCommunicationPanel
export const ONTV = 1        // CHomeSmartLivePanel
export const MOVIES = 2      // CHomePreferredContentPanel
export const APPS = 3        // CHomeAppServicePanel
export const ALLSHARE = 4    // CHomeAllSharePanel (older Photos, Videos & Music; not in EU lists)
export const NEWS = 5        // CHomeInfoServicePanel (NewsON)
export const GAMES = 6       // CHomeGamesServicePanel
export const MULTIMEDIA = 7  // CHomeMultimediaPanel (the EU Photos, Videos & Music)

// g_HomePanelWStringEng (English UI text by string id).
export const STR = {
  socialTitle: 'Catch Up With Your Social Networks',                                       // 2
  socialText: 'See what new videos your friends have posted, and video chat on your TV.',  // 3
  appsTitle: 'Play Smarter With Samsung Apps',                                             // 4
  appsText: 'Play, enjoy, and browse online with Samsung Apps: unleash the possibilities!', // 5
  ontvTitle: 'The Ultimate Guide to Smarter Viewing',                                      // 6
  ontvText: "Find the best of what's on and experience the ultimate guide to smart viewing.", // 7
  moviesTitle: 'More Than Your Average VOD Service',                                       // 8
  moviesText: 'Get the latest films and your favourite TV shows with this smart VOD service.', // 9
  setUp: 'Set Up Smart Hub',                                                               // 10
  mediaTitle: 'The Single Access Point to All Your Media',                                 // 11
  mediaText: 'Enjoy multimedia content from USB devices, mobiles, and your PC on this TV.\nRecently accessed photos, videos and music are displayed here.', // 12
  newsTitle: 'The Single Access Point for the Most Recent News',                           // 13
  newsText: 'Get the latest news and weather on your TV.',                                 // 14
  startNow: 'Start Now',                                                                   // 15
  welcome: 'Welcome!',                                                                     // 16
  welcomeText: 'Let’s start setting up your Smart Hub.',                              // 17
  start: 'Start',                                                                          // 18
  exit: 'Exit',                                                                            // 19
  gamesText: 'Exciting challenges and hours of fun await you on the Games screen.',        // 217
  gamesTitle: 'A Great New Gaming Experience',                                             // 218
} as const

type Rgb = [number, number, number]

export type PanelDef = {
  icon: string            // HomePanel/icon/<icon>_{normal,focus,selected}.png (g_HomePanelImage)
  name: string            // panel name under the active top icon (CHomeTopMenuWindow::OnActivateWindow)
  nameColor: string       // CHomeOSDInfo::GBHOME_TOP_TEXT_COLOR @094479e4 (A,R,G,B ints)
  bg: [Rgb, Rgb]          // CHomeOSDInfo::HOMEPANEL_BACKGROUND_MIRAGE_COLOR @0944789c: top, bottom
  // the default-panel ("Set Up Smart Hub") page, CHomePanelWindowBase::InitializeDefaultPanel @02bc0d44
  // filled by each panel's m_InitializeDefaultPanel
  promoTitle: string
  promoText: string
  promoColor: string      // CHomeOSDInfo::GBHOME_DEFAULT_PANEL_TITLE_TEXT_COLOR @094479c0
  promoImage: string      // HomePanel/img/*, 525x302 miniature of the connected panel
  promoButton: string
}

// HOMEPANEL_BACKGROUND_MIRAGE_COLOR is float RGBA; these are the same values x255.
const f = (r: number, g: number, b: number): Rgb => [r * 255, g * 255, b * 255]

export const PANELS: Record<number, PanelDef> = {
  [SOCIAL]: {
    icon: 'social', name: 'Social', nameColor: '#d8cf05',
    bg: [f(0.00784314, 0.0745098, 0.0235294), f(0.0196078, 0.188235, 0.0627451)],
    promoTitle: STR.socialTitle, promoText: STR.socialText, promoColor: '#d8cf05',
    promoImage: 'img/not_network_social.PNG', promoButton: STR.setUp,
  },
  [ONTV]: {
    icon: 'ontv', name: 'On TV', nameColor: '#00b8e6',
    bg: [f(0.0313726, 0.0352941, 0.0901961), f(0.0784314, 0.0901961, 0.223529)],
    promoTitle: STR.ontvTitle, promoText: STR.ontvText, promoColor: '#48dbff',
    promoImage: 'img/not_network_ontv.PNG', promoButton: STR.setUp,
  },
  [MOVIES]: {
    // CHomeTopMenuWindow::m_GetMovieTvPanelName @02bc6214: g_pAppTV vfunc+0x27c is GetRegionKind
    // (CChannelSearchManagerDVBAuto::m_GetNextStateBegin's debug text); region kinds 5, 10, 11, 17, 25
    // and 30 ("..._KR_AU") take string 86 "Movies & TV Shows", every other region string 85. This EU
    // firmware's region kind is 4 (CPlugPlayController::GetPlugPlayDefaultCountryByLanguage), so the
    // panel is "Films and TV Shows" here.
    icon: 'movies', name: 'Films and TV Shows', nameColor: '#7947c2',
    bg: [f(0.0705882, 0.0392157, 0.117647), f(0.172549, 0.101961, 0.298039)],
    promoTitle: STR.moviesTitle, promoText: STR.moviesText, promoColor: '#9c62f2',
    promoImage: 'img/not_network_movies.PNG', promoButton: STR.setUp,
  },
  [APPS]: {
    icon: 'apps', name: 'Apps', nameColor: '#30b98b',
    bg: [f(0.0156863, 0.0627451, 0.0705882), f(0.0352941, 0.156863, 0.180392)],
    promoTitle: STR.appsTitle, promoText: STR.appsText, promoColor: '#4ce8b4',
    promoImage: 'img/not_network_apps.PNG', promoButton: STR.setUp,
  },
  [ALLSHARE]: {
    icon: 'photo', name: 'Photos, Videos & Music', nameColor: '#cf3967',
    bg: [f(0.0901961, 0.0235294, 0.0901961), f(0.223529, 0.054902, 0.223529)],
    promoTitle: STR.mediaTitle, promoText: STR.mediaText, promoColor: '#f6457c',
    promoImage: 'img/not_network_allshare.PNG', promoButton: STR.startNow,
  },
  [NEWS]: {
    icon: 'icon_news_on', name: 'NewsON', nameColor: '#3781db',
    bg: [f(0, 0.137255, 0.196078), f(0, 0.25098, 0.352941)],
    promoTitle: STR.newsTitle, promoText: STR.newsText, promoColor: '#3781db',
    promoImage: 'img/not_network_news_on.png', promoButton: STR.setUp,
  },
  [GAMES]: {
    icon: 'game', name: 'Games', nameColor: '#08a150',
    bg: [f(0.00784314, 0.113725, 0.0627451), f(0.00784314, 0.113725, 0.0627451)],
    promoTitle: STR.gamesTitle, promoText: STR.gamesText, promoColor: '#12a557',
    promoImage: 'img/00_h_comn_coldstart_game.png', promoButton: STR.setUp,
  },
  [MULTIMEDIA]: {
    // top name: string 0xd4 (212) "MULTIMEDIA", CHomeTopMenuWindow::OnActivateWindow case 7
    icon: 'photo', name: 'MULTIMEDIA', nameColor: '#cf3967',
    bg: [f(0.0705882, 0.0392157, 0.117647), f(0.172549, 0.101961, 0.298039)],
    promoTitle: STR.mediaTitle, promoText: STR.mediaText, promoColor: '#f6457c',
    promoImage: 'img/not_network_allshare2.PNG', promoButton: STR.startNow,
  },
}

// Top icon image per state. Games uses game_focus2 for focus and the News icons are named
// icon_news_on_{normal,focus,sel} (g_HomePanelImage 0xb7-0xb9, 0xe3-0xe5).
export function iconSrc(icon: string, state: 'normal' | 'focus' | 'selected') {
  if (icon === 'game' && state === 'focus') return `${IMG}/icon/game_focus2.png`
  if (icon === 'icon_news_on' && state === 'selected') return `${IMG}/icon/icon_news_on_sel.png`
  return `${IMG}/icon/${icon}_${state}.png`
}

// ---- panel list ----
// A fresh TV with no network has no server panel list (CHomeHubSiteGetDevicePanelListParser) and has
// not agreed to the Smart Hub terms, so CHomeInfo::GetHomePanelCompositionInfo @04688544 sets
// CHomeWindowManager::m_isDefaultPanelConfig and takes the product's default list:
// exe2 TDaSystem::GetDefaultHomePanelList @007043f8 (by country), product values mapped to panel ids
// by the table at 0x088329f0. Centre: On TV if present, else Apps.
export function defaultPanelList(country: string): number[] {
  switch (country) {
    case 'United Kingdom':
      return [GAMES, APPS, MULTIMEDIA]
    case 'Spain': case 'France': case 'Germany': case 'Italy':
      return [GAMES, APPS, ONTV, MOVIES, MULTIMEDIA]
    case 'Sweden': case 'Netherlands': case 'Switzerland': case 'Austria': case 'Belgium':
    case 'Denmark': case 'Finland': case 'Norway': case 'Ireland':
      return [SOCIAL, APPS, ONTV, MOVIES, MULTIMEDIA]
    case 'Czech': case 'Czech Republic': case 'Greece': case 'Hungary': case 'Poland': case 'Portugal':
    case 'Slovakia': case 'Luxembourg':
      return [SOCIAL, APPS, ONTV, MULTIMEDIA]
    case 'Turkey':
      return [NEWS, SOCIAL, APPS, MULTIMEDIA]
    default:
      return [SOCIAL, APPS, MULTIMEDIA]
  }
}

export function defaultCentre(list: number[]) {
  const tv = list.indexOf(ONTV)
  if (tv >= 0) return tv
  const apps = list.indexOf(APPS)
  return apps >= 0 ? apps : 0
}

// ---- carousel (CHomePanelWindowBase, CHomePanelMainWindow) ----
// Panels sit on a cylinder: a root at z = -GBHOME_ANI_PANEL_PIVOT_POINT_Z (2050), a rotation object
// (rotateY) and the 1920x1080 panel at +2050 with scale and alpha. Camera: eye (0,0,2000) looking at
// the origin, tan(half vertical fov) = 0.27, so the z=0 plane is 1:1 (CCCamera::Create @01f2ba4c).
export const PIVOT_Z = 2050
export const PERSPECTIVE = 2000

// 9-entry tables indexed by slot: 0 far-left, 1 left, 2 centre, 3 right, 4 far-right, 5 behind; the row
// is (panel count - 1). Rows used here: 2 (3 panels), 3 (4) and 4 (5 panels).
type Row = number[]
// GBHOME_ANI_PANEL_NORMAL_ROTATE @09447d78
export const NORMAL_ROTATE: Record<number, Row> = {
  2: [0, -45, 0, 45, 0, 0], 3: [0, -45, 0, 45, 75, 0], 4: [-75, -45, 0, 45, 75, 0], 5: [-75, -45, 0, 45, 75, 75],
}
// GBHOME_ANI_PANEL_NORMAL_SCALE @09447d0c (x, y) and GBHOME_ANI_PANEL_NORMAL_ALPHA @09447ce8, by slot
export const NORMAL_SCALE = [0.9, 0.9, 1, 0.9, 0.9, 0.9]
export const NORMAL_ALPHA = [0.05, 0.7, 1, 0.7, 0.05, 0.05]
// Activation (CHomePanelWindowBase::OnBeginActivateAnimation @02bc0afc): the centre panel starts at
// GBHOME_ANI_PANEL_INIT_ROTATE[row][2] = 45 deg, scale GBHOME_ANI_PANEL_INIT_SCALE 0.9, alpha 0, and
// m_animatePanel turns it by GBHOME_ANI_PANEL_ENTRANCE_ROTATE (-45) to 0 deg. Other panels start at
// GBHOME_ANI_PANEL_INTRO_INIT_ROTATE @09447ba0 with alpha 0, then OnMidActivateAnimation turns them by
// GBHOME_ANI_PANEL_INTRO_ROTATE @09447b7c (+5 / -5) and fades them to NORMAL_ALPHA.
export const INIT_ROTATE_CENTRE = 45
export const INIT_SCALE = 0.9
export const INTRO_INIT_ROTATE: Record<number, Row> = {
  2: [0, -50, 0, 50, 0, 0], 3: [-75, -50, 0, 50, 75, 0], 4: [-75, -50, 0, 50, 75, 0], 5: [-75, -50, 0, 50, 75, 180],
}
// Exit (CHomePanelWindowBase::m_animateExitPanel @02bc0300): turn by GBHOME_ANI_PANEL_EXIT_ROTATE
// (t_InitFullHDResolution), scale to 0.9, alpha to 0.
export const EXIT_ROTATE: Record<number, Row> = {
  2: [0, -15, 45, 75, 0, 0], 3: [30, -15, 45, 75, 120, 0], 4: [30, -15, 45, 75, 120, 0], 5: [30, -15, 45, 75, 120, 0],
}

// Durations (ms) and easings. CCAnimation SetAcceleration(2, 2, k) is a Hermite curve with tangents
// 3k at both ends = cubic-bezier(k, 0, 1-k, 1); (1, 1, x) is linear (CMInterpolater::Interpolation).
export const MOVE_MS = 833               // GBHOME_ANI_PANEL_MOVE_DURATION
export const MOVE_EASE = 'cubic-bezier(0.45, 0, 0.55, 1)'
export const ENTRANCE_MS = 833           // GBHOME_ANI_ENTRANCE_WINDOW_VIDEO_CHANGE_DURATION
export const MID_ACTIVATE_MS = 500       // GBHOME_ANI_INTRO_SECOND_OPACITY_DURATION
export const EXIT_TOTAL_MS = 1083        // GBHOME_ANI_EXIT_WINDOW_TOTAL_DURATION
export const EXIT_FIRST_MS = 250         // GBHOME_ANI_EXIT_WINDOW_FIRST_OPACITY_DURATION
export const EXIT_BG_MS = 500            // GBHOME_ANI_EXIT_WINDOW_BG_OPACITY_DURATION

// ---- top menu (CHomeTopMenuWindow) ----
export const TOP_ICON_GAP_X = 116        // GBHOME_TOP_ICON_GAP_X
export const TOP_TEXT_X = 448            // GBHOME_TOP_TEXT_POS_X
export const TOP_TEXT_Y = 95             // GBHOME_TOP_TEXT_POS_Y
export const TOP_TEXT_W = 560
export const TOP_TEXT_H = 41
export const TOP_TEXT_SIZE = 34
export const TOP_INIT_Y = -120           // GBHOME_ANI_TOP_INIT_POSITION y
export const TOP_ANI_MS = 250            // GBHOME_ANI_TOP_ANI_DURATION
export const TOP_ANI_LEAD = 34           // GBHOME_ANI_TOP_ANI_LEADTIME (stagger per slot)

// ---- side arrows (CHomeSideIndicatorWindow) ----
// Three copies per side; only copy 2 stays visible (GBHOME_ARROW_ALPHA 0, 0, 1).
export const ARROW_Y = 476                                  // GBHOME_ARROW_POS_Y
export const ARROW_X = { left: [4, 14, 24], right: [1814, 1804, 1794] }           // GBHOME_ARROW_POS_X
export const ARROW_INIT_X = { left: [84, 94, 104], right: [1734, 1724, 1714] }    // GBHOME_ANI_ARROW_INIT_POS_X
export const ARROW_GONE_X = { left: -102, right: 1920 }     // GBHOME_DISAPPEARED_ARROW_POS_X

// ---- online (server panel list, Smart Hub terms agreed) ----

// HomePanel images are the 1280x720 OSD's artwork; the 1920x1080 OSD draws them 1.5x (the drawing
// objects take SCImage::Width/Height of the loaded image). Evidence: GBHOME_TOP_ICON_GAP_X 116 = 1.5 x
// the 77 px icons, GBHOME_DISAPPEARED_ARROW_POS_X -102 = -1.5 x the 69 px arrow, the 788x453 box of
// the 525x302 default-panel image, and sub_boundary_line.png (6x48) measuring ~72 px tall in WpDoxOxX6s4.
export const HP_SCALE = 1.5

// With the terms agreed, CHomeInfo::GetHomePanelCompositionInfo @04688544 builds the list from the
// positions the hub server stored (CHomeHubSiteGetDevicePanelListParser -> settings 0x481 On TV, 0x482
// Apps, 0x483 Movies, 0x484 AllShare, 0x485 Social, 0x495 NewsON, 0x496 Games, 0x497 Multimedia; each
// holds position + 1, 0 = absent). On TV is kept only when CHomeInfo::IsOnTVPanelAvailable @046878dc
// (panel on, the On TV service provider chosen in Smart Hub setup, terms agreed). The server's UK list
// is not in the firmware, so this is the fullest list a UK set supports and shows (inferred): the UK
// footage (EhQ9pDtWV4M) shows Social, Apps, Films and TV Shows, Photos Videos & Music in that order;
// On TV sits between Apps and Films as in the EU product lists and the CES footage (WpDoxOxX6s4); the
// UK product list (TDaSystem::GetDefaultHomePanelList) adds Games, which every product list puts
// directly before Apps. NewsON (Turkey) and the old AllShare panel are not UK panels.
export const ONLINE_PANELS = [SOCIAL, GAMES, APPS, ONTV, MOVIES, MULTIMEDIA]

// Start panel: the stored start panel (setting 0x486, none on this TV), else On TV, else Apps
// (GetHomePanelCompositionInfo), i.e. defaultCentre().

// ---- sub menu (CHomeSubMenuWindow) ----
// GBHOME_SUBMENU_NUM @09448220 = 4 3 5 1 5 1 2 5 per panel id; titles from m_GetSubMenuTitle @02bcdbd4
// (g_HomePanelWStringEng). Items the TV lacks are dropped (m_InitializeSubMenu @02bce51c): Recorded TV
// (On TV 2, Photos 4) without PVR (CHomeInfo::IsAvailablePVR: factory option 75; the F6400 records to
// USB, so it stays), Guide without an EPG (IsAvailableGuide), Purchased while the server has not enabled
// it (setting 0x488; kept, inferred).
export const SUBMENU: Record<number, string[]> = {
  [SOCIAL]: ["Friends' Picks", "What's Hot", 'Friends', 'Video Call'],   // 32, 33, 38, 39
  [ONTV]: ['Guide', 'Timeline View', 'Recorded TV'],                    // 77, 80, 81
  [MOVIES]: ['Favourites', 'Featured', 'Movies', 'TV Shows', 'Purchased'], // 88, 87, 89, 90, 91
  [APPS]: ['More Apps'],                                                // 56
  [ALLSHARE]: ['All Content', 'Photos', 'Videos', 'Music', 'Recorded TV'], // 100, 97, 98, 99, 81
  [NEWS]: ['More News'],                                                // 30
  [GAMES]: ['My Page', 'All Games'],                                    // 204, 205
  [MULTIMEDIA]: ['All Content', 'Photos', 'Videos', 'Music', 'Recorded TV'],
}

// Focus box image per panel (m_InitializeSubMenu: g_HomePanelImage 0x1c-0x20, 0xbb, 0xed = HomePanel/
// sub category/*/<name>, copied to public/f13/smarthub/sub), drawn as a
// 9-part composite (GBHOME_SUBMENU_FOCUS_IMAGE_W1..H3 = 24 24 12 6 24 110 in 1.5x image px).
export const SUBMENU_FOCUS_IMG: Record<number, string> = {
  [SOCIAL]: 'sub/so_sub.png',
  [ONTV]: 'sub/sg_sub.png',
  [MOVIES]: 'sub/ct_sub.png',
  [APPS]: 'sub/apps_sub.png',
  [ALLSHARE]: 'sub/mc_sub.png',
  [NEWS]: 'sub/info_sub.png',
  [GAMES]: 'sub/game_sub.png',
  [MULTIMEDIA]: 'sub/mc_sub.png',
}

// CHomeOSDInfo (t_InitFullHDResolution / t_InitCommonResolution): buttons GBHOME_SUBMENU_BUTTON_WIDTH[n]
// x GBHOME_SUBMENU_BUTTON_HEIGHT at GBHOME_SUBMENU_BUTTON_POS_X[n*7+i], GBHOME_SUBMENU_BUTTON_POS_Y; the
// boundary lines (sub_boundary_line.png) at GBHOME_SUBMENU_BOUNDARY_POS_X[n*7+i], ..._POS_Y.
export const SUB_W: Record<number, number> = { 1: 548, 2: 548, 3: 528, 4: 428, 5: 368, 6: 304 }
export const SUB_H = 120
export const SUB_Y = 972
export const SUB_X: Record<number, number[]> = {
  1: [686], 2: [352, 1020], 3: [88, 696, 1304], 4: [53, 511, 969, 1427], 5: [8, 392, 776, 1160, 1544],
  6: [13, 331, 649, 967, 1285, 1603],
}
export const SUB_LINE_X: Record<number, number[]> = {
  2: [956], 3: [652, 1260], 4: [492, 950, 1408], 5: [380, 764, 1148, 1532], 6: [32, 638, 956, 1274, 1592],
}
export const SUB_LINE_Y = 996
export const SUB_TEXT_GAP = 24            // GBHOME_SUBMENU_BUTTON_TEXT_SIDE_GAP
export const SUB_FONT = 42                // GBHOME_SUBMENU_FONT_SIZE
export const SUB_MOVE_Y = 108             // GBHOME_SUBMENU_Y_MOVE_DISTANCE (hidden = 108 px lower)
export const SUB_SHOW_MS = 250            // GBHOME_ANI_SUBMENU_SHOW_DURATION
export const SUB_STAGGER_MS = 34          // GBHOME_ANI_SUBMENU_PRECEDENCE_TIME
export const SUB_MOVE_LEAD_MS = 417       // GBHOME_ANI_SUBMENU_MOVE_SHOW_LEADTIME
export const GRID_MS = 250                // GBHOME_COMMON_GRID_ANIMATION_DURATION

// Clock text in the firmware's EU formats (CCountryUtil::GetDateTimeStr @018c6f50, target location
// 3/4: format 2 = "%h:%N").
export function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
