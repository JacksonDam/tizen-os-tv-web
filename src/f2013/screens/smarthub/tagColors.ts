// Colour tag colours (see ColorTag.tsx).

// HOMEPANEL_SUBMENU_MIRAGE_COLOR: two float RGBA points per panel id.
const MIRAGE: [number, number, number][][] = [
  [[0.2, 0.486275, 0.278431], [0.0901961, 0.376471, 0.168627]],      // Social
  [[0.152941, 0.258824, 0.537255], [0.0392157, 0.145098, 0.407843]], // On TV
  [[0.431373, 0.294118, 0.682353], [0.301961, 0.172549, 0.541176]],  // Films and TV Shows
  [[0.145098, 0.470588, 0.521569], [0.0352941, 0.352941, 0.403922]], // Apps
  [[0.6, 0.266667, 0.631373], [0.478431, 0.152941, 0.509804]],       // AllShare
  [[0.254902, 0.447059, 0.682353], [0.145098, 0.337255, 0.572549]],  // NewsON
  [[0.117647, 0.580392, 0.337255], [0.00784314, 0.470588, 0.227451]], // Games
  [[0.6, 0.266667, 0.631373], [0.478431, 0.152941, 0.509804]],       // Photos, Videos & Music
]

const css = ([r, g, b]: number[]) => `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`

export function colorTagColors(panel: number): [string, string] {
  const m = MIRAGE[panel] ?? MIRAGE[3]
  return [css(m[0]), css(m[1])]
}
