// First-time setup data for this EU TV (spec3/setup.md 3.3). Display names and greetings are the
// firmware's strings (ug-wizard-setup-new.mo: SID_SETUP_LANGUAGE_*, TV_SID_OOBE_CAJUL_REMOTE_HELLO_DOT_*;
// the _BRACKET greeting where two languages share one, e.g. "Hallo! (Deutsch)" / "Hallo! (Nederlands)").
// The language list is built from the UG's locale folders and sorted by display name
// (WizardSetupLanguagePage m_CreateLanguageList); which locales an EU set lists is inferred.

export type Language = { locale: string; name: string; hello: string; country: string }

export const LANGUAGES: Language[] = [
  { locale: 'sq_AL', name: 'Shqip', hello: 'Përshëndetje!', country: 'Albania' },
  { locale: 'bs_BA', name: 'Bosanski', hello: 'Zdravo! (Bosanski)', country: 'Bosnia and Herzegovina' },
  { locale: 'bg_BG', name: 'Български', hello: 'Здравейте!', country: 'Bulgaria' },
  { locale: 'hr_HR', name: 'Hrvatski', hello: 'Pozdrav!', country: 'Croatia' },
  { locale: 'cs_CZ', name: 'Čeština', hello: 'Ahoj! (Čeština)', country: 'Czech' },
  { locale: 'da_DK', name: 'Dansk', hello: 'Hej! (Dansk)', country: 'Denmark' },
  { locale: 'nl_NL', name: 'Nederlands', hello: 'Hallo! (Nederlands)', country: 'Netherlands' },
  { locale: 'en_GB', name: 'English', hello: 'Hi!', country: 'United Kingdom' },
  { locale: 'et_EE', name: 'Eesti', hello: 'Tere!', country: 'Estonia' },
  { locale: 'fi_FI', name: 'Suomi', hello: 'Hei! (suomi)', country: 'Finland' },
  { locale: 'fr_FR', name: 'Français', hello: 'Bonjour ! (Français)', country: 'France' },
  { locale: 'de_DE', name: 'Deutsch', hello: 'Hallo! (Deutsch)', country: 'Germany' },
  { locale: 'el_GR', name: 'Ελληνικά', hello: 'Γεια!', country: 'Greece' },
  { locale: 'hu_HU', name: 'Magyar', hello: 'Üdv!', country: 'Hungary' },
  { locale: 'it_IT', name: 'Italiano', hello: 'Ciao!', country: 'Italy' },
  { locale: 'lv_LV', name: 'Latviešu', hello: 'Sveiki! (Latviešu)', country: 'Latvia' },
  { locale: 'lt_LT', name: 'Lietuvių', hello: 'Sveiki! (Lietuvių)', country: 'Lithuania' },
  { locale: 'mk_MK', name: 'Македонски', hello: 'Здраво!', country: 'North Macedonia' },
  { locale: 'nn_NO', name: 'Norsk', hello: 'Hei. (Norsk)', country: 'Norway' },
  { locale: 'pl_PL', name: 'Polski', hello: 'Cześć!', country: 'Poland' },
  { locale: 'pt_PT', name: 'Português', hello: 'Olá!', country: 'Portugal' },
  { locale: 'ro_RO', name: 'Română', hello: 'Salut! (Română)', country: 'Romania' },
  { locale: 'ru_RU', name: 'Русский', hello: 'Привет!', country: 'Others' },
  { locale: 'sr_RS', name: 'Srpski', hello: 'Zdravo! (Srpski)', country: 'Serbia' },
  { locale: 'sk_SK', name: 'Slovenčina', hello: 'Ahoj! (Slovenčina)', country: 'Slovakia' },
  { locale: 'sl_SI', name: 'Slovenščina', hello: 'Zdravo! (Slovenščina)', country: 'Slovenia' },
  { locale: 'es_ES', name: 'Español', hello: '¡Hola!', country: 'Spain' },
  { locale: 'sv_SE', name: 'Svenska', hello: 'Hej! (Svenska)', country: 'Sweden' },
  { locale: 'tr_TR', name: 'Türkçe', hello: 'Merhaba!', country: 'Türkiye' },
  { locale: 'uk_UA', name: 'Українська', hello: 'Вітаю!', country: 'Others' },
].sort((a, b) => a.name.localeCompare(b.name, 'en'))

export const DEFAULT_LANGUAGE = 'en_GB'

// SID_COUNTRY_* / TV_SID_COUNTRY_* names of the DVB EU country list (WizardSetupCountryPage, alphabetical;
// "Others" last). The default follows the language (m_SetDefaultCountryByLanguage).
export const COUNTRIES = [
  'Albania', 'Austria', 'Belgium', 'Bosnia and Herzegovina', 'Bulgaria', 'Croatia', 'Czech', 'Denmark',
  'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Kosovo', 'Latvia',
  'Lithuania', 'Luxembourg', 'Montenegro', 'Netherlands', 'North Macedonia', 'Norway', 'Poland', 'Portugal',
  'Romania', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Türkiye', 'United Kingdom',
  'Others',
]

// Countries whose TVs refuse 0000 as a new PIN (ChangePinPopup.CheckValidPin, country ids 4/9/25/42/41)
// and, here, the ones that ask for a PIN during setup (wizard-pin). Which countries those ids are is
// inferred: France.
export const PIN_SETUP_COUNTRIES = new Set(['France'])
