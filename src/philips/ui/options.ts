import type { RemoteKey } from '../../input/remote'
import { F, type Juice, W } from '../fw/juice'
import { getProp, setProp, type TvEnv } from './env'
import { P } from './props'
import { hide, isShown, repaint, show, timer, type Screen } from './screens'

// OPTION: the quick access overlay panel#326 (osdman#0 child at (0,0)), list#182 on property 0x6a3
// with a cursor apart from the value (+0x72 = 1). Values: 39 Audio language, 40 Subtitle language,
// 41 Subtitle, 47 None, 37 Picture format, 42 Equalizer, 45 PIP format, 46 Clock. Offered here: the
// items of a single-audio DVB-T set without PIP (inferred); Picture format opens panel#303 (list#171,
// property 0x71e: 44 Auto format, 57 Super zoom, 47 4:3, 52 Movie expand 14:9, 50 Movie expand 16:9,
// 58 Wide screen, 0 Unscaled, the last for HD and PC sources only, inferred). The other items close
// the overlay (their sub-screens are not part of the exhibit). Time-outs inferred.

const QA_LIST = W('list', 182)
const QA_PROP = 0x6a3
const QA_ITEMS = [39, 40, 41, 37, 42, 46]
const PF_LIST = W('list', 171)
const PF_VALUES = [44, 57, 47, 52, 50, 58]
const TIMEOUT = 10000

export class QuickAccess implements Screen {
  name = 'options'
  layer = 25
  osd = 326
  modal = true
  focus = QA_ITEMS.indexOf(37)

  draw(j: Juice, env: TvEnv) {
    env.allowedValues.set(QA_LIST, new Set(QA_ITEMS))
    const ids = j.listValueIds(QA_LIST)
    env.lists.set(QA_LIST, { focus: ids.indexOf(QA_ITEMS[this.focus]), top: 0, expanded: true })
    env.overrides.set(QA_PROP, QA_ITEMS[this.focus])
    j.draw(W('panel', 326), 0, 0, F.FOCUS)
  }
  key(k: RemoteKey) {
    timer('options', TIMEOUT, () => hide('options'))
    switch (k) {
      case 'Up': this.focus = Math.max(0, this.focus - 1); break
      case 'Down': this.focus = Math.min(QA_ITEMS.length - 1, this.focus + 1); break
      case 'Enter':
      case 'Right':
        hide('options')
        if (QA_ITEMS[this.focus] === 37) openPictureFormat()
        break
      case 'Tools':
      case 'Back':
      case 'Left':
      case 'Exit':
        hide('options')
        break
      default:
        return true
    }
    return true
  }
}

export class PictureFormat implements Screen {
  name = 'format'
  layer = 25
  osd = 303
  modal = true
  draw(j: Juice, env: TvEnv) {
    env.allowedValues.set(PF_LIST, new Set(PF_VALUES))
    const ids = j.listValueIds(PF_LIST)
    env.lists.set(PF_LIST, { focus: ids.indexOf(getProp(P.pictureFormat)), top: 0, expanded: true })
    j.draw(W('panel', 303), 0, 0, F.FOCUS)
  }
  key(k: RemoteKey) {
    timer('format', TIMEOUT, () => hide('format'))
    const i = Math.max(0, PF_VALUES.indexOf(getProp(P.pictureFormat)))
    switch (k) {
      case 'Up':
      case 'Down':
        // the format changes as the cursor moves (a plain list: the cursor is the value)
        setProp(P.pictureFormat, PF_VALUES[Math.max(0, Math.min(PF_VALUES.length - 1, i + (k === 'Down' ? 1 : -1)))])
        break
      case 'Enter':
      case 'Back':
      case 'Exit':
      case 'Tools':
        hide('format')
        break
    }
    return true
  }
}

export function openQuickAccess() {
  if (isShown('options')) return
  show(new QuickAccess())
  timer('options', TIMEOUT, () => hide('options'))
  repaint()
}
export function openPictureFormat() {
  show(new PictureFormat())
  timer('format', TIMEOUT, () => hide('format'))
  repaint()
}

// The picture of a 16:9 DVB broadcast in each format (CSS transform of the stand-in loop, inferred):
// Auto format and Wide screen fill the screen, 4:3 shows the frame in the 4:3 centre, the expands and
// Super zoom enlarge it.
export function formatTransform(v: number): string {
  switch (v) {
    case 47: return 'scaleX(0.75)'
    case 52: return 'scale(1.1667)'
    case 50:
    case 57: return 'scale(1.3333)'
    default: return 'none'
  }
}
