import type { AppProps } from '../../shell'
import { AppRunner, type RunParams } from '../smarthub/online/hubapps/AppRunner'
import { GAMES, SOCIAL } from '../smarthub/data'
import './net.css'

// Samsung Account sign-in (app id 'samsungaccount'). exeDSP does not draw it: Menu > Smart Features >
// Samsung Account > Sign In closes the Menu (event 0x1b40) and the Settings app (0x51) runs the
// Smart Hub widget "_ACCOUNT_" with "SignIn" (CSettingAddMenuItem::CommonMenuSet_SignIn @01c7f5dc,
// CSettingAppBase::t_OnEvent @01c7b968 -> CSettingAppBase::RunWidget @01c7a4ac -> CInfoLink2Wrapper::
// RunWidget @0195fdf4, wrapper app 0x4d). The widget (the black "Welcome to Samsung Smart Account" page
// in the footage, EhQ9pDtWV4M 3:23) and the widget engine are not part of this firmware update, so the
// exhibit cannot show it: like any app the firmware cannot run here (the online round's rule for apps),
// it opens a plain screen with its name, and RETURN / EXIT leave it the way the TV leaves an app. No
// one signs in (the Smart Hub's account stays null).
// params { from: 'menu' | 'gamehub' | 'social' }: the Games and Social panels' "You must sign in ..."
// Yes (HomePanel 0xd8) return to their panel; the Menu's items return to the TV picture.

type AccountParams = { from?: 'menu' | 'gamehub' | 'social'; page?: 'SignIn' | 'TermsConditions' | 'CreateAccount' }

const ACCOUNT_NAME = 'Samsung Account'   // M (Smart Features > Samsung Account)

export function Account({ params, close }: AppProps) {
  const p = (params ?? {}) as AccountParams
  // the shared placeholder for apps the exhibit cannot run (src/f2013/screens/smarthub/online/hubapps/
  // AppRunner.tsx): the launch sequence, then the name; RETURN goes back to the panel it came from
  const run: RunParams = { id: 'samsung-account', name: ACCOUNT_NAME, from: p.from === 'gamehub' ? GAMES : p.from === 'social' ? SOCIAL : undefined }
  return <AppRunner params={run} close={close} />
}
