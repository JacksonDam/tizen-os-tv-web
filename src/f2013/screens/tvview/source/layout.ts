// Source app layout. Values are SourceOSDInfo statics from SourceOSDInfo::t_InitResolution (0x0298da60)
// evaluated with w=1920, base 960 (emulated; SourceOSDInfo::Initialize passes D_OSD_RESOLUTION, 0x3c0),
// i.e. stage pixels; AppMWOSDInfo values likewise (t_InitResolution 0x0197087c with 2/1). Bitmaps are
// 1280-OSD images drawn x1.5.

type RGB = [number, number, number]

export const L = {
  // CSourceMainWndBase::Create: CDefaultWindow(SOURCE_WND_X, SOURCE_WND_Y, SOURCE_WND_EXTENDED_W, SOURCE_WND_H)
  WND_X: 0,
  WND_Y: 0,
  WND_W: 1920,
  WND_H: 396,
  WND_OPACITY: 242,          // SOURCE_WND_OPACITY (inferred: the window's motion alpha)
  // t_SetWindowBGImageInfo: SourceBrowser/source_list_bg.bmp; 9-slice rows from SOURCE_WND_BG_RECT_TOP_H
  // 208 / BOTTOM_H 68 (in bitmap px 139 / 45; the middle 4 px row stretches)
  BG_SLICE_T: 139,
  BG_SLICE_B: 45,
  // t_SetTitle: "Source" (string 0x4a) at SOURCE_WND_TITLE_X/Y, size 50, white, left/middle
  TITLE_X: 120,
  TITLE_Y: 12,
  TITLE_W: 1792,
  TITLE_H: 60,
  TITLE_FONT: 50,
  // t_CreateHelpLine: SourceBrowser/SourceListHelpLine.bmp at SOURCE_WND_HELP_LINE_X/Y
  HELP_LINE_X: 0,
  HELP_LINE_Y: 368,
  // t_CreateToolsURSButton: Tools button (option_tool_nor/_dim/_sel) at SOURCE_WND_TOOLS_BUTTON_X/Y/W/H;
  // t_CreateToolsURSButtonHighLight: option_tool_hi at the same place while focused
  TOOLS_X: 1768,
  TOOLS_Y: 0,
  TOOLS_W: 84,
  TOOLS_H: 84,
  // t_ShowDescriptionToolsBalloon: CWordBalloon (top arrow) at TOOLS_X + W/2, SOURCE_WND_TOOLS_BALLOON_ARROW_Y,
  // kept left of SOURCE_WND_TOOLS_BALLOON_MAXIMUM; text AppMWOSDInfo::UPDOWN_ARROW_TEXT_FONT_SIZE, black,
  // ARROW_TEXT_OFFSET padding
  BALLOON_ARROW_Y: 74,
  BALLOON_MAX_X: 1910,
  BALLOON_FONT: 32,
  BALLOON_TEXT_OFFSET: 18,
  // t_CreateList: CSingleLineListWidget(SOURCE_WND_W x SOURCE_WND_LIST_H, horizontal, item width
  // SOURCE_WND_LIST_W) with margins top 80 / left 60 / right 60; item height SOURCE_WND_ITEM_H
  LIST_MARGIN_TOP: 80,
  LIST_MARGIN_LEFT: 60,
  LIST_MARGIN_RIGHT: 60,
  ITEM_W: 300,
  ITEM_H: 336,
  VISIBLE: 6,                // (1920 - 60 - 60) / 300
  SCROLL_MS: 200,            // (inferred) list scroll animation
  // focus: SourceBrowser/list_highlight.bmp 9-slice (SOURCE_FOCUS_MARGIN 46 -> 30 bitmap px), rect
  // SOURCE_WND_LIST_FOCUS_W/H 270 x 172. Placement (inferred): centred on the item's icon; the
  // firmware's SOURCE_WND_LIST_FOCUS_X/Y (0, -40) are relative to an origin we could not pin down.
  FOCUS_W: 270,
  FOCUS_H: 172,
  FOCUS_DX: 15,
  FOCUS_DY: 4,
  FOCUS_SLICE: 30,
  // scroll arrows (SetScrollLeftRightArrowProperty): indi_arrow_left/right at SOURCE_PAGE_LEFT_INDICATOR_X,
  // SOURCE_PAGE_RIGHT_INDICATOR_X, SOURCE_PAGE_LEFT_RIGHT_INDICATOR_Y
  ARROW_LEFT_X: 8,
  ARROW_RIGHT_X: 1852,
  ARROW_Y: 174,
  // CSourceListDataRenderer (item-relative): icon box SOURCE_WND_ITEM_ICON_X/Y/W/H 90,30,120,120 with
  // centre alignment; the 92 px icon bitmaps are larger than the box
  ICON_X: 90,
  ICON_Y: 30,
  ICON_W: 120,
  ICON_H: 120,
  ICON_IMG: 92,
  // check mark (list_check_icon) SOURCE_WND_ITEM_CHECK_LAST_ITEM_ICON_X/Y/W/H
  CHECK_X: 34,
  CHECK_Y: 40,
  CHECK_W: 48,
  CHECK_H: 48,
  // source type: SOURCE_WND_ITEM_TYPE_X/Y/W/H, size SOURCE_WND_ITEM_SOURCE_TYPE_SIZE, centre/middle
  TYPE_X: 40,
  TYPE_Y: 160,
  TYPE_W: 220,
  TYPE_H: 52,
  TYPE_FONT: 28,
  // device name: SOURCE_WND_ITEM_NAME_X/Y/W/H, size SOURCE_WND_ITEM_DEVICE_NAME_FONT_SIZE
  NAME_X: 40,
  NAME_Y: 190,
  NAME_W: 220,
  NAME_H: 52,
  NAME_FONT: 28,
  // text colours (SourceOSDInfo SOURCE_WND_ITEM_*_TEXT_COLOR_R/G/B)
  COLOR_NORMAL: [255, 255, 255] as RGB,
  COLOR_FOCUS: [255, 186, 25] as RGB,
  COLOR_DIM: [91, 101, 107] as RGB,
  COLOR_CURRENT: [186, 255, 0] as RGB,   // NORMAL_CURRENT_INPUT_SOURE_TEXT_COLOR
  // timings
  TIMEOUT_MS: 5000,          // CSourceMainWndBase::Show SetAlarmTimeOut
  CONNECT_ALARM_MS: 2000,    // CSourceMainWndBase::Create PCAlarm(2000)
  ANI_SHOW_MS: 500,          // CSourceMainWndAnimation::t_InitializeAnimationTime +0x3300
  ANI_HIDE_MS: 500,          // +0x3304
  ANI_Y: 200,                // +0x330c (animation type 6: y offset; direction inferred: from above)

  // CPopUpWidget (common): POPUPWIDGET_WIDTH 488, heights per item count, item 72, margins 34,
  // text x 96 / y 12 / h 60 at COMMON_FONT_SIZE_18 (36); shadow AppCM/act_popup_shadow (DEFAULTWND_SHADOW_BG
  // 32), body AppCM/sub_popup_bg over SUB_POPUP_BG_ALPHA_COLOR 0xff222d3b; focus Common/list_highlight
  // 480 x 128; text TEXT_NORMAL_COLOR white / TEXT_FOCUS_COLOR 0xfffdd911. Placed at
  // SOURCE_TOOLS_SUBLIST_X/Y.
  POP_X: 1372,
  POP_Y: 84,
  POP_W: 488,
  POP_H: [0, 192, 244, 316, 388, 460, 532, 604],
  POP_ITEM_H: 72,
  POP_MARGIN: 34,
  POP_SHADOW: 32,
  POP_TEXT_X: 96,
  POP_TEXT_Y: 12,
  POP_TEXT_H: 60,
  POP_TEXT_W: 330,
  POP_FONT: 36,
  POP_FOCUS_W: 480,
  POP_FOCUS_H: 128,
  POP_BG: 0xff222d3b,
  POP_TEXT_FOCUS: 0xfffdd911,

  // message box (CSourceWidgetAgency::t_CreateMessageBox): SOURCE_MSG_BOX_X/Y/W/H, font 36 white,
  // no buttons (MESSAGEBOX_NOBUTTON_1LINE_BG_H 224), auto hide after 5000 ms (CMessageBox::StartTimer)
  MSG_X: 552,
  MSG_Y: 428,
  MSG_W: 816,
  MSG_H: 224,
  MSG_FONT: 36,
  MSG_ROW_GAP: 14,
  MSG_TIMEOUT_MS: 5000,
}

export const TOOLS_BALLOON_TEXT = 'Tools'   // g_SourceListWStringEng 0x3f
