import { createRequestHandler } from '@remix-run/express'
import AppServer from '@twake/matrix-application-server'
import TomServer from '@twake/server'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const appServerConf = {
  base_url: process.env.BASE_URL,
  sender_localpart: process.env.SENDER_LOCALPART,
  registration_file_path: process.env.REGISTRATION_FILE_PATH,
  namespaces: process.env.NAMESPACES,
  push_ephemeral: process.env.PUSH_EPHEMERAL || true
}

let conf = {
  ...appServerConf,
  additional_features: process.env.ADDITIONAL_FEATURES || false,
  cron_service: process.env.CRON_SERVICE || true,
  database_engine: process.env.DATABASE_ENGINE,
  database_host: process.env.DATABASE_HOST,
  database_name: process.env.DATABASE_NAME,
  database_user: process.env.DATABASE_USER,
  database_ssl: process.env.DATABASE_SSL
    ? JSON.parse(process.env.DATABASE_SSL)
    : false,
  database_password: process.env.DATABASE_PASSWORD,
  federation_servers: process.env.FEDERATION_SERVERS
    ? process.env.FEDERATION_SERVERS.split(/[,\s]+/)
    : [],
  hashes_rate_limit: process.env.HASHES_RATE_LIMIT,
  is_federation_server: false,
  jitsiBaseUrl: process.env.JITSI_BASE_URL,
  jitsiJwtAlgorithm: process.env.JITSI_JWT_ALGORITHM,
  jitsiJwtIssuer: process.env.JITSI_JWT_ISSUER,
  jitsiJwtSecret: process.env.JITSI_SECRET,
  jitsiPreferredDomain: process.env.JITSI_PREFERRED_DOMAIN,
  jitsiUseJwt: Boolean(process.env.JITSI_USE_JWT),
  ldap_base: process.env.LDAP_BASE,
  ldap_filter: process.env.LDAP_FILTER,
  ldap_user: process.env.LDAP_USER,
  ldap_password: process.env.LDAP_PASSWORD,
  ldap_uri: process.env.LDAP_URI,
  matrix_server: process.env.MATRIX_SERVER,
  matrix_database_engine: process.env.MATRIX_DATABASE_ENGINE,
  matrix_database_host: process.env.MATRIX_DATABASE_HOST,
  matrix_database_name: process.env.MATRIX_DATABASE_NAME,
  matrix_database_password: process.env.MATRIX_DATABASE_PASSWORD,
  matrix_database_user: process.env.MATRIX_DATABASE_USER,
  matrix_database_ssl: process.env.MATRIX_DATABASE_SSL
    ? JSON.parse(process.env.MATRIX_DATABASE_SSL)
    : false,
  oidc_issuer: process.env.OIDC_ISSUER,
  opensearch_ca_cert_path: process.env.OPENSEARCH_CA_CERT_PATH,
  opensearch_host: process.env.OPENSEARCH_HOST,
  opensearch_is_activated: process.env.OPENSEARCH_IS_ACTIVATED || false,
  opensearch_max_retries: +process.env.OPENSEARCH_MAX_RETRIES || null,
  opensearch_number_of_shards: +process.env.OPENSEARCH_NUMBER_OF_SHARDS || null,
  opensearch_number_of_replicas:
    +process.env.OPENSEARCH_NUMBER_OF_REPLICAS || null,
  opensearch_password: process.env.OPENSEARCH_PASSWORD,
  opensearch_ssl: process.env.OPENSEARCH_SSL || false,
  opensearch_user: process.env.OPENSEARCH_USER,
  opensearch_wait_for_active_shards:
    process.env.OPENSEARCH_WAIT_FOR_ACTIVE_SHARDS,
  pepperCron: process.env.PEPPER_CRON || '9 1 * * *',
  rate_limiting_window: process.env.RATE_LIMITING_WINDOW || 600000,
  rate_limiting_nb_requests: process.env.RATE_LIMITING_NB_REQUESTS || 100,
  server_name: process.env.SERVER_NAME,
  template_dir:
    process.env.TEMPLATE_DIR ||
    path.join(__dirname, 'node_modules', '@twake', 'server', 'templates'),
  update_federation_hashes_cron:
    process.env.UDPATE_FEDERATION_HASHES_CRON || '*/10 * * * *',
  update_users_cron: process.env.UPDATE_USERS_CRON || '*/10 * * * *',
  userdb_engine: 'ldap',
  sms_api_key: process.env.SMS_API_KEY,
  sms_api_login: process.env.SMS_API_LOGIN,
  sms_api_url: process.env.SMS_API_URL
}

if (process.argv[2] === 'generate') {
  // eslint-disable-next-line no-unused-vars
  const appServer = new AppServer(appServerConf)
} else {
  const app = express()
  const trustProxy = process.env.TRUSTED_PROXIES
    ? process.env.TRUSTED_PROXIES.split(/\s+/)
    : []
  if (trustProxy.length > 0) {
    conf.trust_x_forwarded_for = true
    app.set('trust proxy', ...trustProxy)
  }
  const tomServer = new TomServer(conf)
  const promises = [tomServer.ready]

  if (process.env.CROWDSEC_URI) {
    if (!process.env.CROWDSEC_KEY) {
      throw new Error('Missing CROWDSEC_KEY')
    }
    promises.push(
      new Promise((resolve, reject) => {
        import('@crowdsec/express-bouncer')
          .then((m) =>
            m.default({
              url: process.env.CROWDSEC_URI,
              apiKey: process.env.CROWDSEC_KEY
            })
          )
          .then((crowdsecMiddleware) => {
            app.use(crowdsecMiddleware)
            resolve()
          })
          .catch(reject)
      })
    )
  }

  app.use(
    '/build',
    express.static(path.join(process.cwd(), 'landing', 'public', 'build'), {
      immutable: true,
      maxAge: '1y'
    })
  )

  app.use(
    express.static(path.join(process.cwd(), 'landing', 'public'), {
      maxAge: '1h'
    })
  )

  app.get(
    '/',
    createRequestHandler({
      build: await import(
        path.join(process.cwd(), 'landing', 'build', 'index.js')
      )
    })
  )

  Promise.all(promises)
    .then(() => {
      app.use(tomServer.endpoints)
      const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000
      console.log(`Listening on port ${port}`)
      app.listen(port)
    })
    .catch((e) => {
      throw e
    })
}
