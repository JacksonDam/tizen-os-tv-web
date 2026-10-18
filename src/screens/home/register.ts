// Registers the home's apps: the placeholder for third-party apps launched from the Smart Hub.
import { registerApp } from '../../apps/registry'
import { StubAppScreen } from './StubAppScreen'

registerApp('webapp', StubAppScreen)
