// Self Diagnosis data (com.samsung.SelfDiagnosis 2.0.39, spec3/diag.md 2): the tile list from the
// package's sd.json, the English (en-US resx) strings, and the in-memory result store that stands in for
// vconf memory/self-diagnosis/result (cleared when the page reloads, as the TV clears it at boot).

export type SDType = 'Automatic' | 'Manual'
export type SDItem = {
  name: string          // sd.json "name"
  label: string         // display name (SDTextResourceHelper.GetDisplayNameForSDItem)
  type: SDType
  icon: string          // self_diagnosis/<icon>
  app?: string          // web app id: sd.json AppToLaunch, or com.samsung.tv.hdmi-troubleshooting for HDMI Test
}

// sd.json order, kept only when the item's visibility checker passes on this TV (spec3/diag.md 2.2):
// Battery, IoT, Acceleration sensor, WOC, Camera, Driving sensors, DP and MICRO LED have no hardware here;
// Video Test is hidden because its factory test file (VideoTest/videos/4K) is not on the TV; HDMICEC is
// the hidden first stage of HDMI Test.
export const SD_ITEMS: SDItem[] = [
  { name: 'PowerStatus', label: 'Power', type: 'Automatic', icon: 'icon_sd_power.svg' },
  { name: 'SWVersion', label: 'SW Version Information', type: 'Automatic', icon: 'icon_sd_sw.svg' },
  { name: 'Picture', label: 'Picture Test', type: 'Manual', icon: 'icon_sd_pic.svg', app: 'picture-test' },
  { name: 'Sound', label: 'Sound Test', type: 'Manual', icon: 'icon_sd_sound.svg', app: 'sound-test' },
  { name: 'RemoteControl', label: 'Remote Control', type: 'Manual', icon: 'icon_sd_remote.svg', app: 'remote-guide' },
  { name: 'SmartHubConnection', label: 'Smart Hub Connection Test', type: 'Manual', icon: 'icon_sd_sc.svg', app: 'smarthub-connection-test' },
  { name: 'WiFi', label: 'Wi-Fi', type: 'Automatic', icon: 'icon_sd_wifi.svg' },
  { name: 'Bluetooth', label: 'Bluetooth', type: 'Automatic', icon: 'icon_sd_bt.svg' },
  { name: 'Eco', label: 'Light Sensor', type: 'Automatic', icon: 'icon_sd_light.svg' },
  { name: 'Mic', label: 'Mic Test', type: 'Automatic', icon: 'icon_sd_mic.svg' },
  { name: 'Signal', label: 'Broadcast Signal', type: 'Automatic', icon: 'icon_sd_sig.svg' },
  { name: 'HDMITroubleshooting', label: 'HDMI Test', type: 'Automatic', icon: 'icon_sd_hdmi.svg', app: 'hdmi-troubleshooting' },
]

export const SD = {
  title: 'Self Diagnosis',
  subtitle: 'Perform tests to ensure your TV is working properly. You can select each menu to test a function individually.',
  normal: 'Normal: ',
  actionRequired: 'Action required: ',
  leftToTest: (n: number) => `${n} left to test`,
  testAll: 'Test All',
  checking: 'Checking...',
  complete: 'Complete',
  testComplete: 'The test is complete.',
  resultsNormal: 'The test results are normal.',
  problem: "We've found a problem. Please contact the Samsung Call Center.",
  modelCode: (v: string) => `Model code: ${v}`,
  swVersion: (v: string) => `Software version: ${v}`,
  serial: (v: string) => `Serial number: ${v}`,
  checkHistory: 'Check History',
  checkSwVersion: 'Check SW Version',
  checkSignalInfo: 'Check Signal Info',
  hdmiCecCheck: 'HDMI-CEC Check',
  close: 'Close',
  cancel: 'Cancel',
  next: 'Next',
  powerStatus: 'Power Status',
  softwareVersion: 'Software Version',
  updateNow: 'Update Now',
  noHistory: 'No History',
  unavailable: "This function isn't available.",
  // ContinueDiagnoseAllPopup / SkipSingleDiagnosisItemPopup
  continueMsg: "You've completed some tests. You can either continue testing the untested items or restart and test all items",
  continue: 'Continue',
  restart: 'Restart',
  skipOrStop: 'Would you like to skip this test or stop the diagnosis?',
  skip: 'Skip',
  stop: 'Stop',
}

// ---- results (memory/self-diagnosis/result) ----

export type SDResult = 'pass' | 'fail'
const results = new Map<string, SDResult>()
let lastClicked = -1
const subs = new Set<() => void>()

export function getResult(name: string): SDResult | undefined {
  return results.get(name)
}
export function setResult(name: string, r: SDResult | undefined) {
  if (r) results.set(name, r)
  else results.delete(name)
  subs.forEach(f => f())
}
export function resetResults() {
  results.clear()
  subs.forEach(f => f())
}
export function subscribeResults(f: () => void) {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
export function getLastClicked() {
  return lastClicked
}
export function setLastClicked(i: number) {
  lastClicked = i
}

// ---- Test All run (SDSelfDiagnosisAllView): survives the hand-off to the manual test apps ----

export type TestAllRun = {
  auto: string[]        // automatic items still to run
  manual: string[]      // manual items still to launch (HDMI troubleshooting goes first)
  total: number
  done: number          // items started so far (the "n" of "n / total")
}
let run: TestAllRun | null = null
export function getRun() {
  return run
}
export function setRun(r: TestAllRun | null) {
  run = r
}

// How a test app reports back (app_control extras launchedFrom / DiagnosisType / action).
export type DiagArgs = { launchedFrom?: string; DiagnosisType?: 'Individual' | 'DiagnoseAll'; current?: string; total?: string }
export const SD_APP_ID = 'com.samsung.SelfDiagnosis'

// SDSelfDiagnosisAllView.PrepareItemForDiagnosisAll: the untested items, Automatic first; HDMI Test is a
// Manual hand-off here (no CEC line test on this TV) and goes first among the Manual ones.
export function prepareRun() {
  const auto: string[] = []
  const manual: string[] = []
  for (const it of SD_ITEMS) {
    if (getResult(it.name)) continue
    if (it.name === 'HDMITroubleshooting') manual.unshift(it.name)
    else if (it.type === 'Automatic') auto.push(it.name)
    else manual.push(it.name)
  }
  setRun({ auto, manual, total: auto.length + manual.length, done: 0 })
}
