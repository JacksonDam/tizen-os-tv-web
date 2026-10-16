# Tizen OS TV Web

A 1:1 web recreation of the Samsung 2025 TV interface (Tizen 9, firmware T-RSMFDEUC-0090), running the TV
frontend at native speed in a browser for testing without the TV or an emulator. It mocks the TV's
hardware: a tuner with a scanned channel lineup, two HDMI devices, a network, Bluetooth devices, volume
and power.

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
| G | Guide |
| N | 123 (number pad and colour keys) |
| F1, F2, F3, F4 | Red, Green, Yellow, Blue |
| K (hold 1 s for the Game Bar) | Play/Pause |
| P | Power |

With a text field open (Settings search, Wi-Fi password, Edit Name), the computer keyboard types into it.
The PIN is 0000.

Automation hook: `window.__tv.press('Down')` sends a key. URL options:

| Option | Effect |
|---|---|
| `?sub=0` or `?sub=1` | pins the rotating banner subtitle |
| `?remote=0` | hides the on-screen remote |
| `?boot=0` | skips the cold boot (boot logo and power-on reveal) when the page opens |
| `?setup=1` | starts first-time setup (`?setup=0` cancels a pending one) |
| `?scanspeed=<n>` | runs the channel scan n times faster |
| `?timerspeed=<n>` | runs the sleep, off and auto power-off timers n times faster |

State (settings, channels, volume, input, network, schedules, notifications) is kept in the browser's
local storage; General & Privacy > Factory data reset clears it and runs first-time setup.

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
- **Power** (`src/screens/livetv/Overlays.tsx`): opening the page is a cold boot with the model's boot logo
  (Neo QLED, 900 ms), then welcome-mode's reveal with the Luxo boot chime (after a first click or key, as
  browsers require). Power off plays welcome-mode's white flash that closes to a line; with Voice Guide on
  it also plays the power-off sound.
- **Guide** (`src/screens/guide`): the TV's EPG (Guide key) with live picture, programme details, channel
  filter, number entry, View Details, Schedule Viewing with the reminder 5 minutes before (the TV then
  tunes), and the Schedule Manager. Programmes come from a deterministic full-day schedule in
  `src/tv/channels.ts`.
- **First-time setup** (`src/screens/setup`): the 2025 setup wizard with its music (language, country,
  connected devices, network, Smart Hub agreement, TV source, channel scan) ending with the end-of-setup
  movie, after which the Smart Hub fades in with its Home sound. It runs after Factory data reset or with
  `?setup=1`.
- **PIN** (`src/screens/setup`): PIN-protected settings ask for it (default 0000); Change PIN and Factory
  data reset are in General & Privacy.
- **On-screen keyboard** (`src/components/keyboard`): the TV's keyboard, used by Settings search, Wi-Fi
  passwords and Edit Name.
- **Connections** (`src/screens/connections`): Network Status, Network Settings (Wi-Fi list, password entry,
  wired, WPS, saved networks), Reset Network, the Wi-Fi switch, Bluetooth Device List (mocked scan and
  pairing), and Settings search.
- **Picture, timers and accessibility take effect** (`src/screens/av`): picture modes and Expert Settings
  filter the video; picture size and zoom; the Sound pages (Equalizer, Balance, Reset Sound) store their
  values; Sleep, Off and Auto Power Off timers; Auto Picture Off; Start with Smart Hub Home; Grayscale,
  High Contrast, Zoom Menu and Text.
- **Device Care** (`src/screens/diag`): Manage Storage, Self Diagnosis (12 tests with Test All), Picture
  Test, Sound Test, Smart Hub Connection Test, HDMI Troubleshooting, Signal Information and Reset Smart Hub.
  Results and sizes are mock values. Tips and User Guides: Connection Guide, Remote Control Guide (press the
  real key to play its animation) and Open User Guide.
- **123 pad** (`src/screens/extras/numpad`): the virtual remote's number and option pads; the buttons depend
  on the source.
- **Notifications** (`src/screens/extras/notifications`): the notification center from Quick Settings, with
  arrival banners, Delete All and Settings.
- **Game Bar** (`src/screens/extras/gamebar`): hold Play/Pause in Game Mode on an HDMI input.
- **Search** is a separate app whose payload is not in the firmware update, so OK shows the message the TV
  shows in that case.

Mocked hardware lives in `src/tv/store.ts` (state), `src/tv/channels.ts` (lineup and programme guide) and
the feature modules (network, Bluetooth, schedules, notifications). Channel, network and device names are
fictional; the channel videos in `public/video` are generated, not broadcast footage, and have no sound
(a TV's programme sound comes from the broadcast or the HDMI device, not the firmware).

Feature modules plug into the shell through registries rather than editing it: `registerApp`
(`src/apps/registry.ts`), `registerGadget` / `registerPopup` (`src/screens/allsettings/extensions.ts`),
`registerMenuPatch` (`src/screens/allsettings/menu.ts`), and `registerOverlay`, `registerTvKeyHandler`,
`registerPowerOnHook`, `registerPinPrompt` and the `shell` API (`src/tv/shell.ts`).

## How it was made

The TV's UI apps are .NET (NUI/DALi) and native EFL programs built on Samsung's FLUX component library.
They were decompiled from the firmware, and the layout, colours, fonts, timings, curves and sounds were
taken from that code and the theme data (1 FLUX unit = 8 px at 1080p, FLUX point sizes = CSS px). The home
screen and sidebar were checked against screenshots of the real firmware running in QEMU. Code comments
cite the specs written during that work (`spec/*.md`), which are not part of this repository.

Differences from the hardware: text uses a 0.2 px stroke to match how heavily the TV draws SamsungOne, and
apps whose code is not in the firmware update (Samsung account sign-in, the Search app, the store) are not
included. The end-of-setup movie is factory-installed on the TV rather than in the update; the one here is
a capture of the real TV's (YouTube `v8deoPhBRYU`, 0:01.75 to 0:16.5). Screens that could not be checked
against the real TV (the QEMU TV has no tuner, HDMI or network) were rebuilt from the decompiled code and
are marked "(inferred)" in the code where a value was not read from it.

## Comparing with screenshots

```
node tools/shot.mjs "http://localhost:5173/?sub=0&remote=0" web.png --keys Left,Down
python3 tools/diff.py reference.png web.png diff.png
python3 tools/boxes.py reference.png web.png tools/regions/home-initial.json
```

`shot.mjs` captures at exactly 1920x1080 with headless Chrome (macOS path) and reports failed requests and
page errors; besides key names, `--keys` takes `wait:ms`, `type:text`, `kbd:Key` and `eval:expression`
steps, and captures skip the boot logo unless the URL sets `boot=`;
`diff.py` prints the mean pixel difference and writes reference | web | heat map; `boxes.py` compares
element bounding boxes. Reference screenshots come from the firmware running in QEMU and are not included.

## Disclaimer

Unofficial and not affiliated with Samsung. The images, animations, sounds, music and SamsungOne fonts in
`public/tv` and `public/sounds` come from Samsung TV firmware, and the end-of-setup movie
(`public/video/oobe_ending.mp4`) from a capture of a Samsung TV; they remain the property of Samsung
Electronics. App logos shown in them belong to their respective owners.
