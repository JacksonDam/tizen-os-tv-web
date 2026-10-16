// Game Bar (com.samsung.tv.gamebar 5.0.0) data for this TV: the control and info items the EU retail
// featureconf selects (game_bar.support_control_item = GG#VA#SR#PZ#MS#MP#SO#HG, support_info_item =
// IL#RES#FPS#HDR#VRR) from shared/res/UI_Json/ItemDefine.json, with en-US text from
// GamebarTextResources (spec3/extras.md section 3).

export type ControlId = 'GG' | 'VA' | 'SR' | 'PZ' | 'MS' | 'MP' | 'SO' | 'HG'

export type Control = {
  id: ControlId
  name: string
  icon: string               // frame sequence (Menu_Sequences_Webp/<icon>), built into a sprite sheet
  options?: string[]         // list option (ViewUtil.IsNeedListOption)
  initial?: string           // value before the user changes it (inferred defaults)
}

export const CONTROLS: Control[] = [
  {
    id: 'GG', name: 'Game Genre', icon: 'game_picture',
    // ECO is removed (game_bar.eco_mode_support false); AUTO kept (game_genre_auto_detection_support true)
    options: ['Auto', 'Standard', 'RPG', 'RTS', 'FPS', 'Sports', 'Original', 'Custom 1', 'Custom 2'],
    initial: 'Auto',
  },
  {
    id: 'VA', name: 'Virtual Aim Point', icon: 'virtual_aim',
    options: ['Off', 'Red 1', 'Red 2', 'Red 3', 'Green 1', 'Green 2', 'Green 3', 'Edit Position'],
    initial: 'Off',
  },
  {
    id: 'SR', name: 'Screen Ratio', icon: 'screen_ratio',
    options: ['16:9', '21:9', '32:9'], // game_bar.screen_ratio_config 169#219#329, non-monitor options
    initial: '16:9',
  },
  {
    id: 'PZ', name: 'Minimap Zoom', icon: 'patial_zoom',
    options: ['Off', 'Left', 'Right', 'Top', 'Bottom'], // partial_zoom_config 169#ORLTB -> R L T B + Off
    initial: 'Off',
  },
  { id: 'MS', name: 'More settings', icon: 'settings' },
  {
    id: 'MP', name: 'Game Motion Plus', icon: 'game_motion_plus',
    options: ['Off', 'Level 1', 'Level 2'],
    initial: 'Off',
  },
  { id: 'SO', name: 'Sound Output', icon: 'sound_output' },
  { id: 'HG', name: 'Help Guide', icon: 'guide' },
]

// Minimap Zoom on a 16:9 panel (Model169UnsupportedRatio): Left/Right need the 16:9 ratio, Top/Bottom a
// wide ratio. Returns the option indexes the list shows disabled.
export function minimapDisabled(ratio: string): number[] {
  return ratio === '16:9' ? [3, 4] : [1, 2]
}

// Input Lag follows Game Motion Plus (ItemDefine InputLagType: Off FASTEST, Level 1 FASTER, Level 2 FAST)
export function inputLag(motionPlus: string) {
  return motionPlus === 'Level 2' ? 'Fast' : motionPlus === 'Level 1' ? 'Faster' : 'Fastest'
}

// Signal of the mocked game console (matches the source banner: 3840x2160 @60Hz, UHD, HDR)
export const SIGNAL = { resolution: '3840x2160', fps: '60', hdr: 'On', vrr: 'Off' }

// Help Guide (HelpGuideViewModel.RefreshText): control items except Help Guide (Minimap Zoom followed by
// Share to, as Minimap sharing is supported), then the info items, then Autorun Game Bar.
const MZ_3 = "You don't want to be defined the zoom area of Minimap automatically, Set to Off the Minimap Auto detection in More Settings."
const SR144B = '[21:9]\n3840 x 1600 (60Hz/120Hz/*144Hz)\n2560 x 1080 (60Hz/120Hz/*144Hz)\n[32:9]\n3840 x 1080 (60Hz/120Hz/*144Hz)\n*: Depending on the model, this refresh rate may not be supported.'
const MZ120A = '[16:9]\n3840 x 2160 (60Hz/120Hz)\n[21:9]\n3840 x 1600 (60Hz/120Hz)\n2560 x 1080 (60Hz/120Hz)\n[32:9]\n3840 x 1080 (60Hz/120Hz)'
const MS144C = '[16:9]\n3840 x 2160 (60Hz/120Hz) \n[21:9]\n3840 x 1600 (60Hz/120Hz) \n2560 x 1080 (60Hz/120Hz) \n[32:9]\n3840 x 1080 (60Hz/120Hz)'
const REF1 = '* This feature supports resolution under 4K and 16:9 aspect ratio.'

export const HELP: { title: string; text: string }[] = [
  {
    title: 'Game Genre',
    text:
      "You can select the mode based on the current game's genre. " +
      'When you select Auto, the picture/sound settings for the game you are playing will be optimized automatically.\n' +
      'Auto is only supported when PC or Game Console is the current source.\n' +
      'To customize the game picture, select Custom.',
  },
  {
    title: 'Virtual Aim Point',
    text: 'Shows a virtual aim point on the center of the screen.\nYou can choose one of six points and change it by selecting Edit Position.',
  },
  {
    title: 'Screen Ratio',
    text:
      "For more immersive gaming, set the game screen's ratio to wide (21:9 or 32:9). \n*Supported screen ratios may differ depending on the model.\n\n" +
      'If you experience any problems when changing the screen ratio, follow these steps:\n\n' +
      '1) Make sure that the game supports ultra-wide resolution (21:9 or 32:9).\n' +
      "2) Set the PC's screen resolution to match the screen ratio selected in Game Bar once only. (If you set the PC's screen resolution once, next time you can change the screen ratio directly from Game Bar.) \n" +
      '3) If the game screen and sound are not normal, exit the game. Then select the screen ratio you want and rerun the game.\n\n' +
      `${SR144B}\n\n` +
      'Please note:\n– Changing the screen ratio is not supported during game play.\n– For some games, you may need to match the game resolution with the selected screen ratio in Game Bar.\n– To change the screen position, press the Channel Up or Down button.\n– The supported refresh rate may vary by screen size.',
  },
  {
    title: 'Minimap Zoom',
    text:
      'When you run Minimap Zoom, the Minimap is recognized and the zoom area is defined automatically. You can move the zoom area with the Directional Pad and adjust the zoom level with the Select button. If the zoom area disappears, use the Select button or Directional Pad to display it again. ' +
      `Find out more about the supported Minimap resolutions below.\n${MZ120A}\n${REF1}\n${MZ_3}`,
  },
  {
    title: 'Share to',
    text:
      'Share to enables users to mirror the Minimap Zoom area on other devices. This feature may not be available on some devices. \nWhen Share to is on, you can move the zoom area with the Directional Pad and adjust the zoom level with the Select button. If the zoom area disappears, use the Select button or Directional Pad to display it again.\n' +
      "You will need to start the 'Second Screen' feature from your Galaxy tablet before you start Share to.\n" +
      'For Windows, you will need to select “Enable Wireless Display” on your PC before you start Share to. Find out more about the supported Share to resolutions below.\n' +
      `${MS144C}\n${REF1}\n${MZ_3}`,
  },
  {
    title: 'More settings',
    text:
      'Sets game-related options.\n\nDynamic Black Equalizer:\nIncrease the visibility of objects lurking in the dark and improve black details and clarity. Control the black detail levels with 5 steps. \n\n' +
      'Surround Sound:\nEnjoy intelligent, scene-based 3D surround sound for highly immersive gameplay.\n\nGame Picture Expert:\nAdjust HDR options in each game.\n\n' +
      'This function may not be supported due to the region, model or device settings.',
  },
  {
    title: 'Game Motion Plus',
    text: 'Enhance screen smoothness to optimize fast-moving games, such as RPG and adventure games. When Game Motion Plus is on, motion smoothness is improved, and input lag increases due to motion enhancement. Not supported when setting VRR options or selecting HFR on external devices.',
  },
  { title: 'Sound Output', text: 'Change the sound output.' },
  {
    title: 'Input Lag',
    text: 'Input Lag is the delay between your input and seeing the result on screen. It is shown as Fast, Faster, or Fastest. For example, with Game Motion Plus off, VRR on, 120Hz game – Input Lag changes to Fastest automatically.',
  },
  { title: 'Resolution', text: 'Displays the device output resolution. This may not match the Panel resolution.' },
  { title: 'FPS', text: 'Shows the frame rate per second in real time. The frame rate changes when VRR is active.' },
  { title: 'HDR', text: 'Shows as HDR when an HDR game is being played. \nPlease check that HDR is turned on in your source device.' },
  {
    title: 'VRR',
    text: 'VRR or FreeSync eliminates screen tearing without latency. FreeSync or VRR can be operated when you use FreeSync-supported graphic cards and consoles with the feature turned on in source devices.',
  },
  {
    title: 'Autorun Game Bar',
    text: 'Game Bar can launch automatically when you switch to Game Mode or a connected device. This feature can be turned on or off in the Autorun Game Bar settings in More Settings.',
  },
]
