import type IdentityServerDb from '../db'
import { Authenticate, jsonContent, type expressAppHandler, validateParameters, send } from '../utils'
import { errMsg } from '../utils/errors'

const schema = {
  addresses: true,
  algorithm: false,
  pepper: false
}

const lookup = (db: IdentityServerDb): expressAppHandler => {
  const authenticate = Authenticate(db)
  return (req, res) => {
    authenticate(req, res, (data, id) => {
      jsonContent(req, res, (obj) => {
        validateParameters(res, schema, obj, (obj) => {
          if (typeof (obj as { addresses: string[] }).addresses !== 'object') {
            send(res, 400, errMsg('invalidParam'))
          } else {
            db.get('hashes', ['value', 'hash'], 'hash', (obj as { addresses: string[] }).addresses).then(rows => {
              // send(res, 200, rows)
              const mappings: Record<string, string> = {}
              rows.forEach(row => {
                // @ts-expect-error row.hash is not null
                mappings[row.hash] = row.value
              })
              send(res, 200, { mappings })
            }).catch(e => {
              send(res, 500, errMsg('unknown', e))
            })
          }
        })
      })
    })
  }
}

export default lookup