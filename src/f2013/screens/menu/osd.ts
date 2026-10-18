// MenuOSDInfo values for the 1280x720 OSD (AppConfig::D_OSD_RESOLUTION = 0x500), read by emulating
// MenuOSDInfo::t_InitResolution(false, 4, 3) (base values are 960x540 * 4/3). The Menu draws in this
// space; the exhibit scales the whole OSD layer by 1.5 onto the 1920x1080 stage.

export const OSD = {
  // scene: CCScene::Create(SETTING_SCENE_X=-530, Y=-264, 1060x528), centre-relative -> (110, 96)
  SCENE_X: 110, SCENE_Y: 96, SCENE_W: 1060, SCENE_H: 528,
  // back panel (CMenuMainWindow::t_SetBackgroundImage)
  BACK_IMG_X: 40, BACK_IMG_Y: 1, BACK_IMG_W: 980, BACK_IMG_H: 526, BACK_IMG_GAP: 10, MENU_3_UNIT: 4,
  // category list (t_CreateCategory, CMenuCategoryRenderer)
  CAT_W: 380, CAT_H: 528, CAT_MARGIN_TOP: 40, CAT_COUNT: 7,
  CAT_HL_X: 53, CAT_ICON_X: 53, CAT_ICON: 80, CAT_TEXT_X: 133, CAT_TEXT_W: 248, CAT_FONT: 26,
  // menu list panels (t_CreateMenuList, t_GetMenuListDestinationX)
  PANEL_W: 592, PANEL_H: 528, PANEL_START_X: 122, PANEL_STOP_X: 378, PANEL_OVERLAP_X: 402,
  PANEL_GAP: 10, PANEL_TOPMOST_GAP: 16,
  TITLE_X: 34, TITLE_Y: 21, TITLE_W: 493, TITLE_H: 66, TITLE_FONT: 29, TITLE_COLOR: '#baf1ff',
  LIST_Y: 77, LIST_H: 426, LIST_MARGIN_TOP: 26, ITEM_H: 53, ITEM_W: 592, VISIBLE: 7,
  ITEM_FONT: 24, TEXT_TITLE_X: 34, TEXT_TITLE_W: 293, TEXT_TITLE_ONLY_W: 522,
  TEXT_RIGHT_X: 369, TEXT_RIGHT_W: 189, DOT_X: 16, DOT_OFFSET: 18, DOT: 5,
  SLIDER_X: 330, SLIDER_W: 152, SLIDER_SHORT_W: 128, SLIDER_H: 8, TINT_LEFT_X: 224, TINT_TEXT_W: 80,
  PRESSED_W: 562,
  // help window (t_CreateHelpWindow, CHelpWindow::t_Create, CHelpWindow::t_SetHelpContent)
  HELP_X: 712, HELP_Y: 16, HELP_W: 293, HELP_H: 506, HELP_MARGIN: 21, HELP_TOP_GAP: 26, HELP_FONT: 22,
  HELP_ROW_GAP: 5, HELP_TEXT_SUB_GAP: 13, HELP_SUB_MARGIN_H: 5, HELP_SUB_H: 32, HELP_SUB_TEXT_X: 34,
  HELP_SUB_W: 229, HELP_SUB_BELT_X: 21, HELP_SUB_FONT: 20, HELP_SUB_BOTTOM_GAP: 16,
  HELP_IMAGE_H: 208, HELP_IMAGE_TEXT_GAP: 4,
  // timings (ms) and animation values
  MAIN_BG_ALPHA_MS: 200, BLUE_START_ALPHA_MS: 200, BLUE_START_POS_MS: 256, BLUE_ALPHA_POS_GAP_MS: 200,
  BLUE_NORMAL_POS_MS: 256, CAT_TEXT_ALPHA_MS: 256, ICON_PROLOGUE_MS: 300,
  ICON_FPS_INTRO: 18, ICON_FPS_LOOP: 25, ICON_FPS_END: 10,
  HIDE_TIMEOUT_MS: 60000,
  // colours (MenuOSDInfo)
  WHITE: '#ffffff', WHITE_DIM: 'rgba(255,255,255,0.4)', YELLOW: '#fdd910', YELLOW_DIM: 'rgba(253,217,16,0.4)',
  SEMI_WHITE: 'rgba(255,255,255,0.498)', HELP_SUB_COLOR: '#86b7e3',
  ALPHA_THIRTY: 76 / 255,
} as const

// CAppUtil::GetOSDTransparency: Menu Transparency High/Medium/Low -> black panel alpha
export const TRANSPARENCY_ALPHA = [0x73, 0x99, 0xe6].map(a => a / 255)

// Destination x of menu list panel `level` (t_GetMenuListDestinationX(level, topmost))
export function panelX(level: number, topmost: boolean) {
  if (level === 0) return OSD.PANEL_START_X
  return OSD.PANEL_START_X + OSD.PANEL_GAP * level + (topmost ? OSD.PANEL_TOPMOST_GAP - OSD.PANEL_GAP : 0)
}

// Panel width at `level` (t_CreateMenuList)
export function panelW(level: number) {
  return OSD.PANEL_W - OSD.PANEL_GAP * level - (level > 0 ? OSD.PANEL_TOPMOST_GAP - OSD.PANEL_GAP : 0)
}

// CMenuTitleRenderer::t_GetDepthOffset: right-side drawings move left in narrower (deeper) panels
export function depthOffset(level: number) {
  return -(OSD.PANEL_GAP * level + (level > 0 ? OSD.PANEL_TOPMOST_GAP - OSD.PANEL_GAP : 0))
}
