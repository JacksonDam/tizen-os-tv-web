# Tizen OS TV Web

A 1:1 web recreation of the Samsung 2025 TV interface (Tizen 9, firmware T-RSMFDEUC-0090), running the TV
frontend at native speed in a browser for testing without the TV or an emulator. It mocks the TV's
hardware: a tuner with a scanned channel lineup, two HDMI devices, volume and power.

**Live:** https://jacksondam.com/tizen-os-tv-web/

Built with Vite, React and TypeScript on a fixed 1920x1080 stage that scales to the window, with an
on-screen remote docked beside it.

## Run it

```
npm install
npm run dev          # open the printed URL
npm run build        # static site in dist/
```

## Remote

Use the on-screen remote or the keyboard:

| Keyboard | TV remote |
|---|---|
| Arrow keys | Up / Down / Left / Right |
| Enter, Space | OK |
| Esc, Backspace | Back |
| H, F5 | Home |
| X | Exit |
| Page Up / Page Down | Channel up / down |
| + / - | Volume up / down |
| M | Mute |
| 0-9 | Channel number |
| I | Info |
| S | Source (Connected Devices) |
| Q | Settings (Quick Settings) |
| L | Channel List |
| P | Power |

Automation hook: `window.__tv.press('Down')` sends a key. URL options: `?sub=0|1` pins the rotating
banner subtitle, `?remote=0` hides the on-screen remote, `?scanspeed=<n>` speeds up the channel scan.
State (settings, channels, volume, input) is kept in the browser's local storage.

## What is here

- **Smart Hub home** (`src/screens/home`): the page a signed-out TV shows before the Smart Hub terms are
  agreed. Top banner with Set Up Now, Discover, Now Playing with the live picture auto-playing, the On Now
  channel row, the sign-in banner, Media Options (Autoplay Sound), Move to top and the Knox logo, with the
  TV's scrolling, row morphing and focus motion.
- **Sidebar** (`src/screens/sidebar`): Search, Home, Connected Devices and Settings, with the TV's
  open/close motion.
- **Connected Devices** (`src/screens/system/ConnectedDevices.tsx`): TV, HDMI 1 (Game Console) and HDMI 2
  (Set-top Box) plus Help and Setup. Selecting an input shows the switch screen and the source banner.
- **Quick Settings** (`src/screens/system/QuickSettings.tsx`): tile pages with the TV's Lottie icons and
  value cycling, Sound Output / Bluetooth / LAN lists, the Brightness sliders and edit mode.
- **All Settings** (`src/screens/allsettings`): the settings card with every category and sub-page,
  including Broadcasting (Auto Tuning) under General & Privacy and the Support pages: About TV (real
  software version, mock model and serial), Software Update and Device Care.
- **Live TV** (`src/screens/livetv`): stand-in looping video for channels and inputs, the channel banner
  (CH keys, number entry), Info banner, volume bar and mute badge, source switch screen and banner,
  No Signal (Channel Scan Required), and the power-on animation.
- **Channels** (`src/screens/channels`): the Auto Tuning confirmation, the full-screen channel scan with
  mocked progress and a 38-channel result, and the channel list (categories, sorting, number entry).
- **UI sounds** (`src/tv/sound.ts`): the TV's own move / select / back / Home sounds, at the level set by
  General & Privacy > Sound Feedback.
- **Search** is a separate app whose payload is not in the firmware update, so OK shows the message the TV
  shows in that case.

Mocked hardware lives in `src/tv/store.ts` (state) and `src/tv/channels.ts` (lineup and programme guide).
Channel and device names are fictional; the videos in `public/video` are generated, not broadcast footage.

## How it was made

The TV's UI apps are .NET (NUI/DALi) and native EFL programs built on Samsung's FLUX component library.
They were decompiled from the firmware, and the layout, colours, fonts, timings, curves and sounds were
taken from that code and the theme data (1 FLUX unit = 8 px at 1080p, FLUX point sizes = CSS px). The home
screen and sidebar were checked against screenshots of the real firmware running in QEMU. Code comments
cite the specs written during that work (`spec/*.md`), which are not part of this repository.

Differences from the hardware: text uses a 0.2 px stroke to match how heavily the TV draws SamsungOne, and
apps the firmware would hand off to (sign-in, help, notifications, the Search app) are not included.

## Comparing with screenshots

```
node tools/shot.mjs "http://localhost:5173/?sub=0&remote=0" web.png --keys Left,Down
python3 tools/diff.py reference.png web.png diff.png
python3 tools/boxes.py reference.png web.png tools/regions/home-initial.json
```

`shot.mjs` captures at exactly 1920x1080 with headless Chrome (macOS path) and reports failed requests;
`diff.py` prints the mean pixel difference and writes reference | web | heat map; `boxes.py` compares
element bounding boxes. Reference screenshots come from the firmware running in QEMU and are not included.

## Disclaimer

Unofficial and not affiliated with Samsung. The images, animations, sounds and SamsungOne fonts in
`public/tv` and `public/sounds` come from Samsung TV firmware and remain the property of Samsung
Electronics; app logos shown in them belong to their respective owners.
