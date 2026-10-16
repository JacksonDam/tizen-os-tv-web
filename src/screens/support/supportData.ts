// Page data for the Support apps (spec2/device-sources-home.md A.2.4, A.2.7, A.3.3, A.5.10).
// Values marked "mock" are not in the firmware; the rest are this firmware's (T-RSMFDEUC-0090-1301.0).

export const DEVICE_NAME_SETTING = 'devicename' // vconf db/menu/network/devicename/tv_name

export type InfoLine = string | { heading: string }

export const ABOUT_TV = {
  title: 'About TV',
  deviceName: 'Samsung QN90F 65 TV', // mock
  nameMaxLength: 30,
  fields: [
    { label: 'Model Code', value: 'QE65QN90FATXXU' }, // mock
    { label: 'Serial Number', value: '0D7G3HBY600123W' }, // mock
    { label: 'S/W Version', value: 'T-RSMFDEUC-0090-1301.0' }, // real (prd_info.ini Version)
  ],
  heading: '#25A3BA',
  text: [
    'Please contact Samsung if you are having problems operating this device.',
    { heading: 'Contact Samsung' },
    'Visit www.samsung.com, then select your country.',
    'You can find the latest phone number of our Call Center on the website.',
    { heading: 'Smart Hub Information' },
    '- Unique ID: CVCK7XRE4YFJW', // mock
    '- Unique Device ID: P-RSMF25AHLQX4N', // mock
    { heading: 'Product Information' },
    '- User guide Version: ROPDVBEUF-1.250.0', // mock
    '- Wired MAC Address: 8c:ea:48:2a:91:5c', // mock
    '- Wireless MAC Address: 8c:ea:48:2a:91:5d', // mock
    '- Bluetooth Address: 8C:EA:48:2A:91:5E', // mock
  ] as InfoLine[],
  // COM_SID_SOFTWARE_INCLUDED_OPENSOURCE with the URL from 25_DTV_RoseM_0_WrittenOffer.txt (real)
  openSourceText:
    'The software included in this product contains open source software. You may obtain the complete corresponding source code for a period of three years after the last shipment of this product by sending an email to mailto:oss.request@samsung.com. It is also possible to obtain the complete corresponding source code in a physical medium such as a CD-ROM; a minimal charge will be required. The following URL http://opensource.samsung.com/opensource/25_DTV_RoseM_0/seq/0 leads to the download page of the source code made available and open source license information as related to this product. This offer is valid to anyone in receipt of this information.',
  qr: '25_DTV_RoseM_0.png', // real open-source QR; also the stand-in for the factory QR (mock)
}

export const SOFTWARE_UPDATE = {
  title: 'Update now',
  checking: 'Checking for updates…',
  cancel: 'Cancel',
  checkMs: 3500, // mock: the server check
  noUpdate: 'There are no new updates for you at the moment.',
  ok: 'OK',
}

export const DEVICE_CARE = {
  title: 'Device Care',
  checking: 'Checking your Device...',
  great: 'Great!',
  start: 'Start Device Care',
  options: [
    { id: 'storage', label: 'Manage Storage' },
    { id: 'selfdiag', label: 'Self Diagnosis' },
    { id: 'support', label: 'Request Support', disabled: true }, // no service-request disclaimer on this TV
    { id: 'reset', label: 'Reset Smart Hub' },
  ],
  unavailable: "This function isn't available.",
  inProgress: 'Device Care in progress...',
  processing: 'Processing',
  done: 'Done',
  items: [
    'Diagnose power on/off',
    'Diagnose picture quality',
    'Diagnose sound quality',
    'Diagnose external device connection',
    'Diagnose network connection',
    'Diagnose TV remote',
    'Diagnose broadcast signal and channel status',
    'Free up memory by closing unused background apps',
    'Diagnose storage and memory',
    'Free up memory by clearing cached memory',
  ],
  complete: 'Optimization and diagnostics are complete.',
  noProblems: 'Device Care detected no problems.',
  hint: 'If you are still encountering a problem, check Self Diagnosis for more assistance.',
}
