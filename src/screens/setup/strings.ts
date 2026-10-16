// English (en_US) strings used by the PIN popups, factory reset and first-time setup, keyed by the
// firmware string ids (SIDs). Sources (extract/ui/spec3/setup.md 1):
//   menu: agent-extra/fs-tree/locale/en_US.tsv + sids-extended.tsv (org.tizen.menu, flux-manager.mo)
//   wsn:  ug-wizard-setup-new.mo (/usr/ug/ug-wizard-setup-new/res/locale/en_US)
//   terms: wizard-homesetting.mo (ug-wizard-terms), net: ug-SystemSetupNetworkUG-efl.mo
// <<A>> in a product string is REP.DEVICE.TV = "TV".

export const S = {
  // ---- PIN (menu, flux-manager) ----
  COM_ENTER_YOUR_PIN_KR_PIN: 'Enter your PIN.',
  COM_TV_SID_ENTER_A_NEW_PIN: 'Enter a new PIN.',
  TV_SID_ENTER_PIN_AGAIN_POINT: 'Enter the PIN again.',
  TV_SID_WEBBROWSER_PIN_ENTERED_NOT_MATCH_TRY_KR_17: 'The PINs you entered do not match. Please try again.',
  SID_INVALID_PIN_PLEASE_ENTER_AGAIN: 'Incorrect PIN. Please check and try again.',
  TV_SID_CI_PIN_HAS_BEEN_CHANGED: 'The PIN has been changed.',
  INCORRECT_PIN_ENTERED_TIMES: (n: number) => `Incorrect PIN entered: ${n} time(s)`,
  INCORRECT_PIN_TOO_MANY: (s: number) => `Incorrect PIN entered too many times. Try again in ${s} second(s).`,
  COM_SID_CANCEL: 'Cancel',
  COM_SID_RESET: 'Reset',

  // ---- Factory data reset (menu) ----
  TV_SID_SETTINGS_PRIVACY_CBJUL_POPUP_MSG_ALL_DATA_DELETED_MSG:
    'If you proceed, all data will be deleted – including your account information, downloaded apps and settings – and be reset to factory defaults.',
  TV_SID_SUPPORT_MIX_CBJAN_WILL_RESTART_AUTO_AFTER_RESET: 'TV will restart automatically after the reset is complete.',
  PJT_SID_SUPPORT_RESET_COMPLELTE_TV_TURN_OFF_RESTART: 'Reset is complete. TV will turn off and restart automatically.',

  // ---- First-time setup (wsn) ----
  COM_SID_WELCOME_MSG_KR_NODOT: 'Welcome',
  TV_SID_OOBE_CAJUL_REMOTE_HELLO_DOT_ENGUS: 'Hello.',
  TV_SID_OOBE_SELELCT_YOUR_LANGUAGE: 'Select your language.',
  TV_SID_OOBE_CFAPR_TO_USE_THE_ACCESSIBILITY_FEATURE_SIMPLY_PRESS_AND_HOLD_THE_MUTE_BUTTON:
    'To use the accessibility feature, simply press and hold the mute button.',
  TV_SID_OOBE_SELELCT_COUNTRY_OR_REGION: 'Select Your Country or Region',
  TV_SID_OOBE_CANOV_CONNECT_DEVICE_SCREEN: 'Connect Your Devices to the Screen',
  TV_SID_OOBE_CANOV_PLUG_TURN_ON_SCREN: 'Simply plug in and turn on the devices you want to use with your screen.',
  TV_SID_OOBE_CANOV_READY_MOVE_NEXT_STEP: 'When you’re ready, we will move on to the next step.',
  TV_SID_42675_OOBE_ANT_IN: 'ANT IN',
  TV_SID_42675_OOBE_TURN_ON_DEVICE: 'Turn on the device.',
  COM_SID_CONNECTED: 'Connected',
  COM_SID_NOT_CONNECTED: 'Not connected',
  COM_BUTTON_NEXT: 'Next',
  COM_SID_SKIP: 'Skip',
  COM_SID_YES: 'Yes',
  COM_SID_NO: 'No',
  TV_SID_OOBE_CBAUG_POPUP_NO_DEVICE_DETECTED_LATER:
    'Are you sure you do not want to connect any devices? Your screen will automatically set up any devices you connect.',
  TV_SID_OOBE_SELECT_TV_SOURCE: 'Select Your TV Source',
  TV_SID_OOBE_SELELCT_SOURCE_TV_CHANNELS_FROM: 'Select the source you receive TV channels from.',
  COM_SID_ANTENNA_KR_CONFIG_TV: 'Antenna',
  TV_SID_CONNECT_ANTENNA_CHOOSE_ANTENNA: 'If your cable or satellite box is connected to the TV via an antenna cable, choose Antenna.',
  TV_SID_CABLE_OR_SATELLITE_BOX: 'Cable or Satellite Box',
  TV_SID_OOBE_CBAUG_NO_BROADCAST_SIGNAL: 'No broadcast signal.',
  TV_SID_CHOOSE_OPTION_REQUIRE_LIVE_TELEVISION_SIGNAL: 'Choose this option if you don’t require a live television signal.',
  TV_SID_CONNECT_THE_ANTENNA_CABLE_TO_YOUR_TV: 'Connect the antenna cable to your TV.',
  TV_SID_OOBE_CEAUG_SERVICE_REGISTRATION: 'Service Registration',
  TV_SID_OOBE_CEAUG_MAKE_YOUR_HOME_SCREEN: 'Make Your Home Screen',
  TV_SID_OOBE_CEJUL_REGISTERING_PRODUCT: 'Registering Product...',
  TV_SID_OOBE_CEJUL_REGISTERING_SERVICES: 'Registering Services...',
  COM_MAPP_SID_OOBE_CBSEP_CREATE_A_PIN: 'Create a PIN',
  COM_MAPP_SID_OOBE_CBOCT_PIN_TO_PREVENT_CHILDREN_ADULT_MSG:
    'You can use your PIN to prevent access to adult content or apps, and restore all settings to the factory defaults.',
  TV_SID_ENTER_A_NEW_PIN: 'Enter a new PIN.',
  TV_SID_ENTER_THE_PIN_AGAIN: 'Enter the PIN again.',
  TV_SID_WEBBROWSER_PIN_ENTERED_NOT_MATCH_TRY: 'The PINs you entered do not match. Please try again.',
  TV_SID_SUCCESSFULLY_SET_PIN: 'You have successfully set your PIN.',
  PJT_SID_OOBE_TV_READY_TO_USE: 'TV is ready to use.',   // ug-mobileoob-tv.mo, <<A>> = TV

  // ---- Terms (terms) ----
  TV_SID_OOBE_SMART_HUB_AGREEMENT: 'Smart Hub Agreement',
  TV_SID_MIX_BEFORM_SET_UP_SMART_HUB_MUST_AGREE:
    'Before you can set up Smart Hub, you must agree to the Terms and Conditions and Privacy Policy.',
  TV_SID_SELECT_AGREE_BOTH_SELECT_DISAGREE: 'Select Agree if you agree to both, or select Disagree.',
  COM_TV_SID_TERMS_CONDITIONS_PRIVACY_POLICY: 'Terms and Conditions, Privacy Policy',
  COM_SID_AGREE: 'Agree',
  COM_SID_DISAGREE: 'Disagree',
  TV_SID_TNC_CDMAR_USE_SMART_HUB_AGREE_TNC_PN_SKIP:
    'To use Smart Hub, you need to agree to the Smart Hub Terms and Conditions and Privacy Notice. Are you sure you want to skip?',
  TV_SID_LOADING_PLEASE_WAIT: 'Loading, Please wait…',

  // ---- Network (net) ----
  TV_SID_OOBE_CAJUL_REMOTE_CONNECT_ENTERTAINMENT_UR_LOVE: 'Connect to the Entertainment You Love',
  TV_SID_OOBE_CAJUL_REMOTE_OR_CONNECT_ETHERNET_CABLE: 'Or connect an internet cable from your router.',
  TV_SID_OOBE_WIRED_CONNECTION: 'Wired Connection',
  PJT_SID_TV_CONNECTED_INTERNET: 'TV is connected to the Internet.',
  SID_SUCCESS_EXCLAMATION: 'Success!',
  TV_SID_NETWORK_BASIC_DEVICE_INFO_IP_ETC_NETWORK:
    'Basic device information, such as the IP address, model name, etc., will be transmitted to Samsung for network connection.',
  SID_IP_ADDRESS: 'IP Address',
  SID_NETWORK_ERROR_MSG: 'Network interference occurred. Please try again later.',   // terms
  SID_OK: 'OK',
  COM_SID_PREVIOUS: 'Previous',
  TV_SID_MIX_CONNECT_CABLE_TURN_ON_RECOMMEND: (a: string) =>
    `Connect your cable or satellite box to the TV and turn it on. We recommend connecting via ${a}.`,
} as const
