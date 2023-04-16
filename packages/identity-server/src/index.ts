import MatrixIdentityServer, {
  Utils as MUtils,
  type Config as MConfig,
  defaultConfig as MdefaultConfig
} from '@twake/matrix-identity-server'
import autocompletion from './lookup/autocompletion'
import { type ConfigDescription } from '@twake/config-parser'

export type Config = MConfig & {
  matrix_server: string
}
export type expressAppHandler = MUtils.expressAppHandler

export const defaultConfig = {
  ...MdefaultConfig,
  matrix_server: 'localhost'
}

export const Utils = MUtils

export default class TwakeIdentityServer extends MatrixIdentityServer {
  constructor(conf?: Partial<Config>, confDesc?: ConfigDescription) {
    if (confDesc == null) confDesc = defaultConfig
    super(conf, confDesc)
    const superReady = this.ready
    this.ready = new Promise((resolve, reject) => {
      superReady
        .then(() => {
          // Extend API
          this.api.post['/_twake/identity/v1/lookup/match'] = autocompletion(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
            // @ts-ignore this.db is defined here
            this.db,
            this.userDB
          )
          resolve(true)
        })
        .catch((e) => {
          /* istanbul ignore next */
          reject(e)
        })
    })
  }
}