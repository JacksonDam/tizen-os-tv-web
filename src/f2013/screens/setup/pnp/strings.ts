// Plug & Play texts, verbatim from exeDSP's English tables (g_MenuWStringEng = M, g_NetworkWStringEng =
// N, g_CommonWStringEng = C; index in hex). spec/setup.md 3.
export const S = {
  welcomeTitle: 'Welcome to Samsung Smart TV.',                                   // M 0x905
  languageIntro: 'Select your language to start the on screen setup.',            // M 0x907
  languageHelp: 'Press the arrow buttons to move around the screen.\nPress the Enter button to select an option.', // M 0x96e
  configureTitle: 'Configure your TV',                                            // M 0x917
  configureIntro: 'Select your information in the categories below.',             // M 0x908
  country: 'Country',                                                             // M 0x22c
  countryHelp: "Select the country that you're in now.",                          // M 0x8c6
  channelSource: 'Channel Source',                                                // M 0x968
  channelSourceHelp: 'Can you see live TV? If not, change the input source until you can.', // M 0x916
  aerial: 'Aerial',                                                               // M 0x74d
  setTopBox: 'Set-top box',                                                       // M 0x74e
  source: 'Source',                                                               // M 0x758
  networkType: 'Network type',                                                    // N 0xe8
  wireless: 'Wireless',                                                           // N 0x32
  wired: 'Wired',                                                                 // N 0x2f
  noNetwork: 'No Network',                                                        // N 0xeb
  wirelessHelp: 'You can connect your TV to the internet. Please select which wireless network to use.', // N 0x12f (<<A>> = N 0x129 "TV")
  wiredHelp: 'Plug a network cable in to the back of your TV.',                   // N 0xef
  noNetworkHelp: 'Network setup will be skipped.',                                // N 0xec
  wirelessNetwork: 'Wireless network',                                            // N 0xe9
  select: 'Select',                                                               // N 0xea
  wirelessNetworkHelp: 'Select the wireless network you want to connect to.',     // N 0xf1
  wps: 'WPS(PBC)',                                                                // N 0x53
  addNetwork: 'Add Network',                                                      // N 0x00
  refresh: 'Refresh',                                                             // N 0x54
  checkingWireless: 'Checking for wireless networks...',                          // N 0x81
  noNetworkAdvice: "If you don't want to use a network, select No Network as the network type.", // M 0x909
  ok: 'OK',                                                                       // M 0x3fd
  completeTitle: 'Setup complete!',                                               // M 0x8ea
  completeNoNetwork:
    'You can’t use Smart Hub until you set up a network connection.\nPress the Smart Hub button on your remote (see image below) to set up Smart Hub at any time.', // M 0x8e7
}

// The TV library's language list (g_pAppTV+0x7dc, native names). Both reference TVs start English, Eesti,
// Suomi, Français, Deutsch; the rest of the order is inferred (exeDSP's IME language table @04bfc23c,
// alphabetical by English name, starting at English). The UI stays English whatever is picked.
export const LANGUAGES = [
  'English', 'Eesti', 'Suomi', 'Français', 'Deutsch', 'Ελληνικά', 'Magyar', 'Italiano', 'Қазақ', 'Latviešu',
  'Lietuvių', 'Македонски', 'Norsk', 'Polski', 'Português', 'Română', 'Русский', 'Srpski', 'Slovenčina',
  'Slovenščina', 'Español', 'Svenska', 'Türkçe', 'Українська', 'Shqip', 'Български', 'Hrvatski', 'Čeština',
  'Dansk', 'Nederlands',
]

// The EU country list (g_pAppTV+0x468, names via CMenuUtil::GetCountryTextId). United Kingdom is the
// default for English (CPlugPlayController::GetPlugPlayDefaultCountryByLanguage @025a466c -> country 7).
// Order inferred (alphabetical; not in exeDSP).
export const COUNTRIES = [
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France',
  'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Kazakhstan', 'Latvia', 'Lithuania', 'Luxembourg',
  'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'Russia', 'Serbia', 'Slovakia', 'Slovenia', 'Spain',
  'Sweden', 'Switzerland', 'Turkey', 'Ukraine', 'United Kingdom', 'Eastern Europe', 'Others',
]
