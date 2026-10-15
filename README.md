# Tizen OS TV Web

A 1:1 web recreation of the Samsung 2025 TV interface (Tizen 9, firmware T-RSMFDEUC-0090): the Smart Hub
home screen, sidebar, Connected Devices, Quick Settings and All Settings. It runs the TV frontend at native
speed in a browser, for testing without the TV or an emulator.

**Live:** https://jacksondam.com/tizen-os-tv-web/

Built with Vite, React and TypeScript on a fixed 1920x1080 stage that scales to the window.

## Run it

```
npm install
npm run dev          # open the printed URL
npm run build        # static site in dist/
```

## Remote keys

| Keyboard | TV remote |
|---|---|
| Arrow keys | Up / Down / Left / Right |
| Enter, Space | OK |
| Esc, Backspace | Back |
| F5, H | Home |

Automation hook: `window.__tv.press('Down')` sends a key. `?sub=0` or `?sub=1` pins the rotating banner
subtitle.

## What is here

- **Home** (`src/screens/home`): the Smart Hub page as a signed-out TV shows it before the Smart Hub terms are
  agreed. It has the top banner with the app collage and Set Up Now, the Discover tab, Now Playing, the
  sign-in banner, Media Options (Autoplay Sound toggle), Move to top and the Knox logo, with the TV's row
  scrolling, row morphing and focus motion.
- **Sidebar** (`src/screens/sidebar`): fold and expand, the edge light, label slide-in, focus plate timing.
- **Connected Devices** (`src/screens/system/ConnectedDevices.tsx`): the preview popover and the entered page.
- **Quick Settings** (`src/screens/system/QuickSettings.tsx`): the Settings panel with 2x3 tile pages, the TV's
  Lottie icons and value cycling, level-2 lists (Sound Output, Bluetooth, LAN), the Brightness sliders, edit
  mode and the Notification button.
- **All Settings** (`src/screens/allsettings`): the settings card with the account card, search field, six
  categories and their sub-pages (title/value, switch, slider, dropdown and option rows). `menuData.ts` is
  generated from the TV's settings data by `tools/gen_menu.py`.
- **Search** is a separate app whose payload is not in the firmware update, so OK shows the message the TV
  shows in that case.
- **Live TV:** Back from Quick Settings or Connected Devices lowers the Smart Hub, and closing All Settings
  returns to live TV, as on the TV. There is no video, so that screen is black; press Home to bring the
  Smart Hub back.
- FLUX design tokens and shared components: `src/styles/tokens.css`, `src/styles/flux.css`, `src/components`.

## How it was made

The TV's UI apps are .NET (NUI/DALi) assemblies built on Samsung's FLUX component library. They were
decompiled from the firmware, and the layout, colours, fonts and animation curves were taken from that code
(1 FLUX unit = 8 px at 1080p, FLUX point sizes = CSS px). The results were checked against screenshots of the
real firmware running in QEMU. Code comments cite the specs written during that work (`spec/*.md`), which are
not part of this repository.

Differences from the hardware: text uses a 0.2 px stroke to match how heavily the TV draws SamsungOne, and
apps the firmware would launch (sign-in, setup, help, notifications) are not included.

## Comparing with screenshots

```
node tools/shot.mjs "http://localhost:5173/?sub=0" web.png --keys Left,Down
python3 tools/diff.py reference.png web.png diff.png
python3 tools/boxes.py reference.png web.png tools/regions/home-initial.json
```

`shot.mjs` captures at exactly 1920x1080 with headless Chrome (macOS path) and reports failed requests;
`diff.py` prints the mean pixel difference and writes reference | web | heat map; `boxes.py` compares
element bounding boxes. Reference screenshots come from the firmware running in QEMU and are not included.

## Disclaimer

Unofficial and not affiliated with Samsung. The images, animations and SamsungOne fonts in `public/tv` come
from Samsung TV firmware and remain the property of Samsung Electronics; app logos shown in them belong to
their respective owners.
