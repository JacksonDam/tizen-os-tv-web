import { TV } from '../../assets'
import { Lottie } from '../../components/Lottie'

// OnSelectLoadingView (see appLaunch.ts): CC_Dim50 over the window and the large C_Loading_01 centred.
export function LaunchLoading() {
  return (
    <div className="launch-loading">
      <Lottie className="launch-loading__icon" src={`${TV}/flux/i_img_loading.json`} playing loop />
    </div>
  )
}
