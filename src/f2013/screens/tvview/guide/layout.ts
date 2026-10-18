// Layout and colours of the 2013 Guide (exeDSP CEpgFullMain / CEpgFullInfoArea / CEpgFullRendererBase).
// Values are EpgOsdInfo statics from EpgOsdInfo::t_InitResolution(bool, int, int) @ 027d86c8, evaluated
// for a 1920 stage (EpgOsdInfo::Initialize passes (2, 1) for a 1920 OSD; the 1280 OSD of this model
// uses (4, 3), i.e. the same layout at 2/3 scale), so they are stage pixels as they stand. Colours are
// ARGB. See samsung-tv-qemu/extract/f13/spec/tvview-guide.md.

export const L = {
  // window
  WIN_W: 1920, WIN_H: 1080,

  // info area (CEpgFullInfoArea::Create @ 027b6a54)
  TITLE_X: 30, TITLE_Y: 38, TITLE_W: 1300, TITLE_H: 80, TITLE_SIZE: 64,           // "Guide"
  CUR_TIME_X: 1400, CUR_TIME_Y: 46, CUR_TIME_W: 430, CUR_TIME_H: 40, CUR_TIME_SIZE: 36, // EPG_MESSAGE_TEXT_SIZE
  PIG_X: 60, PIG_Y: 120, PIG_W: 520, PIG_H: 294,                                 // FULL_PIG_SIZE_*
  PIG_TITLE_BG_Y: 246,                                                           // FULL_PIG_TITLE_BG_Y
  PIG_NAME_X: 66, PIG_NAME_Y: 360, PIG_NAME_W: 504, PIG_NAME_SIZE: 32,           // FULL_PIG_CHANNEL_NAME_*, EPG_INFO_PIG_TEXT_SIZE
  SEP_X: 644, SEP_H: 260,                                                        // FULL_INFO_AREA_SEPARATOR_* (w = GRID_LINE_H / 2)
  PROG_TITLE_X: 664, PROG_TITLE_Y: 110, PROG_TITLE_W: 1140, TEXT_H: 64, PROG_TITLE_SIZE: 52, // EPG_TITLE_FONT_SIZE
  CH_NAME_X: 664, CH_NAME_Y: 164, CH_NAME_W: 672,                                // FULL_INFO_CHANNNEL_NAME_*
  TIME_X: 664, TIME_Y: 212, TIME_W: 400, INFO_SIZE: 35,                          // FULL_INFO_PROGRAM_TIME_*, EPG_INFO_TEXT_FONT_SIZE
  GENRE_W: 380, GENRE_SIZE: 36,                                                  // FULL_INFO_PROGRAM_GENRE_W, _TEXT_SIZE
  SEP_GAP: 12, ICON_OFFSET_X: 6,                                                 // FULL_INFO_SEPARATOR_GAP, FULL_INFO_ICON_OFFSET_X
  PROGRESS_Y: 238, PROGRESS_W: 216, PROGRESS_H: 28, PROGRESS_BLANK: 6,           // FULL_INFO_PROGRESS_BAR_Y, FULL_INFO_PROGRESS_*
  ETT_X: 664, ETT_Y: 260, ETT_W: 1140, ETT_H: 112, ETT_SIZE: 30, ETT_ROWGAP: 6, ETT_ROWS: 3,

  // day / time labels above the time bar (CEpgFullMain::t_CreateDayTimeArea @ 02798064)
  DAY_ARROW_X: 650, DAY_ARROW_Y: 404, DAY_GAP: 596,
  DAY_TEXT_X: 668, DAY_TEXT_Y: 396, DAY_TEXT_W: 300, DAY_TEXT_H: 32, DAY_TEXT_SIZE: 30, // EPG_INFO_TEXT_CURRENT_TIME_FONT_SIZE

  // time bar (t_CreateFullInfoArea @ 027a1648, t_SetTimeBarBackground @ 027978f4)
  BAR_Y: 438, BAR_H: 48, BAR_TEXT_SIZE: 30,
  BAR_START_X1: 680, BAR_START_W: 296, BAR_STEP: 298,                            // FULL_TIME_BAR_START_X1/_W, GAP_IMAGE_WIDTH
  BAR_CATEGORY_W: 646,                                                           // FULL_TIME_BAR_CATEGORY_TEXT_W
  ARROW_Y: 430, ARROW_W: 44, ARROW_LEFT_X: 646, ARROW_RIGHT_X: 1794,              // FULL_TIME_BAR_PROGRAM_INDICATE_*

  // list (t_CreateFullEpgList @ 027a2df0; CEpgFullRendererBase)
  LIST_Y: 470, LIST_MARGIN_Y: 18, ITEM_H: 74, MAX_VISIBLE: 7, GRID_LINE: 2,
  CH_INFO_W: 646,                                                                // FULL_TIME_BAR_VIEW_W
  CH_NUM_X: 92, CH_NUM_W: 132, FAV_X: 200, CH_NAME_LIST_X: 240, CH_NAME_LIST_W: 378, CH_FONT: 32,
  SELECT_X: 648, SELECT_W: 1274, PAGE_TIME_W: 1194,                              // FULL_LIST_ITEM_SELECT_*, _PAGE_TIME_W
  PROG_MIN_W: 6, PROG_BLANK_W: 10, PROG_LEFT_MARGIN: 28, PROG_RIGHT_MARGIN: 8, PROG_ABBR_W: 24,
  SHADOW_W: 28,                                                                  // FULL_LIST_LEFT_TIME_LINE_SHADOW_W
  FOCUS_OFFSET_X: -19, FOCUS_OFFSET_Y: -2, FOCUS_Y: -3, FOCUS_MARGIN: 36, FOCUS_H: 126, FOCUS_LINE_MIN_W: 2,
  IMAGE_MARGIN: 20,                                                              // EPG_IMAGE_MARGIN at the 1280 OSD (bitmap px)
  UP_ARROW_X: 2, UP_ARROW_Y: 32, DOWN_ARROW_Y: 474,                              // FULL_LIST_UP/DOWN_ARROW_*
  GRAD_Y: 434, GRAD_W: 74, GRAD_H: 646, GRAD_RIGHT_X: 1870,                      // FULL_LIST_LEFT/RIGHT_GRIDENT_*

  // help bar (t_CreateHelpBar @ 0279accc, CKeyHelpBar::OrderingMarker @ 018eecf8)
  HELP_Y: 1010, HELP_H: 70, HELP_TEXT_SIZE: 30,
  HELP_END_MARGIN: 54, HELP_TXTIMG_MARGIN: 64, HELP_IMGTXT_MARGIN: 20, HELP_MIN_SPAN: 20, // AppMWOSDInfo::HELP_*

  // time
  PAGE_TIME: 7200, SCROLL_TIME: 3600,                                            // FULL_PAGE_TIME, FULL_SCROLL_TIME (s)
} as const

export const C = {
  TITLE: 0xffffffff,            // FULL_LIST_TITLE_COLOR
  CUR_TIME: 0xffbdbdbd,         // FULL_INFO_CURRENT_TIME_COLOR
  PIG_TITLE_BG: 0x7f000000,     // EPG_PIG_TITLE_BG_COLOR
  PIG_NAME: 0xffd5d5d5,         // EPG_DEFAULT_TEXT_COLOR
  SEPARATOR: 0x26ffffff,        // FULL_INFO_AREA_SEPARATOR_COLOR
  PROG_TITLE: 0xff4cb5f1,       // FULL_INFO_PROGRAM_TITLE_COLOR
  CH_NAME: 0xffaeadad,          // FULL_INFO_CHANNNEL_NAME_COLOR
  TIME: 0xffaeadad,             // FULL_INFO_PROGRAM_TIME_COLOR
  GENRE: 0xffaeadad,            // FULL_INFO_GENRE_COLOR
  ETT: 0xff828181,              // FULL_INFO_PROGRAM_INFO_TEXT_COLOR
  DAY_TEXT: 0xff698b22,         // FULLE_LIST_DAY_TEXT_FONT_COLOR
  BAR_TEXT: 0xff6a6a6a,         // FULL_TIME_BAR_TEXT_COLOR
  LIST_BG: 0xff000000,          // FULL_MAIN_LIST_BG_COLOR
  CH_NUM: 0xffc6d4e1,           // FULL_LIST_CHANNEL_NUMBER_COLOR
  CH_NAME_LIST: 0xff4cb5f1,     // FULL_LIST_CHANNEL_NAME_COLOR
  FOCUSED: 0xffffcc00,          // FULL_LIST_FOCUSED_TEXT_COLOR / FULL_LIST_FOCUS_CHNAME_COLOR
  PROG: 0xffffffff,             // FULL_LIST_NORMAL_TEXT_COLOR
  HELP_TEXT: 0xffffffff,        // FULL_LIST_NORMAL_TEXT_COLOR (CKeyHelpBar::SetTextColor)
} as const
