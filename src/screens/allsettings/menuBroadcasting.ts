import type { MenuItem, MenuOption } from './menuData'

// Rows that exist only on a TV with a tuner (spec2/channels.md section 1, TypeScript in 1.8): the
// Broadcasting page in General & Privacy plus the tuner rows on other pages. EU DVB-T2/C/S2 set,
// Antenna = Air, no CAM, watching a digital channel. "(inferred)" values are the spec's.

const OFFON: MenuOption[] = [{ value: 0, label: 'Off' }, { value: 1, label: 'On' }]

// Pan-European language list used by audio / subtitle / teletext language pickers (subset, inferred order)
const EU_LANGS: MenuOption[] = [
  { value: 'eng', label: 'English' }, { value: 'deu', label: 'German' }, { value: 'fra', label: 'French' },
  { value: 'ita', label: 'Italian' }, { value: 'spa', label: 'Spanish' }, { value: 'nld', label: 'Dutch' },
  { value: 'por', label: 'Portuguese' }, { value: 'swe', label: 'Swedish' }, { value: 'dan', label: 'Danish' },
  { value: 'fin', label: 'Finnish' }, { value: 'nor', label: 'Norwegian' }, { value: 'pol', label: 'Polish' },
  { value: 'ces', label: 'Czech' }, { value: 'hun', label: 'Hungarian' }, { value: 'ell', label: 'Greek' },
  { value: 'tur', label: 'Turkish' },
]

// Broadcasting page (broadcasting.json:L27336): [Auto Tuning] | [Common Interface] | [HbbTV Settings] | [Expert Settings].
const BROADCASTING: MenuItem = {
  id: 'broadcasting', title: 'Broadcasting', style: 'title',
  help: 'Configure broadcasting settings.',
  groups: [
    [
      {
        // Direct row (Air mode, 1.4). UgManualScan gadget {popup:true, gadgetId:'auto-program'}, exitmenu:
        // the confirmation popup over the panel, then the channel-search app. The JSON's pinprompt is
        // overridden by the provider and asks only when locked channels exist (none here), so no PIN.
        id: 'AutoTuningItem', title: 'Auto Tuning', style: 'title',
        action: 'app', ui: 'ui-gadget', popup: 'autotuning',
        help: 'Configure auto-tuning settings to scan and store channels.',
      },
    ],
    [
      {
        id: 'common-interface', title: 'Common Interface', style: 'title',
        disabled: true,                   // no CAM inserted (db/menu/support/commoninterface/enable = 0)
        groups: [
          [
            { id: 'cimenu', title: 'CI Menu', style: 'title', action: 'app', ui: 'ui-gadget',
              help: 'Show common interface menu information.' },
            { id: 'appinfo', title: 'Application Info', style: 'title', action: 'app', ui: 'ui-gadget',
              help: 'Show common interface application information.' },
          ],
        ],
      },
    ],
    [
      {
        id: 'data-service', title: 'HbbTV Settings', style: 'title',
        help: 'Set data service options.',
        groups: [
          [
            { id: 'data-service-new', title: 'HbbTV', style: 'title.switch', value: 1 /* (inferred) */, options: OFFON,
              help: 'Enable or disable data services.' },
            { id: 'do-not-track', title: 'Do Not Track', style: 'title.switch', value: 0, options: OFFON,
              help: 'Ask apps and services not to track your browsing activity.' },
            { id: 'persistent-storage-preference', title: 'Private Browsing', style: 'title.switch', value: 0, options: OFFON,
              help: 'Enable Private Browsing to stop the browser from saving your Internet history.' },
            { id: 'cookies', title: 'Delete Browsing Data', style: 'title', action: 'app', ui: 'ui-gadget',
              help: 'Delete all saved cookies.' },
          ],
        ],
      },
    ],
    [
      {
        id: 'broadcasting-expert-settings', title: 'Expert Settings', style: 'title',
        help: 'Configure advanced broadcasting settings.',
        groups: [
          [
            {
              // pinprompt is dynamic, as for Auto Tuning (no locked channels: no PIN)
              id: 'manual-tuning', title: 'Manual Scan', style: 'title',
              help: 'Manually enter the frequency to scan and save channel.',
              groups: [
                [
                  { id: 'manual-tuning-digital-air', title: 'Digital Channel Tuning', style: 'title',
                    action: 'app', ui: 'ui-gadget',   // UgManualScan {width:'Large', gadgetId:'digital-air'}
                    help: 'Manually scan digital channels.' },
                  { id: 'manual-tuning-analogue', title: 'Analogue Channel Tuning', style: 'title',
                    action: 'app', ui: 'ui-gadget',   // UgManualScan {width:'Large', gadgetId:'analogue'} (inferred visible)
                    help: 'Manually scan analogue channels.' },
                ],
              ],
            },
            {
              id: 'transfer-channel-list', title: 'Transfer Channel List', style: 'title', pinPrompt: true,
              help: 'Import or export channel list. A USB flash drive should be connected.',
              groups: [
                [
                  { id: 'import-from-usb', title: 'Import from USB', style: 'title', action: 'app', ui: 'ui-gadget',
                    disabled: true /* no USB drive (inferred) */, help: 'Import channel list from a USB flash drive.' },
                  { id: 'export-to-usb', title: 'Export to USB', style: 'title', action: 'app', ui: 'ui-gadget',
                    disabled: true /* no USB drive (inferred) */, help: 'Export channel list to USB.' },
                ],
              ],
            },
            {
              id: 'channelnumberedit', title: 'Edit Channel Numbers', style: 'title.value', picker: true,
              value: 0 /* (inferred) */,
              options: [{ value: 0, label: 'Disable' }, { value: 1, label: 'Enable' }],
              help: 'Select whether to enable or disable changing channel numbers. When a channel number is changed, the channel information is not updated automatically.',
            },
            {
              id: 'satellite-system', title: 'Satellite System', style: 'title', pinPrompt: true,
              help: 'Configure your satellite equipment parameters.',
              groups: [
                [
                  { id: 'satellite-selection', title: 'Satellite Selection', style: 'title', action: 'app', ui: 'ui-gadget',
                    help: 'Choose a satellite for signal reception.' },
                  { id: 'lnb-power', title: 'LNB Power', style: 'title.switch', value: 1 /* (inferred) */, options: OFFON,
                    help: 'Enable or disable power supply for LNB from receiver.' },
                  { id: 'lnb-settings', title: 'LNB Settings', style: 'title', action: 'none' /* sub-page not modelled */,
                    help: 'Configure your satellite equipment parameters.' },
                  { id: 'satcr-unicable-settings-2tuner', title: 'SatCR/Unicable', style: 'title', action: 'none',
                    help: 'Enable or disable single cable installation support.' },
                  { id: 'positioner-settings', title: 'Positioner Settings', style: 'title', action: 'none',
                    help: 'Configure your antenna positioner settings.' },
                  { id: 'reset-all-settings-satellite', title: 'Reset all settings', style: 'title', action: 'app', ui: 'ui-gadget',
                    help: 'Restore satellite system settings.' },
                ],
              ],
            },
          ],
          [
            { id: 'deleteoperatorprofile', title: 'Delete CAM Operator Profile', style: 'title', action: 'app', ui: 'ui-gadget',
              disabled: true, help: 'Select the CAM Operator to delete.' },
          ],
          [
            {
              id: 'teletextlanguagesettings', title: 'Teletext Language Settings', style: 'title.value',
              valueText: 'English' /* current channel's teletext language (inferred) */,
              help: 'Configure the teletext language settings.',
              groups: [
                [
                  { id: 'teletextlanguage', title: 'Teletext Language', style: 'title.value', picker: true,
                    value: 'eng', options: EU_LANGS, help: 'Set teletext language.' },
                  { id: 'primaryteletext', title: 'Primary Teletext Language', style: 'title.value', picker: true,
                    value: 'eng', options: EU_LANGS, help: 'Set the primary teletext language.' },
                  { id: 'secondaryteletext', title: 'Secondary Teletext Language', style: 'title.value', picker: true,
                    value: 'eng', options: EU_LANGS,
                    help: 'Set the secondary teletext language. If your primary teletext language is not supported, this language will be displayed.' },
                ],
              ],
            },
          ],
          [
            {
              id: 'audio-options-dvb', title: 'Audio Options', style: 'title',
              help: 'Configure your preferred audio options for viewing broadcasted content.',
              groups: [
                [
                  {
                    id: 'audio-language-dvb-entry', title: 'Audio Language Settings', style: 'title',
                    help: 'Select the type of Audio Language.',
                    groups: [
                      [
                        { id: 'audio-language-dvb', title: 'Audio Language', style: 'title.value', picker: true,
                          value: 0, options: [{ value: 0, label: 'English' }, { value: 1, label: 'English (AD)' }] /* mock tracks */,
                          help: 'Select the type of Audio Language.' },
                        { id: 'primary-audio-language', title: 'Primary Audio Language', style: 'title.value', picker: true,
                          value: 'eng', options: EU_LANGS, help: 'Set the primary audio language.' },
                        { id: 'secondary-audio-language', title: 'Secondary Audio Language', style: 'title.value', picker: true,
                          value: 'eng', options: EU_LANGS, help: 'Set the secondary audio language.' },
                      ],
                    ],
                  },
                  { id: 'broadcasting-audio-format', title: 'Audio Format', style: 'title.value', picker: true,
                    value: 0, options: [{ value: 0, label: 'MPEG' }, { value: 1, label: 'Dolby Digital' }] /* mock: formats of the current programme */,
                    help: 'Select audio format.' },
                ],
              ],
            },
          ],
        ],
      },
    ],
  ],
}

// Parental Settings G0 (1.7): DVB rating list, 255 Allow All then ages 4..18 (value = age - 3).
const PROGRAM_RATING_LOCK_DVB: MenuItem = {
  id: 'program-rating-lock-dvb', title: 'Program Rating Lock', style: 'title.value', picker: true, pinPrompt: true,
  value: 255,
  options: [
    { value: 255, label: 'Allow All' },
    ...Array.from({ length: 15 }, (_, i) => ({ value: i + 1, label: String(i + 4) })),
  ],
}

// Accessibility G2 (1.7): shown while a digital channel plays.
const SUBTITLE_SETTINGS: MenuItem = {
  id: 'subtitle', title: 'Subtitle Settings', style: 'title.value', valueText: 'Off',
  help: 'Set up Subtitles.',
  groups: [
    [
      { id: 'subtitle-setting', title: 'Subtitle', style: 'title.switch', value: 0, options: OFFON, help: 'Set Subtitles.' },
      { id: 'subtitlemode', title: 'Subtitle Mode', style: 'title.value', picker: true, value: 0, disabled: true /* while Subtitle is Off (inferred) */,
        options: [{ value: 0, label: 'Normal' }, { value: 1, label: 'Hearing Impaired' }], help: 'Choose a Subtitle Mode.' },
      { id: 'subtitlelanguage', title: 'Subtitle Language', style: 'title.value', picker: true, value: 'eng', disabled: true /* (inferred) */,
        options: [{ value: 'eng', label: 'English' }] /* mock: tracks of the current programme */, help: 'Choose Subtitle Language.' },
      { id: 'primarylanguage', title: 'Primary Subtitle Language', style: 'title.value', picker: true, value: 'eng', options: EU_LANGS,
        help: 'Choose primary subtitle language.' },
      { id: 'secondarylanguage', title: 'Secondary Subtitle Language', style: 'title.value', picker: true, value: 'eng', options: EU_LANGS,
        help: 'Choose secondary subtitle language.' },
    ],
  ],
}

// Picture > Expert Settings > Picture Size Settings (1.7), for a broadcast source.
const AUTO_WIDE: MenuItem = {
  id: 'picturesize-autowide', title: 'Auto Wide', style: 'title.switch', value: 0 /* (inferred) */, options: OFFON,
}
const FOUR_THREE_SCREEN_SIZE: MenuItem = {
  id: '43-picturesize', title: '4:3 Screen Size', style: 'title.value', picker: true, value: 0, disabled: true /* while Auto Wide is Off (inferred) */,
  options: [{ value: 0, label: '16:9 Standard' }, { value: 1, label: 'Zoom' }, { value: 2, label: '4:3' }] /* (inferred) */,
  help: 'When selected, programs will appear with a 4:3 aspect ratio.',
}

// Returns a copy of the tree with the item `id` (anywhere in it) replaced by fn(item).
function edit(items: MenuItem[], id: string, fn: (m: MenuItem) => MenuItem): MenuItem[] {
  return items.map(m => {
    const own = m.id === id ? fn(m) : m
    return own.groups ? { ...own, groups: own.groups.map(g => edit(g, id, fn)) } : own
  })
}

const has = (g: MenuItem[], id: string) => g.some(m => m.id === id)

// Where to splice (1.8 table). Groups are found by the row they hold, not by index. PIP is left out
// (model-dependent; avcontrol.check_pip_support=false in both featureconf columns).
export function patchBroadcasting(menu: MenuItem[]): MenuItem[] {
  let out = menu
  // General & Privacy: [Broadcasting, Parental Settings]
  out = edit(out, 'system', m => ({
    ...m,
    groups: m.groups?.map(g => (has(g, 'security') && !has(g, 'broadcasting') ? [BROADCASTING, ...g] : g)),
  }))
  // Parental Settings G0: after Parental Lock
  out = edit(out, 'security', m => ({
    ...m,
    groups: m.groups?.map(g => {
      const i = g.findIndex(r => r.id === 'parental-lock')
      return i < 0 || has(g, PROGRAM_RATING_LOCK_DVB.id) ? g : [...g.slice(0, i + 1), PROGRAM_RATING_LOCK_DVB, ...g.slice(i + 1)]
    }),
  }))
  // Accessibility: Subtitle Settings as its own group before the shortcut group
  out = edit(out, 'accessibility', m => {
    const groups = m.groups ?? []
    const i = groups.findIndex(g => has(g, 'accessibility-shortcut-settings'))
    if (i < 0 || groups.some(g => has(g, SUBTITLE_SETTINGS.id))) return m
    return { ...m, groups: [...groups.slice(0, i), [SUBTITLE_SETTINGS], ...groups.slice(i)] }
  })
  // Accessibility Shortcut gains "Subtitles On/Off" between values 1 and 5
  out = edit(out, 'accessibility-shortcut-settings', m => {
    const opts = m.options ?? []
    const i = opts.findIndex(o => o.value === 5)
    if (i < 0 || opts.some(o => o.value === 3)) return m
    return { ...m, options: [...opts.slice(0, i), { value: 3, label: 'Subtitles On/Off' }, ...opts.slice(i)] }
  })
  // Picture Size Settings: Auto Wide and 4:3 Screen Size after Picture Size
  out = edit(out, 'picturesize', m => ({
    ...m,
    groups: m.groups?.map(g => {
      const i = g.findIndex(r => r.id === 'picturesize-mode')
      return i < 0 || has(g, AUTO_WIDE.id) ? g : [...g.slice(0, i + 1), AUTO_WIDE, FOUR_THREE_SCREEN_SIZE, ...g.slice(i + 1)]
    }),
  }))
  return out
}
