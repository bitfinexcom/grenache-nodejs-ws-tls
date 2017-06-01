// This server just allows clients with a whitelisted certificate
// to upgrade to a websocket connection.
//
// Additionally, it whitelists commands in the request handler
// depending on the certs fingerprint
//
// Make sure you start 2 grapes bfore running the server:
// grape --dp 20001 --apw 30001 --aph 30002 --bn '127.0.0.1:20002'
// grape --dp 20002 --apw 40001 --aph 40002 --bn '127.0.0.1:20001'

'use strict'

const { PeerRPCServer, Link } = require('../')
const fs = require('fs')
const path = require('path')

const link = new Link({
  grape: 'ws://127.0.0.1:30001'
})
link.start()

// this function is testing the cert before the ws connection
// with the client is established.
const VALID_FINGERPRINTS = [
  '22:48:11:0C:56:E7:49:2B:E9:20:2D:CE:D6:B0:7D:64:F2:32:C8:4B'
]

function verifyClient (info, cb) {
  const cert = info.req.socket.getPeerCertificate()

  if (VALID_FINGERPRINTS.indexOf(cert.fingerprint) !== -1) {
    // eslint-disable-next-line
    return cb(true)
  }

  // eslint-disable-next-line
  return cb(false, 401, 'Forbidden')
}

// bootstrap our server
const opts = {
  secure: {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'server-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'server-crt.pem')),
    ca: fs.readFileSync(path.join(__dirname, 'certs', 'ca-crt.pem')),
    requestCert: true,
    rejectUnauthorized: false, // take care, can be dangerous in production!
    verifyClient: verifyClient
  }
}
const peer = new PeerRPCServer(
  link,
  opts
)
peer.init()

const service = peer.transport('server')
service.listen(1337)

setInterval(function () {
  link.announce('rpc_whitelist_service', service.port, {})
}, 1000)

// this function is used to whitelist certain actions based on
// the fingerprint after the tls ws connection has established
// nobody is allowed to delete the harddisk, but one client is
// allowed to perform the ping action
const permissions = {
  deleteHarddisk: [],
  ping: [
    '22:48:11:0C:56:E7:49:2B:E9:20:2D:CE:D6:B0:7D:64:F2:32:C8:4B'
  ]
}

function isAllowedToPerformAction (action, fingerprint) {
  if (!permissions[action]) {
    return false
  }

  if (permissions[action].indexOf(fingerprint) !== -1) {
    return true
  }

  return false
}

// request handler which checks if the client is allowed to perform the
// current action. uses a whitelist and certificate fingerprints
service.on('request', (rid, key, payload, handler, cert) => {
  if (isAllowedToPerformAction(payload.action, cert.fingerprint)) {
    handler.reply(null, payload.action + ' action is allowed for this client')
    return
  }

  handler.reply(new Error('forbidden'))
})
