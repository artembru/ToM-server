import configParser, { type ConfigDescription } from '@twake/config-parser'
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import { MatrixDB } from '@twake/matrix-identity-server'
import { Router } from 'express'
import fs from 'fs'
import AppServiceAPI from './application-server'
import defaultConfig from './config.json'
import initializeDb, { type TwakeDB } from './db'
import IdServer from './identity-server'
import mutualRoomsAPIRouter from './mutual-rooms-api'
import privateNoteApiRouter from './private-note-api'
import roomTagsAPIRouter from './room-tags-api'
import smsApiRouter from './sms-api'
import type { Config, ConfigurationFile, TwakeIdentityServer } from './types'
import userInfoAPIRouter from './user-info-api'
import VaultServer from './vault-api'
import WellKnown from './wellKnown'

export default class TwakeServer {
  conf: Config
  readonly logger: TwakeLogger
  endpoints: Router
  db?: TwakeDB
  matrixDb: MatrixDB
  ready!: Promise<boolean>
  idServer!: TwakeIdentityServer

  constructor(
    conf?: Partial<Config>,
    confDesc?: ConfigDescription,
    logger?: TwakeLogger
  ) {
    if (confDesc == null) confDesc = defaultConfig as ConfigDescription
    this.conf = configParser(
      confDesc,
      this._getConfigurationFile(conf)
    ) as Config
    this.logger = logger ?? getLogger(this.conf as unknown as LoggerConfig)
    this.matrixDb = new MatrixDB(this.conf, this.logger)
    this.idServer = new IdServer(
      this.matrixDb,
      this.conf,
      confDesc,
      this.logger
    )
    this.endpoints = Router()
    this.ready = new Promise<boolean>((resolve, reject) => {
      this._initServer(confDesc)
        .then(() => {
          if (
            process.env.ADDITIONAL_FEATURES === 'true' ||
            (this.conf.additional_features as boolean)
          ) {
            const appServiceApi = new AppServiceAPI(this, confDesc, this.logger)
            this.endpoints.use(appServiceApi.router.routes)
            this.logger.debug('Add application server')
          }
          this.logger.debug('End of initialization')
          resolve(true)
        })
        .catch((error) => {
          /* istanbul ignore next */
          this.logger.error(`Unable to initialize server`, { error })
          /* istanbul ignore next */
          reject(new Error('Unable to initialize server', { cause: error }))
        })
    })
  }

  cleanJobs(): void {
    this.idServer.cleanJobs()
    this.matrixDb.close()
  }

  private _getConfigurationFile(
    conf: Partial<Config> | undefined
  ): ConfigurationFile {
    if (conf != null) {
      return conf
    }

    /* istanbul ignore if */
    if (process.env.TWAKE_SERVER_CONF != null) {
      return process.env.TWAKE_SERVER_CONF
    }

    /* istanbul ignore if */
    if (fs.existsSync('/etc/twake/server.conf')) {
      return '/etc/twake/server.conf'
    }

    /* istanbul ignore next */
    return undefined
  }

  private async _initServer(confDesc?: ConfigDescription): Promise<boolean> {
    try {
      await this.idServer.ready
      this.logger.debug('idServer initialized')
      await this.matrixDb.ready
      this.logger.debug('Connected to Matrix DB')
      await initializeDb(this)
      this.logger.debug('Database initialized')

      const vaultServer = new VaultServer(
        this.idServer.db,
        this.idServer.authenticate
      )
      const wellKnown = new WellKnown(this.conf)
      const privateNoteApi = privateNoteApiRouter(
        this.idServer.db,
        this.conf,
        this.idServer.authenticate,
        this.logger
      )
      const mutualRoolsApi = mutualRoomsAPIRouter(
        this.conf,
        this.matrixDb.db,
        this.idServer.authenticate,
        this.logger
      )
      const roomTagsApi = roomTagsAPIRouter(
        this.idServer.db,
        this.matrixDb.db,
        this.conf,
        this.idServer.authenticate,
        this.logger
      )
      const userInfoApi = userInfoAPIRouter(
        this.idServer,
        this.conf,
        this.logger
      )

      const smsApi = smsApiRouter(
        this.conf,
        this.idServer.authenticate,
        this.logger
      )

      this.endpoints.use(privateNoteApi)
      this.endpoints.use(mutualRoolsApi)
      this.endpoints.use(vaultServer.endpoints)
      this.endpoints.use(roomTagsApi)
      this.endpoints.use(userInfoApi)
      this.endpoints.use(smsApi)

      Object.keys(this.idServer.api.get).forEach((k) => {
        this.endpoints.get(k, this.idServer.api.get[k])
      })
      Object.keys(this.idServer.api.post).forEach((k) => {
        this.endpoints.post(k, this.idServer.api.post[k])
      })
      this.endpoints.use(vaultServer.endpoints)
      Object.keys(wellKnown.api.get).forEach((k) => {
        this.endpoints.get(k, wellKnown.api.get[k])
      })
      this.logger.debug('Endpoints added')

      return true
    } catch (error) {
      /* istanbul ignore next */
      this.logger.error(`Unable to initialize server`, { error })
      /* istanbul ignore next */
      throw Error('Unable to initialize server', { cause: error })
    }
  }
}
