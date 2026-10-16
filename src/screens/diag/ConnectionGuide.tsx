import { useState } from 'react'
import { useRemote } from '../../input/remote'
import { useMoveSound } from '../../tv/sound'
import { TV } from '../../assets'
import type { AppProps } from '../../apps/registry'
import { FluxScreen } from './ui'

// Connection Guide (org.tizen.connection-guide-app, spec3/diag.md 6): device categories with the
// theme's category icons (n / f), each category's connection methods with the QLED ("_Q") illustration
// from 2nd_level_source_image and the app's English steps (connection-guide-app.mo). The main.edj layout
// is not decompiled, so the arrangement on the connection_bg_01_base plate is inferred. HDMI
// Troubleshooting opens com.samsung.tv.hdmi-troubleshooting, as the guide's entry does.

const RES = `${TV}/support/connection`

type Method = { name: string; image: string; steps: string[] }
type Category = { icon: string; name: string; intro: string; methods: Method[]; app?: string }

const HDMI_STEPS = (device: string) => [
  `Plug one end of an HDMI cable into your ${device}’s HDMI output port.`,
  "Plug the other end of the cable into TV's HDMI port.",
  'Then, turn on the external device and enjoy the great picture quality.',
]

const CATEGORIES: Category[] = [
  {
    icon: 'cablebox', name: 'Video Device',
    intro: 'Connect external video devices, such as cable boxes, Blu-ray players, and DVD players, to your TV.',
    methods: [{ name: 'HDMI', image: 'video_device_hdmi', steps: HDMI_STEPS('external device') }],
  },
  {
    icon: 'audiodevice', name: 'Audio Device',
    intro: 'Connect audio devices, such as speakers, soundbars, headphones, or home theaters, to your TV.',
    methods: [
      {
        name: 'HDMI', image: 'audio_device_hdmi',
        steps: [
          'Turn on the audio device first, and then plug one end of the HDMI cable into your audio device’s HDMI port.',
          'Plug the other end of the cable into the HDMI port of your TV.',
        ],
      },
      {
        name: 'Bluetooth', image: 'audio_device_bluetooth',
        steps: [
          'Set your audio device to Bluetooth pairing mode. Pairing methods may differ depending on the device.',
          'In the pop-up window, select the Bluetooth device you want to connect to.',
        ],
      },
    ],
  },
  {
    icon: 'mobiledevice', name: 'Mobile Device',
    intro: 'Control your TV using your smartphone or tablet and view content stored in your mobile device on your TV screen.',
    methods: [
      {
        name: 'SmartThings', image: 'mobile_smartthings_app',
        steps: [
          'If SmartThings is not installed yet, download and run SmartThings app.',
          'Add the TV to SmartThings and enjoy the connected experience between your TV and mobile devices.',
        ],
      },
    ],
  },
  {
    icon: 'pc', name: 'PC',
    intro: "Connect your desktop or laptop to your TV to enjoy the content on the TV's big screen.",
    methods: [
      {
        name: 'HDMI', image: 'pc_screen_share_Wired_HDMI',
        steps: [
          ...HDMI_STEPS('PC').slice(0, 2),
          'If your PC does not support HDMI, use an HDMI-to-DVI cable to connect your PC to your TV. For more information, refer to the manual of the PC.',
        ],
      },
    ],
  },
  {
    icon: 'accessory', name: 'Input Device',
    intro: 'Connect an external input device, such as a keyboard, a mouse, or a gamepad, to easily control your TV.',
    methods: [
      {
        name: 'Bluetooth', image: 'input_device_keyboard',
        steps: [
          'Set the Bluetooth device you want to connect to pairing mode.',
          'In the pop-up window, select the Bluetooth device you want to connect to.',
          "For more information about pairing mode, refer to the Bluetooth device's user manual.",
        ],
      },
    ],
  },
  {
    icon: 'gameconsole', name: 'Game Console',
    intro: 'Connect game consoles, such as Xbox or PlayStation, to your TV.',
    methods: [{ name: 'HDMI', image: 'gameconsole_hdmi', steps: HDMI_STEPS('game console') }],
  },
  {
    icon: 'externalstorage', name: 'External Storage',
    intro: 'Connect a USB device to a USB port on your TV.',
    methods: [
      {
        name: 'USB', image: 'external_storage_usb',
        steps: [
          'Enjoy the content stored in your USB device on the TV screen.',
          'You can view the connected USB devices by going to Home > Sources.',
        ],
      },
    ],
  },
  {
    icon: 'cablebox', name: 'HDMI Troubleshooting',
    intro: 'Diagnose HDMI connection problems.', methods: [], app: 'hdmi-troubleshooting',
  },
]

export function ConnectionGuide({ onExit, launch }: AppProps) {
  const [cat, setCat] = useState(0)
  const [method, setMethod] = useState(0)
  const [inMethods, setInMethods] = useState(false)
  useMoveSound(`${cat}:${method}:${inMethods}`)
  const c = CATEGORIES[cat]
  const m = c.methods[method]

  useRemote(key => {
    if (key === 'Home') return false
    if (key === 'Exit') onExit('live')
    else if (key === 'Back') {
      if (inMethods) setInMethods(false)
      else onExit('settings')
    } else if (!inMethods) {
      if (key === 'Up') {
        setCat(Math.max(0, cat - 1))
        setMethod(0)
      } else if (key === 'Down') {
        setCat(Math.min(CATEGORIES.length - 1, cat + 1))
        setMethod(0)
      } else if ((key === 'Right' || key === 'Enter') && c.methods.length > 1) setInMethods(true)
      else if (key === 'Enter' && c.app) launch(c.app)
    } else {
      if (key === 'Up') setMethod(Math.max(0, method - 1))
      else if (key === 'Down') setMethod(Math.min(c.methods.length - 1, method + 1))
      else if (key === 'Left') setInMethods(false)
    }
    return true
  })

  return (
    <FluxScreen className="cg">
      <div className="cg__title">Connection Guide</div>
      <div className="cg__plate" style={{ backgroundImage: `url(${RES}/connection_bg_01_base.webp)` }}>
        <div className="cg__list">
          {CATEGORIES.map((x, i) => (
            <div key={x.name} className={`cg__cat ${i === cat ? (inMethods ? 'is-selected' : 'is-focused') : ''}`}>
              <img src={`${RES}/connection_icon_${x.icon}_${i === cat && !inMethods ? 'f' : 'n'}.webp`} alt="" />
              <span>{x.name}</span>
            </div>
          ))}
        </div>
        <div className="cg__detail">
          <div className="cg__intro">{c.intro}</div>
          {c.methods.length > 1 && (
            <div className="cg__methods">
              {c.methods.map((x, i) => (
                <div key={x.name} className={`flux-btn cg__method ${inMethods && i === method ? 'is-focused' : ''} ${i === method ? 'is-selected' : ''}`}>
                  {x.name}
                </div>
              ))}
            </div>
          )}
          {m && (
            <ol className="cg__steps">
              {m.steps.map(s => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}
          {c.app && <div className="flux-btn cg__open is-focused">HDMI Troubleshooting</div>}
        </div>
        {m && <img className="cg__image" src={`${RES}/${m.image}.webp`} alt="" />}
      </div>
    </FluxScreen>
  )
}
