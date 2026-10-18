// Channel List layout statics (CChannelListOSDInfo, exeDSP). CChannelListOSDInfo::Initialize
// (0x029c7bf4) calls t_InitResolution(0, D_OSD_RESOLUTION, 0x780): the values are written for a 1920
// base and scaled to the 1280 OSD at run time, so evaluating t_InitResolution (0x029c7c3c) with
// (0, 1920, 1920) in the emulator gives them directly in 1920 stage pixels (spec/tvview-chlist.md).
// Bitmaps are 1280-OSD assets drawn at x1.5.

export const L = {
  // CChannelListWindow::Create / m_CreateAndShowBG / m_CreateAndShowTitle
  MAIN_WINDOW_X: 1172,
  MAIN_WINDOW_W: 748,
  WINDOW_BG_X: 10,
  TITLE_X: 10,
  TITLE_H: 86,
  TITLE_MAIN_X: 204,
  TITLE_MAIN_W: 350,
  TITLE_MAIN_FONT_SIZE: 54,
  TITLE_SIDE_LEFT_X: 10,
  TITLE_SIDE_RIGHT_X: 556,
  TITLE_SIDE_W: 188,
  TITLE_ARROW_LEFT_X: 10,
  TITLE_ARROW_RIGHT_X: 154,
  TITLE_ARROW_Y: 25,
  TITLE_TEXT_LEFT_X: 38,
  TITLE_TEXT_RIGHT_X: 0,
  TITLE_TEXT_W: 150,
  TITLE_SUB_FONT_SIZE: 32,
  // CChannelListWindow::m_CreateList (CSingleLineListWidget)
  MAIN_LIST_X: 0,
  MAIN_LIST_Y: 88,
  MAIN_LIST_H: 992,
  MAIN_LIST_MARGIN_TOP: 52,
  MAIN_LIST_MARGIN_BOTTOM: 40,
  MAIN_LIST_MARGIN_LEFT: 25,
  MAIN_LIST_ARROW_X: 355,
  MAIN_LIST_ARROW_UP_Y: 21,
  MAIN_LIST_ARROW_DOWN_Y: 939,
  MAIN_LIST_ITEM_W: 708,
  MAIN_LIST_ITEM_H_TEXT: 90,
  MAIN_LIST_FOCUS_COMPOSITE_W: 764,
  MAIN_LIST_FOCUS_COMPOSITE_H_TEXT: 144,
  // CChannelListTextViewRenderer::ConstructDrawings / m_Draw*
  ITEM_TEXT_CHANNEL_NUMBER_X: 15,
  ITEM_TEXT_CHANNEL_NUMBER_Y: 30,
  ITEM_TEXT_CHANNEL_NUMBER_GAP: 18,
  ITEM_TEXT_CHANNEL_BAR_X: 167,
  ITEM_TEXT_CHANNEL_BAR_Y: 18,
  ITEM_TEXT_CHANNEL_BAR_W: 2,
  ITEM_TEXT_CHANNEL_BAR_H: 54,
  ITEM_TEXT_CHANNEL_NAME_X: 177,
  ITEM_TEXT_CHANNEL_NAME_Y: 10,
  ITEM_TEXT_CHANNEL_NAME_W: 220,
  ITEM_TEXT_DRAWING_BOX_H_WIDE: 70,
  ITEM_TEXT_DRAWING_BOX_H_SMALL: 41,
  ITEM_TEXT_ICON_X: 175,
  ITEM_TEXT_ICON_Y: 51,
  ITEM_ICON_GAP: 24,
  ITEM_TEXT_PROGRAM_NAME_X: 410,
  ITEM_TEXT_PROGRAM_NAME_Y: 4,
  ITEM_TEXT_PROGRAM_NAME_W: 275,
  ITEM_TEXT_PROGRAM_NAME_H_WIDE: 82,
  ITEM_TEXT_PROGRAM_NAME_H_SMALL: 53,
  ITEM_TEXT_PROGRESS_X: 410,
  ITEM_TEXT_PROGRESS_Y: 59,
  ITEM_TEXT_PROGRESS_W: 275,
  ITEM_TEXT_PROGRESS_H: 16,
  ITEM_PROGRAM_NAME_FONT_SIZE: 36, // used for both the channel and the programme name
  ITEM_CHANNEL_NAME_FONT_SIZE: 30, // the empty-list text (CChannelListEmptyRenderer)
  // CChannelListEdgeWindow (Sorting / Mode)
  EDGE_WINDOW_LEFT_X: 1182,
  EDGE_WINDOW_RIGHT_X: 1428,
  EDGE_WINDOW_W: 492,
  EDGE_PIVOT_LEFT_X: 1182,
  EDGE_PIVOT_RIGHT_X: 1920,
  EDGE_TITLE_X: 30,
  EDGE_TITLE_W: 432,
  EDGE_TITLE_H: 86,
  EDGE_TITLE_FONT_SIZE: 48,
  EDGE_LIST_MARGIN_TOP: 144,
  EDGE_LIST_MARGIN_BOTTOM: 56,
  EDGE_LIST_MARGIN_LEFT: 15,
  EDGE_LIST_ARROW_X: 214,
  EDGE_LIST_ARROW_UP_Y: 112,
  EDGE_LIST_ARROW_DOWN_Y: 1024,
  EDGE_LIST_FOCUS_W: 518,
  EDGE_LIST_FOCUS_H: 128,
  EDGE_ITEM_W: 462,
  EDGE_ITEM_H: 80,
  EDGE_ITEM_CHECK_X: 10,
  EDGE_ITEM_CHECK_Y: 21,
  EDGE_ITEM_NAME_X: 50,
  EDGE_ITEM_NAME_W: 398,
  EDGE_ITEM_NAME_FONT_SIZE: 38,
  EDGE_ITEM_VALUE_X: 249,
  POPUP_FONT_SIZE: 32, // the edge item's value text
  ITEM_CHANNEL_GAP: 8,
  EDGE_ITEM_LINE_X: 6,
  EDGE_ITEM_LINE_Y: 68,
  EDGE_ITEM_LINE_W: 449,
  EDGE_ITEM_LINE_H: 2,
} as const

// Colours and alphas (CChannelListOSDInfo, 0xAARRGGBB).
export const C = {
  WHITE: 0xffffffff,
  YELLOW: 0xffffcc00, // CHLIST_FONT_COLOR_YELLOW (-13312)
  LIME: 0xff7dff00,
  SKY_BLUE: 0xff4cb5f1,
  BLUE: 0xff4cdfff,
  MEDIUM_GREY: 0xffaeaeae,
  ITEM_CHANNEL_BAR: 0x4dffffff,
  EDGE_BOUNDARYLINE: 0xff2c2c2c,
}
export const WINDOW_BG_ALPHA = 205 / 255
export const EDGE_WINDOW_BG_ALPHA = 230 / 255
export const DISABLE_ALPHA = 102 / 255

// Timings (ms). CChannelListWindow::m_AnimationShow/Hide: the window slides in from 0xc0 OSD px
// (x1.5 on the stage) to the right while fading in over 500 ms, and back out over 350 ms (0x15e).
// CChannelListEdgeWindow::m_AnimationShow/Hide: the edge window swings +-90 degrees about its
// outer edge while fading, 350 ms. Window/edge time-out: 60000 ms (PCAlarm in Create).
export const SHOW_MS = 500
export const HIDE_MS = 350
export const SLIDE_PX = 0xc0 * 1.5
export const EDGE_MS = 350
export const TIMEOUT_MS = 60000
