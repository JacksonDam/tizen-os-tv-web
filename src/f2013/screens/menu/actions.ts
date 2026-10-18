import { openApp } from '../../shell'
import { getTv, setSetting, setTv } from '../../tv/store'
import type { MenuItem } from './types'
import { defaultValue, getValue, optionText, setValue } from './values'
import type { MsgBox, Widget } from './widgets'

// What OK on a Menu item does. The kind comes from the emulated CMenuMainWindow::t_MenuItemController
// result baked into the tree (`ok`), the widget type from CMenuMainWidgetAgency::
// t_GetFirstShownWidgetInfo, message texts from t_GetMessageBoxCreateInfo / t_GetMessageBoxChangableText.

export type Ctx = {
  close: () => void                        // close the Menu
  enterChild: (it: MenuItem) => void
  refresh: () => void
  siblings: MenuItem[]                     // the items of the list the item is in
  factoryReset: () => void
}

// CMenuMainWidgetAgency::t_GetFirstShownWidgetInfo: 0 message box, 1 sublist, 2 input box, 3 control bar
const WIDGET_TYPE: Record<number, number> = {
  0x16: 0, 0x75: 0, 0x7d: 0, 0x90: 0, 0xe5: 0, 0xec: 0, 0x104: 0, 0x182: 3, 0x183: 3, 0x18b: 3, 0x196: 0,
  0x19b: 3, 0x1a6: 0, 0x1d1: 0, 0x237: 0, 0x289: 0, 0x2b8: 0, 0x2bd: 0, 0x2be: 0, 0x472: 0, 0x485: 0,
  0x486: 0, 0x4cd: 3, 0x518: 0, 0x6e9: 0, 0x7b8: 2, 0x7b9: 2, 0x912: 0, 0x913: 0,
}

const OK = ['OK']
const YES_NO = ['Yes', 'No']

function resetGroup(ids: number[]) {
  const s = { ...getTv().settings }
  for (const id of ids) delete s[`menu.${id}`]
  setTv({ settings: s })
}

const PICTURE_IDS = [0x24, 0x28, 0x2e, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x52, 0x4d, 0x91, 0x5f, 0x65, 0x69, 0x70, 0x71, 0x72,
  0x77, 0x78, 0x79, 0x7a, 0x7b, 0x7c, 0x5a, 0x12e, 0x2f, 0xb7, 0xc2, 0x487, 0xcb, 0xdc, 0xe3, 0xe4, 0x98, 0xbf, 0xd5]
const SOUND_IDS = [0x135, 0x168, 0x14b, 0x17b, 0x16b, 0x182, 0x183, 0x185, 0x18b, 0x18c]

// Message box sequences (texts from g_MenuWStringEng via the emulated create info)
function messages(it: MenuItem, ctx: Ctx, picMode: () => string): MsgBox[] | null {
  switch (it.id) {
    case 0xec:  // Reset Picture
      return [{ text: 'Reset Picture Settings?', buttons: YES_NO, onButton: b => {
        if (b !== 0) return null
        resetGroup(PICTURE_IDS)
        ctx.refresh()
        return { kind: 'msg', boxes: [{ text: '<<A>> mode reset to default setting.'.replace('<<A>>', picMode()), buttons: OK }] }
      } }]
    case 0x196:  // Reset Sound
      return [{ text: 'Reset sound settings?', buttons: YES_NO, onButton: b => {
        if (b !== 0) return null
        resetGroup(SOUND_IDS)
        ctx.refresh()
        return { kind: 'msg', boxes: [{ text: 'Sound reset to default setting.', buttons: OK }] }
      } }]
    case 0x7d:  // White Balance > Reset
      return [{ text: 'Reset White Balance?', buttons: YES_NO, onButton: b => {
        if (b !== 0) return null
        resetGroup([0x77, 0x78, 0x79, 0x7a, 0x7b, 0x7c])
        ctx.refresh()
        return { kind: 'msg', boxes: [{ text: 'White Balance reset to default settings.', buttons: OK }] }
      } }]
    case 0x75:  // Colour Space > Reset
      return [{ text: 'Reset Colour Space?', buttons: YES_NO, onButton: b => {
        if (b !== 0) return null
        resetGroup([0x65, 0x69, 0x70, 0x71, 0x72])
        ctx.refresh()
        return { kind: 'msg', boxes: [{ text: 'Colour space reset to default levels.', buttons: OK }] }
      } }]
    case 0xe5:  // Motion Plus > Reset (texts come from the Motion Plus item, not in the create info)
      return null
    case 0x237: case 0x2b8:  // Guide / Schedule Manager without a clock
      return null
    case 0x6e9:  // Self Diagnosis > Reset (after the PIN)
      return [{
        text: 'All settings, except network settings, will return to factory defaults.\nSmart Hub, and your data stored there, will not be affected.\nDo you want to continue?',
        buttons: YES_NO,
        onButton: b => {
          if (b !== 0) return null
          return { kind: 'msg', boxes: [{ text: 'All settings have been reset. The TV will now turn off and on again automatically.', timeout: 3000, onButton: () => { ctx.factoryReset(); return null } }] }
        },
      }]
  }
  return null
}

const APP_ITEMS: Record<number, () => void> = {
  0x1cf: () => openApp('autotune', { returnTo: 'menu', returnParams: { path: [0x1cf] } }),  // Auto Tuning
  0x21f: () => openApp('autotune', { returnTo: 'menu', returnParams: { path: [0x21f] }, mode: 'manual' }),  // Manual Tuning
  0x2b7: () => openApp('chlist', { from: 'menu' }),              // Channel List
  0x2b9: () => openApp('chlist', { from: 'menu', page: 'edit' }), // Edit Channel
  0x2ba: () => openApp('chlist', { from: 'menu', page: 'favourites' }),  // Edit Favourites
  0x237: () => openApp('guide', { from: 'menu' }),               // Guide
}

export function dimReason(it: MenuItem): Widget {
  // CMenuWidgetAgencyBase::ShowDimReasonMsgBox: CMenuMessageBox, OK button, hidden after 5 s
  return { kind: 'msg', item: it, boxes: [{ text: it.dis ?? "This function isn't available.", buttons: OK, timeout: 5000 }] }
}

export function itemAction(it: MenuItem, ctx: Ctx): Widget | null {
  const ok = it.ok ?? ''
  const picMode = () => optionText({ id: 0x16, t: '', o: [[0, 'Dynamic'], [1, 'Standard'], [7, 'Natural'], [2, 'Movie']] }, getValue({ id: 0x16, t: '' }))
  if (ok === 'child' && it.k?.length) {
    ctx.enterChild(it)
    return null
  }
  if (it.id === 0x2ce) {   // System > Setup: Plug & Play (CMenuUtil::DoActionBeforeShowPlugPlayWindow)
    ctx.close()
    openApp('pnp', { from: 'menu' })
    return null
  }
  if (it.id === 0x38) {    // Picture Off: picture off until a key is pressed (item help text)
    setSetting('menu.picture-off', 1)
    ctx.close()
    return null
  }
  if (APP_ITEMS[it.id]) {
    ctx.close()
    APP_ITEMS[it.id]()
    return null
  }
  if (ok.startsWith('hide action:')) {
    if (it.v) return { kind: 'sliderAW', item: it, items: ctx.siblings.filter(s => s.v && (s.ok ?? '').startsWith('hide action:') && s.en !== false) }
    if (it.o) return { kind: 'sublistAW', item: it }
  }
  if (ok.includes('pin:')) {
    return { kind: 'pin', item: it, then: () => afterPin(it, ctx, picMode) }
  }
  const wt = WIDGET_TYPE[it.id] ?? 1
  if (ok.includes('widget')) {
    if (wt === 0) {
      const m = messages(it, ctx, picMode)
      if (m) return { kind: 'msg', item: it, boxes: m }
      return null
    }
    if (wt === 3 && it.v) return { kind: 'bar', item: it }
    if (it.o?.length) return { kind: 'popup', item: it }
  }
  if (it.r === 2 && it.o?.length) return { kind: 'popup', item: it }
  if (ok === 'list' && it.o) return { kind: 'popup', item: it }
  return null
}

function afterPin(it: MenuItem, ctx: Ctx, picMode: () => string): Widget | null {
  if (it.id === 0x6e9) return { kind: 'msg', item: it, boxes: messages(it, ctx, picMode) ?? [] }
  if (it.o?.length) return { kind: 'popup', item: it }
  if (it.k?.length) {
    ctx.enterChild(it)
    return null
  }
  return null
}

export { defaultValue, setValue }
