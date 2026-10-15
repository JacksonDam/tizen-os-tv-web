# Generates src/screens/allsettings/menuData.ts from the TV's settings-datafw JSON plus the per-item
# visibility decisions below (this TV: no tuner, nothing paired, signed out).
# usage: TIZEN_FS_TREE=<extracted settings data> python3 tools/gen_menu.py src/screens/allsettings/menuData.ts
# TIZEN_FS_TREE must hold fulljson/menu-tv.json, the locale tables and vconf defaults extracted from the
# firmware (not part of this repository).
import json, os, re, sys

FT = os.environ.get('TIZEN_FS_TREE') or sys.exit('set TIZEN_FS_TREE to the extracted settings data folder')
OUT = sys.argv[1]

full = json.load(open(os.path.join(FT, 'fulljson/menu-tv.json')))
ITEMS, TREES = full['menuitems'], full['menutree']

S = {}
for p, col in ((os.path.join(FT, 'sids-extended.tsv'), 1), (os.path.join(FT, 'locale/all-en_US-merged.tsv'), 1),
               (os.path.join(FT, 'locale/en_US.tsv'), 1)):
    for line in open(p, encoding='utf-8'):
        parts = line.rstrip('\n').split('\t')
        if len(parts) > col and parts[0]:
            S[parts[0]] = parts[col]

VC = {}
for p in ('vconf-system-defaults.tsv', 'vconf-memory-defaults.tsv'):
    for line in open(os.path.join(FT, p), encoding='utf-8'):
        parts = line.rstrip('\n').split('\t')
        if len(parts) >= 3:
            VC[parts[0]] = (parts[1], parts[2])


def L(sid):
    if not sid:
        return ''
    if sid in S:
        return S[sid]
    return sid  # literal ("HDMI 7", "10%")


def item(iid):
    it = dict(ITEMS.get(iid) or {})
    if 'inheritee' in it:
        base = dict(ITEMS.get(it['inheritee']) or {})
        base.update(it)
        it = base
    return it


def num(v):
    if isinstance(v, str) and re.fullmatch(r'-?\d+', v):
        return int(v)
    return v


OFFON = [(0, 'Off'), (1, 'On')]

# ---------------------------------------------------------------------------
# Decisions. False = hidden on this TV. A dict = shown, with overrides:
#   title, style, options [(value,label)], value, valueText, min/max/step, disabled,
#   action, help (None drops JSON help), optionPage, noChildren, ui, format, picker
# Every item reached under a shown parent must have an entry (the script fails otherwise).
# ---------------------------------------------------------------------------
H = False
D = {
    # root
    'projector-setting': H,
    'picture': {'icon': 'settings_menu_icon_picture.svg'},
    'sound': {'icon': 'settings_menu_icon_sound.svg'},
    'connection': {'icon': 'settings_menu_icon_connections.svg'},
    'smartfeature': {'icon': 'settings_menu_icon_advanced_features.svg'},
    'system': {'title': 'General & Privacy', 'icon': 'settings_menu_icon_general&privacy.svg'},
    'support': {'icon': 'settings_menu_icon_support.svg'},

    # ---- Picture
    'picturemode': {'optionPage': True,
                    'options': [(65536, 'Dynamic'), (65537, 'Standard'), (65538, 'Movie'), (655360, 'FILMMAKER MODE')],
                    'value': 65537},
    'comfort-mode-settings': H,
    'intelligent-calibration': H,   # ezcal.intelligent_calibration.support=false
    'screen-protection': H,
    'expert-settings': {},
    # Picture > Expert Settings
    'brightness': {'title': 'Brightness', 'min': 0, 'max': 50, 'step': 1, 'value': 25},
    'brightness-auto': H,
    'contrast': {'min': 0, 'max': 50, 'step': 1, 'value': 45},
    'contrast-auto': H,
    'sharpness': {'min': 0, 'max': 20, 'step': 1, 'value': 10},
    'color': {'min': 0, 'max': 50, 'step': 1, 'value': 25},
    'color-auto': H,
    'tint': {'min': 0, 'max': 30, 'step': 1, 'value': 15, 'format': 'tint'},
    'led-hdr': H,
    'auto-hdr-remastering': H,
    'auto-hdr-remastering-pro': H,
    'picture-hdr-tone-mapping': {'options': [(0, 'Static'), (1, 'Active')]},
    'peak-brightness': H,           # product.peak_brightness=false
    'peak-brightness-projector': H,
    'dynamic-contrast': {'options': [(0, 'Off'), (1, 'Low'), (2, 'High')]},
    'dynamic-contrast-auto': H,
    'shadow-detail': H,             # 0..100 variant; the -5..5 one is used with 50step_brightness
    'shadow-detail1': {'title': 'Shadow Detail', 'value': 0},
    'gamma': {'value': 0},
    'org-gamma': H,
    'org-value-gamma': H,
    'applypicmode': {},
    'smart-led': H,                 # Korean-language twin (FlagSKLan); English uses -male
    'smart-led-male': {'options': [(1, 'Low'), (2, 'Standard'), (3, 'High')], 'value': 2},
    'film-mode': H,
    'film-mode-male': {'disabled': True},
    'color-space': {'valueText': 'Auto'},
    'colorspace-mode': {'options': [(0, 'Auto'), (2, 'Native'), (3, 'Custom')]},
    'colorspace-gamut': H,          # color_space.color_gamut_menu_diable=true
    'colorspace-color': {'disabled': True},
    'colorspace-adjustmentpoint': H,
    'colorspace-red': {'min': 0, 'max': 50, 'step': 1, 'value': 25, 'disabled': True},
    'colorspace-green': {'min': 0, 'max': 50, 'step': 1, 'value': 25, 'disabled': True},
    'colorspace-blue': {'min': 0, 'max': 50, 'step': 1, 'value': 25, 'disabled': True},
    'colorspace-reset': {'disabled': True},
    'color-booster': {},
    'color-booster-pro': H,
    'color-tone': {'options': [(0, 'Cool'), (1, 'Standard'), (2, 'Warm1'), (3, 'Warm2')], 'value': 1},
    'color-tone-auto': H,
    'white-balance': {},
    '2p-white-balance': {},
    'r-gain': {'min': -50, 'max': 50, 'step': 1, 'value': 0},
    'g-gain': {'min': -50, 'max': 50, 'step': 1, 'value': 0},
    'b-gain': {'min': -50, 'max': 50, 'step': 1, 'value': 0},
    'r-offset': {'min': -50, 'max': 50, 'step': 1, 'value': 0},
    'g-offset': {'min': -50, 'max': 50, 'step': 1, 'value': 0},
    'b-offset': {'min': -50, 'max': 50, 'step': 1, 'value': 0},
    'whitebalance-reset': {},
    '10p-white-balance': H,         # 10p_white_balance_supported=false
    '20p-white-balance': {},
    '20p-white-balance-mode': {},
    '20p-white-balance-interval': {'disabled': True},
    '20p-white-balance-red': {'value': 0, 'disabled': True},
    '20p-white-balance-green': {'value': 0, 'disabled': True},
    '20p-white-balance-blue': {'value': 0, 'disabled': True},
    '20p-white-balance-reset': {'disabled': True},
    'noise-reduction-kants2': H,
    'picture-clarity-settings': H,
    'blue-light-reduction': H,
    'picturesize': {'valueText': '16:9 Standard'},
    'picturesize-mode': {'options': [(0, '16:9 Standard'), (1, 'Custom'), (2, '4:3')]},
    'picturesize-mode-video': H,
    'picturesize-mode-mycontent-video': H,
    'picturesize-autowide': H,      # broadcast-source item; no tuner
    '43-picturesize': H,
    'picturesize-screenfit': {'options': [(0, 'Off'), (1, 'On'), (2, 'Auto')]},
    'picturesize-screenfit-mm': H,
    'picture-position': {'disabled': True},
    'picture-position-mm': H,
    'pip': H,                       # no tuner
    'resetpicture': {},

    # ---- Sound
    'soundoutput': {'title': 'Sound Output', 'optionPage': True,
                    'options': [(0, 'TV Speaker'), (1, 'Audio Out')], 'value': 0},
    'external-sound-mode': H,
    'sound-mode': {'optionPage': True, 'options': [(1, 'Standard'), (5, 'Amplify')], 'value': 1},
    'adaptive-sound-settings-ai-optiview': H,
    'Q-symphoney-setup': H,
    'Q-symphony-setup-NUIGadget': H,
    'sound-expert-settings': {},
    'balance': {},
    'wooferequalizer': H,
    'equalizer': {},
    'concert-system': H,
    'hdmi_earc': H,
    'audio-format': {'options': [(0, 'PCM'), (1, 'Auto'), (2, 'Pass-Through')]},
    'audio-delay': {'value': 0},
    'dolby_atmos': H,               # acm.atmos_support=false
    'autovolume': {},
    'simultaneous-optical': {'value': 1},   # vconf db/menu/sound/simultaneous_optical=True
    'bms-settings': H,
    'resetsound': {},

    # ---- Connections
    'network': {'title': 'Network'},
    'networkstatus': {'title': 'Network Status'},
    'networksettings': {'title': 'Network Settings'},
    'SavedAP1': H, 'SavedAP2': H, 'savedAPUG': H,
    'softAP': H,
    'ResetNetwork': {'title': 'Reset Network'},
    'CertificateManager': H,
    'networklock': H,
    'WiredEAP': H,
    'ExpertSettings': {'title': 'Expert Settings'},
    'MobileDeviceTV_US': {'title': 'Power On with Mobile', 'options': OFFON, 'value': 0},
    'IPRemote': {'title': 'IP Remote', 'options': OFFON, 'value': 0},
    'EasyConnect': {'title': 'Easy Connection'},
    'htv-crestron-server': H,
    'WIFI_ON_OFF': {'title': 'Wi-Fi', 'options': OFFON, 'value': 1},
    'WIFI_DIRECT': H,
    'add-bluetooth-keyboard': {'title': 'Bluetooth Device List'},
    'AutomaticBluetoothAudioConnection': H,
    'add-woc-devices': H,
    'quick-share': H,
    'multi-control': H,
    'storage-sharing': H,
    'DeviceConnectManager': {'title': 'Device Connect Manager'},
    'AccessNotification': {'title': 'Access Notification',
                           'options': [(0, 'Off'), (1, 'First Time Only'), (2, 'Always On')]},
    'DeviceList': {'title': 'Device List'},
    'airplay-settings': {'title': 'Apple AirPlay Settings'},
    'googlecast-setting': H,

    # ---- Advanced Features
    'live-translate': H,
    'aitech': H,
    'soccer-mode': H,               # list variant; this TV has the sound controller -> settings page
    'soccer-mode-settings': {'title': 'AI Soccer Mode Pro Settings'},
    'soccer-mode-soccer-mode-settings': H,
    'soccer-mode-soccer-mode-settings-switch': {'title': 'AI Soccer Mode Pro', 'options': OFFON, 'value': 0},
    'soccer-sound-controller-settings': {'title': 'AI Soccer Sound Controller', 'disabled': True},
    'soccer-sound-controller-commentator': {'value': 0},
    'soccer-sound-controller-background': {'value': 0},
    'reset-soccer-sound-controller': {'title': 'Reset'},
    'general-voice': H,
    'general-voice-onboarding': {'title': 'Set Up Voice Assistant'},
    'gesture-menu-gsl': H,
    'game-mode': {},
    'game-mode-auto': H,
    'game-mode-setting': {},
    'game-mode-subitem': {},
    'game-mode-setting-game-mode-auto': H,
    'sm-response-time': H,
    'virtual-aim-point': H,
    'minimap-auto-detection': H,    # game_bar.minimap_auto_detection_support=false
    'surround-sound': H,            # sound.game_enhance_support=false
    'dynamic-black-eq': {'value': 0},
    'game-motion-plus-setting': H,  # product.game_motion_plus_supported=false
    'game-hdr': H,                  # hgig_support=false
    'game-picture-expert': {},
    'hdr-10gaming': {'options': [(0, 'Basic'), (1, 'Advanced')]},
    'game-hdr-tone-mapping': H,
    'game-bar-autorun': {},
    'Ambient-Info': H,
    'smart-feature': {},
    'smarthub_autostart': {'title': 'Start with Smart Hub Home'},
    'auto-run-app': H,
    'htv-auto-run-signage': H,
    'auto-run-samsung-tvplus': H,
    'auto-run-multiview': H,
    'autorun_multi_view_mirroring': H,
    'autorun-multiview-rotating': H,
    'homepage-iot-service-entry': H,

    # ---- General & Privacy
    'accessibility': {},
    'voiceguide': {'title': 'Voice Guide Settings', 'valueText': 'Off'},
    'voiceguide_on': {'title': 'Voice Guide', 'value': 0},
    'voiceguide_volume': {'title': 'Volume', 'disabled': True, 'value': 2,
                          'options': [(0, 'Very Loud'), (1, 'Loud'), (2, 'Medium'), (3, 'Soft'), (4, 'Very Soft')]},
    'voiceguide_speed': {'title': 'Speed', 'disabled': True, 'value': 2,
                         'options': [(0, 'Very Fast'), (1, 'Fast'), (2, 'Normal'), (3, 'Slow'), (4, 'Very Slow')]},
    'voiceguide_pitch': {'title': 'Pitch', 'disabled': True, 'value': 1,
                         'options': [(0, 'High'), (1, 'Medium'), (2, 'Low')]},
    'tv_background_volume': {'title': 'TV Background Volume', 'disabled': True, 'value': 2,
                             'options': [(0, 'Very Loud'), (1, 'Loud'), (2, 'Medium'), (3, 'Soft'), (4, 'Very Soft')]},
    'audio-description-atsc': H,
    'audio-description-entry': {},
    'audio-description-dvb': {},
    'audio-description-volume': {'disabled': True},
    'spoken-subtitles-settings': H,
    'subtitle-recog': H,            # screen_analysis.subtitle_recog_support=false
    'picture-off': {},
    'graphic-zoom': {'title': 'Graphic Zoom'},
    'highcontrast': {},
    'relumino-mode-settings': H,
    'enlarge': {},
    'grayscale': {},
    'color-inversion': H,
    'seecolors-mode': H,
    'learnremotecontroller': {'title': 'Learn TV Remote'},
    'learnmenu': {'title': 'Learn Menu Screen'},
    'caption': H,
    'subtitle': H,                  # DVB subtitle settings need a DTV tuner
    'sign-language-zoom-settings': H,
    'signlanguage': H,
    'bt-headphone-multi-output': H,
    'slow-key-repeat-setting': H,
    'accessibility-shortcut-settings': {
        'options': [(0, 'Accessibility Shortcut'), (1, 'Audio Description On/Off'),
                    (5, 'Audio Description and Subtitles On/Off')]},
    'time-to-take-action': H,       # FlagSupportAOT (the switch Screen Saver is the non-AOT variant)
    'moving-text-and-image': H,
    'privacy': {},
    'privacy-choices': {'title': 'Privacy Choices'},
    **{'smarthub-term-%d' % n: H for n in range(1, 16)},
    'resetpsiditem': {'title': 'Reset PSID'},
    'privacy-cn': H,
    'battery': H,
    'power-energy-saving': {},
    'energy-saving-solution': {'value': 0},
    'brightness-limit': H,
    'brightness-optimization': {'value': 0},
    'min-backlight': {'min': 0, 'max': 50, 'step': 1, 'value': 0, 'disabled': True},
    'motion-lighting': {},
    'screen-saver': {},
    'screen-saver-aot': H,
    'auto-screen-dim': {'value': 0},
    'auto-power-off': {'options': [(0, 'Off'), (4, '4 hours'), (6, '6 hours'), (8, '8 hours')]},
    'power-off-mode': H,
    'turn-off-portland': H,
    'sleeptimer': {'options': [(0, 'Off'), (30, '30 minutes'), (60, '60 minutes'), (90, '90 minutes'),
                               (120, '120 minutes'), (150, '150 minutes'), (180, '180 minutes')]},
    'htv-ontimer': H,
    'offtimer1': {},
    'offtimer1-setup': {},
    'offtimer1-weekcheckbox': H,    # checkbox row, shown only for Setup = Manual
    'offtimer1-timer': {'valueText': '00:00', 'disabled': True},
    'sm-standby-mode-timer': H,
    'broadcasting-smartmonitor': H,
    'broadcasting': H,              # no tuner
    'security': {},
    'parental-lock': {'value': 0},
    'program-rating-lock-atsc': H,
    'program-rating-lock-dvb': H,
    'adult-genre_enable': H,
    'adult-content-lock': {},
    'channel-lock-settings': {},
    'app-lock-settings': {},
    'adult-content-lock-kr': H,
    'external-device-manager': {},
    'hdmicec': {'title': 'Anynet+ (HDMI-CEC)', 'noChildren': True},
    'universal-remote-setup': H,    # mbr.power_off_sync=false
    'cable-box-ip-remote': H,
    'hdmi-uhd-color': H,            # hdmi_uhd_color_support=false
    'sm-auto-source-switching': H,
    'hdmi-black-level': {'options': [(0, 'Auto'), (1, 'Low'), (2, 'Normal')]},
    'av-color-system': H,
    'media-switching-settings': H,  # hdmi.quick_media_switching_support=false
    'setuptime': {},
    'clockmode': {},
    'dateset': {'disabled': True},
    'timeset': {'disabled': True},
    'timeoffset': {},
    'timezone': H,
    'timezonemode': H,
    'gmt': H,
    'dst-dvb': H,
    'dst-atsc': H,
    'osd-language': {'options': [('en_US', 'English'), ('es_US', 'Español'), ('fr_FR', 'Français'),
                                 ('pt_BR', 'Português'), ('de_DE', 'Deutsch'), ('ru_RU', 'Русский'),
                                 ('ar_AE', 'العربية'), ('ko_KR', '한국어'), ('zh_CN', '简体中文')],
                     'value': 'en_US'},
    'menustyle': {},
    'device-manager': {},
    'keyboard-settings': {'title': 'Keyboard Settings'},
    'keyboard-language': {'title': 'Keyboard Language',
                          'options': [('en_US', 'English'), ('es_ES', 'Español'), ('fr_FR', 'Français'),
                                      ('pt_PT', 'Português'), ('de_DE', 'Deutsch'), ('ko_KR', '한국어')]},
    'keyboard-type': {'title': 'Keyboard Type', 'options': [('en_US.usa_ibm103p', 'English (US)')]},
    'mouse-settings': {},
    'mouse-pointer-size': {'options': [(0, 'Small'), (1, 'Medium'), (2, 'Large')], 'value': 1},
    'primary-button': {},
    'pointer-speed': {},
    'remote-control': H,            # Smart Remote page; nothing paired and every child hidden here
    'light-effect': H,
    'sound-feedback': {'options': [(0, 'Off'), (1, 'Low'), (2, 'Medium'), (3, 'High')]},
    'outdoor-mode': H,
    'htv-button-lock': H, 'htv-usb-lock': H, 'ep-zero-configuration': H, 'ep-smartthings-settings': H,
    'usemode': {},
    'shoplogo': H,
    'change-pin': {},
    'self-diagnosis-reset': {},
    'resetpsiditem-cn': H,

    # ---- Support
    'tdm': {'title': 'Device Care', 'noChildren': True},
    'maintenance-mode': H,
    'remote-management': H,
    'softwareupdate': {'title': 'Software Update'},
    'updatenow': {'title': 'Update Now'},
    'autoupdate': {'title': 'Auto Update'},
    'cellular': H, 'searchmodels': H, 'orsay': H, 'osupgrade': H,
    'tips-and-guides': {},
    'settings-menu-guide': {'value': 1},  # vconf db/menu/settings_menu_guide=True
    'connection-guide': {},
    'remote-key-guide': {},
    'game-controller-guide': H,     # vconf db/gamehome/gpdtutorial_menu_config is empty
    'e-manual': {'title': 'Open User Guide'},
    'touch-guide': H,
    'contact-samsung': {'title': 'About This TV', 'noChildren': True},
}

STYLE = {'category': 'category', 'title': 'title', 'title.value': 'title.value', 'title.switch': 'title.switch',
         'title.slider.value': 'title.slider.value', 'icon.title.icon': 'title.icon',
         'title.value.description': 'title.value', 'title.long.value': 'title.value'}
APP_UI = {'application', 'ui-gadget', 'ugitem'}
KEEP_UI = {'popup.reset', 'popup.changepin', 'page.balance', 'page.equalizer', 'page.menustyle',
           'page.zoomposition', 'spin.time', 'spin.date', 'spin', 'application', 'ui-gadget',
           'page.ris.optionlist', 'window.calibration', 'popup.pixelrefresh'}

missing = []
stats = {'pages': 0, 'rows': 0}
vconf_used = []


def vconf_default(key):
    if not key or not key.startswith(('db/', 'memory/')):
        return None
    if key not in VC:
        return None
    t, v = VC[key]
    if t == 'i':
        return int(v)
    if t == 'b':
        return 1 if v == 'True' else 0
    if t == 'd':
        return float(v)
    return v


def build(iid):
    dec = D.get(iid, None)
    if dec is None:
        missing.append(iid)
        return None
    if dec is False:
        return None
    it = item(iid)
    su = it.get('setting-ui') or {}
    ui = su.get('style')
    data = it.get('data') or {}
    m = {'id': iid}
    title = dec.get('title') or L(it.get('display-name'))
    if not title or title == 'Json Syntax Error':
        raise SystemExit('no title for %s' % iid)
    m['title'] = title
    style = dec.get('style') or STYLE.get(it.get('style'), 'title')
    if ui == 'switch' and style == 'title.value':
        style = 'title.switch'
    m['style'] = style

    # options
    opts = None
    if 'options' in dec:
        opts = dec['options']
    elif data.get('list'):
        opts = [(num(e['value']), L(e.get('display-value'))) for e in data['list']]
    if style == 'title.switch':
        opts = opts or OFFON
        # Off first, On second
        opts = sorted(opts, key=lambda o: o[0])
        opts = [(o[0], 'Off' if o[0] == 0 else 'On') for o in opts]
    is_picker = ui in ('popup.optionlist', 'popup.icon.optionlist')
    if is_picker:
        m['picker'] = True
    if opts and style != 'category':
        if style == 'title.value' or style == 'title.switch' or is_picker or dec.get('optionPage'):
            m['options'] = opts
    # value
    if 'value' in dec:
        val = dec['value']
    else:
        val = vconf_default(data.get('key'))
        if val is not None:
            vconf_used.append((iid, data.get('key'), val))
        elif m.get('options') and (is_picker or style in ('title.switch',) or dec.get('optionPage')):
            val = m['options'][0][0]
    if style == 'title.value' and not m.get('options') and 'value' not in dec:
        val = None  # sub-page or launcher row: its second line comes from valueText
    if val is not None and style not in ('category', 'title'):
        m['value'] = val
    if 'valueText' in dec:
        m['valueText'] = dec['valueText']
    # slider
    if style == 'title.slider.value':
        sl = data.get('slider') or {}
        for k in ('min', 'max', 'step'):
            v = dec.get(k)
            if v is None and k in sl:
                v = num(sl[k].get('value'))
            if v is None:
                raise SystemExit('slider %s missing %s' % (iid, k))
            m[k] = v
        if 'value' not in m:
            raise SystemExit('slider %s missing value' % iid)
    if dec.get('format'):
        m['format'] = dec['format']
    if dec.get('disabled'):
        m['disabled'] = True
    if ui in APP_UI:
        m['action'] = 'app'
    if ui in KEEP_UI:
        m['ui'] = ui
    if it.get('pinprompt') in ('true', True, '1'):
        m['pinPrompt'] = True
    ha = (it.get('help-animation') or {}).get('text')
    if 'help' in dec:
        if dec['help']:
            m['help'] = dec['help']
    elif ha and ha in S:
        m['help'] = S[ha]
    if dec.get('icon'):
        m['icon'] = dec['icon']

    # children
    if dec.get('optionPage'):
        m['groups'] = [[{'id': '%s/%s' % (iid, v), 'title': lab, 'style': 'option', 'value': v} for v, lab in m['options']]]
        stats['pages'] += 1
        stats['rows'] += len(m['groups'][0])
    elif iid in TREES and not dec.get('noChildren') and ui not in APP_UI:
        t = TREES[iid]
        groups = [g['group-items'] for g in t.get('group', [])] if t.get('group') else [t['submenuitems']]
        # every submenu item must appear in some group
        flat = [x for g in groups for x in g]
        extra = [x for x in t['submenuitems'] if x not in flat]
        if extra:
            groups.append(extra)
        out = []
        for g in groups:
            rows = [r for r in (build(c) for c in g) if r]
            if rows:
                out.append(rows)
                stats['rows'] += len(rows)
        if out:
            m['groups'] = out
            stats['pages'] += 1
        elif style != 'category':
            raise SystemExit('empty sub-page %s' % iid)
    return m


root = TREES['mainmenu']
main = [r for r in (build(c) for c in root['submenuitems']) if r]
if missing:
    print('UNDECIDED:', missing)
    raise SystemExit(1)

for k in vconf_used:
    print('vconf', k, file=sys.stderr)

# ---------------------------------------------------------------------------
# TypeScript emitter
# ---------------------------------------------------------------------------
BAD = ('·', '•')


def q(s):
    if isinstance(s, (int, float)) and not isinstance(s, bool):
        return repr(s)
    s = str(s)
    for b in BAD:
        if b in s:
            print('WARNING dot separator in', s, file=sys.stderr)
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


ORDER = ['id', 'title', 'style', 'picker', 'options', 'value', 'valueText', 'min', 'max', 'step', 'format',
         'disabled', 'disabledReason', 'action', 'ui', 'pinPrompt', 'help', 'icon']


def emit(m, ind):
    pad = '  ' * ind
    head = []
    tail = []
    for k in ORDER:
        if k not in m:
            continue
        v = m[k]
        if k == 'options':
            parts = ['{ value: %s, label: %s }' % (q(a), q(b)) for a, b in v]
            one = 'options: [' + ', '.join(parts) + ']'
            if len(one) + len(pad) < 150:
                tail.append(one)
            else:
                tail.append('options: [\n' + ''.join('%s    %s,\n' % (pad, p) for p in parts) + pad + '  ]')
        elif isinstance(v, bool):
            (head if k in ('picker',) else tail).append('%s: %s' % (k, 'true' if v else 'false'))
        elif k in ('id', 'title', 'style'):
            head.append('%s: %s' % (k, q(v)))
        else:
            tail.append('%s: %s' % (k, q(v)))
    first = ', '.join(head)
    if 'groups' not in m:
        one = '%s{ %s },\n' % (pad, ', '.join(head + tail))
        if len(one) <= 150 and all('\n' not in t for t in tail):
            return one
    s = '%s{\n%s  %s,\n' % (pad, pad, first)
    # options and help on their own lines; the short scalar fields share one line
    scal = [t for t in tail if not t.startswith(('options:', 'help:'))]
    rest = [t for t in tail if t.startswith(('options:', 'help:'))]
    if scal:
        s += '%s  %s,\n' % (pad, ', '.join(scal))
    for t in rest:
        s += '%s  %s,\n' % (pad, t)
    if 'groups' in m:
        s += '%s  groups: [\n' % pad
        for g in m['groups']:
            s += '%s    [\n' % pad
            for r in g:
                s += emit(r, ind + 3)
            s += '%s    ],\n' % pad
        s += '%s  ],\n' % pad
    s += '%s},\n' % pad
    return s


HEADER = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'menu_header.ts'), encoding='utf-8').read()
body = 'export const MAIN_MENU: MenuItem[] = [\n' + ''.join(emit(m, 1) for m in main) + ']\n'
open(OUT, 'w', encoding='utf-8').write(HEADER + '\n' + body)
print('pages', stats['pages'], 'rows', stats['rows'], 'categories', len(main))
