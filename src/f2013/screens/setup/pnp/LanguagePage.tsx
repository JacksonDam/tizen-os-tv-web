import { useEffect, useState } from 'react'
import { useRemote } from '../../../../input/remote'
import { F13 } from '../../../assets'
import { playUi, UI_SOUND } from '../../../tv/sound'
import { Wizard } from '../wizard/Wizard'
import { PNP_SMARTHUB_STEP, PNP_STEP, PNP_TOTAL, type PageProps } from './steps'
import { pnp, saveLanguage } from './state'
import { LANGUAGES, S } from './strings'

// Step 1: Language (CPlugPlayLanguageActionWindow, radio list type 5; spec/setup.md 3.2).
// 5 visible rows of 104 at list (176,308); OK on a row checks it and goes straight on
// (t_OnItemPress @025a9528, t_FlagAutomaticallyGoToNextStep); Next applies the checked language.
// At power-on only Next is shown (t_SetNaviButtonType @025a6758: 2) and RETURN/EXIT do nothing
// (t_CanExitWizardWindow @025a6818). The "Next" bubble stays up while the list has the focus.
// Right help (standard remote): Menu/device_language_low_1/_2 alternating 1500 ms
// (m_SetLanguageInfoImageFrame @025a741c, CCAnimatedImageDrawing 2 frames / 3000 ms) and M 0x96e.

const ROWS = 5
const PNP_IMG = `${F13}/setup/pnp`

export function LanguagePage({ hiding, go }: PageProps) {
  const [focus, setFocus] = useState<'list' | 'next'>('list')
  const [item, setItem] = useState(pnp.language)
  const [top, setTop] = useState(() => Math.max(0, Math.min(pnp.language, LANGUAGES.length - ROWS)))
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setFrame(f => 1 - f), 1500)
    return () => clearInterval(t)
  }, [])

  const next = (lang: number) => {
    pnp.language = lang
    saveLanguage()
    go('configure')
  }

  useRemote(key => {
    if (hiding) return true
    if (focus === 'list') {
      if (key === 'Up' || key === 'Down') {
        const i = key === 'Up' ? item - 1 : item + 1
        if (i < 0 || i >= LANGUAGES.length) return true
        setItem(i)
        if (i < top) setTop(i)
        else if (i >= top + ROWS) setTop(i - ROWS + 1)
        playUi(16)
      } else if (key === 'Enter') {
        playUi(UI_SOUND.SELECT)
        next(item)
      } else if (key === 'Right') {
        setFocus('next')
        playUi(16)
      }
      return true
    }
    if (key === 'Left') {
      setFocus('list')
      playUi(16)
    } else if (key === 'Enter') {
      playUi(UI_SOUND.SELECT)
      next(pnp.language)
    }
    return true
  })

  const listFocused = focus === 'list'
  return (
    <Wizard
      title={S.welcomeTitle}
      step={PNP_STEP.language}
      total={PNP_TOTAL}
      smartHubStep={PNP_SMARTHUB_STEP}
      next="normal"
      focus={listFocused ? 'content' : 'next'}
      bubble={listFocused ? 'next' : undefined}
      hiding={hiding}
      pageKey="language"
    >
      <div className="pnp-intro pnp-intro--list">{S.languageIntro}</div>
      <div className="wl">
        {top > 0 && <img className="wl__arrow wl__arrow--up" src={`${PNP_IMG}/indi_arrow_up_hi_s.png`} alt="" />}
        {LANGUAGES.slice(top, top + ROWS).map((name, k) => {
          const i = top + k
          const cls = !listFocused ? ' wl__row--dim' : i === item ? ' wl__row--focus' : ''
          return (
            <div key={i} className={`wl__row${cls}`} style={{ top: 102 + 104 * k }}>
              {listFocused && i === item && <div className="wl__focus" />}
              {i === pnp.language && (
                <img className={`wl__check${listFocused ? '' : ' wl__check--dim'}`} src={`${F13}/setup/popup/list_check_icon.png`} alt="" />
              )}
              <span className="wl__lang">{name}</span>
            </div>
          )
        })}
        {top + ROWS < LANGUAGES.length && <img className="wl__arrow wl__arrow--down" src={`${PNP_IMG}/indi_arrow_down_hi_s.png`} alt="" />}
      </div>
      <img className="pnp-langimg" src={`${PNP_IMG}/device_language_low_${frame + 1}.png`} alt="" />
      <div className="pnp-help pnp-help--lang">{S.languageHelp}</div>
    </Wizard>
  )
}
