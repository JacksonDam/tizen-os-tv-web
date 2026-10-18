# Samsung TV interface museum

Working 1:1 recreations of Samsung TV interfaces, each rebuilt from its own firmware and running in the
browser. Every exhibit mocks the TV's hardware (a tuner with a fictional channel lineup, HDMI devices,
volume, power) so the whole interface can be used with the on-screen remote or the keyboard.

**Live:** https://jacksondam.com/tizen-os-tv-web/

| Exhibit | Page | Firmware |
|---|---|---|
| 2013 Smart Hub (F series, UE40F6400) | [`/2013/`](https://jacksondam.com/tizen-os-tv-web/2013/) | T-MST12DEUC 2130.0 |
| 2025 Tizen 9 (Neo QLED) | [`/2025/`](https://jacksondam.com/tizen-os-tv-web/2025/) | T-RSMFDEUC-0090 |

Built with Vite, React and TypeScript as a multi-page site: the lobby (`index.html`, `src/museum`) and
one page per exhibit (`2013/index.html` with `src/f2013`, `2025/index.html` with the rest of `src`).
Each TV is a fixed 1920x1080 stage that scales to the window, with an on-screen remote docked beside it
(`src/stage`, `src/remote`). The exhibits share the key router (`src/input/remote.ts`), the channel
lineup and programme guide (`src/tv/channels.ts`) and the stand-in video loops (`public/video`).

## Run it

```
npm install
npm run dev          # the lobby at the printed URL, the TVs at /2013/ and /2025/
npm run build        # static site in dist/
```

Links from before the museum (the root URL with `?setup=`, `?boot=` and the other 2025 options) are
forwarded to `/2025/`.

## 2013: Smart Hub (F series)

### Remote

| Keyboard | 2013 remote |
|---|---|
| Arrow keys | Up / Down / Left / Right |
| Enter, Space | ENTER |
| Esc, Backspace | RETURN |
| X | EXIT |
| H, F5 | SMART HUB |
| Q | MENU |
| T | TOOLS |
| I | INFO |
| G | GUIDE |
| L | CH LIST |
| S | SOURCE |
| R | PRE-CH |
| Page Up / Page Down | Channel up / down |
| + / - | Volume up / down |
| M | MUTE |
| 0-9 | Channel number |
| F1, F2, F3, F4 | A, B, C, D |
| P | POWER |

The PIN is 0000. URL options: `?remote=0` hides the on-screen remote, `?boot=0` skips the boot logo and
start-up wait, `?setup=1` runs Plug & Play (`?setup=0` cancels a pending one), `?scanspeed=<n>` runs the
channel scan n times faster. State is kept in the browser's local storage, separately from the 2025 TV.

### What is here

- **Power and boot** (`src/f2013/screens/setup`): every power-on shows the boot loader's "SMART TV" logo
  and five hexagons, then the TV's start-up wait. POWER toggles standby.
- **Plug & Play**: the welcome movie, Language, Configure your TV (country, channel source, network
  type), Auto Tuning with a mocked scan and Setup complete!, with the firmware's setup music. Without a
  network the Smart Hub terms are never agreed, so setup ends on live TV, as on the real set. It runs
  after a factory reset or with `?setup=1`.
- **Smart Hub** (`src/f2013/screens/smarthub`): what a TV that has never been online shows. The firmware
  falls back to a default panel list per country (UK: Games, Apps, Photos Videos & Music) on its 3D
  carousel, with the panel-move sound, the top menu and side arrows; each panel offers Set Up Smart Hub,
  which leads to the Welcome page and Network Settings.
- **Menu** (`src/f2013/screens/menu`): Picture, Sound, Broadcasting, Network, Smart Features, System and
  Support with their icon animations and help images; 208 items taken from the firmware's menu code for a
  UK DVB-T/T2 set, with popups, sliders, PIN, message boxes and timers. Picture settings tint the live
  picture. Network screens show no cable and no router in range; Self Diagnosis has the Picture Test,
  Sound Test, Signal Information and Reset (factory reset, then Plug & Play); Software Update and the
  Smart Hub items show the TV's offline messages; Contact Samsung shows the real software version.
- **Watching TV** (`src/f2013/screens/tvview`): channel banner with its dial, volume and mute OSDs,
  number entry, PRE-CH, No Signal, the radio screen, the INFO banner, Source (the F6400's nine inputs;
  HDMI1 has a game console and HDMI2/DVI a set-top box), Channel List, Guide and Tools.
- **UI sounds** (`src/f2013/tv/sound.ts`): the firmware's 48 kHz PCM sounds, addressed by its own sound
  ids, one at a time.

Not included: Smart Interaction (voice, gesture, camera), the web browser and apps, Samsung account,
the e-Manual (its content is on a partition the update doesn't carry), the Channel Manager, recording
and Anynet+.

### How it was made

The 2013 interface is drawn by one native ARM program, exeDSP, with its own 2D toolkit and a small 3D
engine for the Smart Hub. Its C++ symbol names survive, so each screen was rebuilt from Ghidra
decompilations of its window classes, the per-app image and text tables, and the layout constants
(some read by emulating the firmware's own set-up functions). Screens were compared with footage of real
2013 TVs, which is not included. Values not read from the firmware are marked "(inferred)" in the code.
The fonts (Samsung SVD) are subset to Latin. The F-series Fox-P firmware (T-FXPDEUC) could not be used
because its key has never been published; this exhibit uses the MStar F-series update instead.

## 2025: Tizen 9

A recreation of the Samsung 2025 TV interface (Tizen 9, firmware T-RSMFDEUC-0090), running the TV
frontend at native speed in a browser. It mocks a tuner with a scanned channel lineup, two HDMI devices,
a network, Bluetooth devices, volume and power.

### Remote

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
| `?terms=0` or `?terms=1` | opens the TV with the Smart Hub terms not agreed (the home before setup) or agreed |
| `?scanspeed=<n>` | runs the channel scan n times faster |
| `?timerspeed=<n>` | runs the sleep, off and auto power-off timers n times faster |

State (settings, channels, volume, input, network, schedules, notifications) is kept in the browser's
local storage; General & Privacy > Factory data reset clears it and runs first-time setup.

### What is here

- **Online** (`src/tv/online.ts`, `src/screens/connections/network.ts`): the TV starts connected to the
  fictional Wi-Fi network "Harbour View" with the Smart Hub terms agreed, so the full Smart Hub shows at
  once. Server content (banners, apps, films and shows) comes from the museum's fictional catalogue
  (`src/shared/fictional.ts`) with generated artwork; legal texts are a placeholder.
- **Smart Hub home** (`src/screens/home`), signed out: with the terms agreed, the immersive banner (server
  banners that spread to full screen with their video, or the firmware's default banner offline), Discover,
  Now Playing with the live picture auto-playing and the On Now channels, the app launcher (Live TV, the
  set-top box and the catalogue's apps, with Edit: Move and Remove), Continue Watching and Recommended for
  You rows, Media Options (Autoplay Sound), Move to top and the Knox logo. Before agreement it is the
  "Welcome. Start your Smart Hub!" page with Set Up Now and the sign-in banner, which start the Smart Hub
  setup (network if needed, then the terms). Launching an app shows the Smart Hub's loading screen, then a
  placeholder with the app's artwork and name (third-party apps are not in the firmware); Return comes back
  to the Smart Hub, Exit to the picture.
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
  connected devices, Wi-Fi network list and password, Smart Hub agreement, TV source, channel scan) ending
  with the end-of-setup movie, after which the Smart Hub fades in with its Home sound. It starts from a
  factory TV (no network, nothing agreed) and runs after Factory data reset or with `?setup=1`. Device
  Care > Reset Smart Hub withdraws the Smart Hub agreement.
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

### How it was made

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
node tools/shot.mjs "http://localhost:5173/2025/?sub=0&remote=0" web.png --keys Left,Down
python3 tools/diff.py reference.png web.png diff.png
python3 tools/boxes.py reference.png web.png tools/regions/home-initial.json
```

`shot.mjs` captures at exactly 1920x1080 with headless Chrome (macOS path) and reports failed requests and
page errors; besides key names, `--keys` takes `wait:ms`, `type:text`, `kbd:Key` and `eval:expression`
steps, and captures skip the boot logo unless the URL sets `boot=`;
`diff.py` prints the mean pixel difference and writes reference | web | heat map; `boxes.py` compares
element bounding boxes. Reference screenshots come from the firmware running in QEMU and are not included.

## Disclaimer

Unofficial and not affiliated with Samsung. The images, animations, sounds, music, welcome movie and
fonts in `public/f13`, `public/tv` and `public/sounds` come from Samsung TV firmware, and the 2025
end-of-setup movie
(`public/video/oobe_ending_2160p60.mp4`) from a capture of a Samsung TV; they remain the property of Samsung
Electronics. App logos shown in them belong to their respective owners.
