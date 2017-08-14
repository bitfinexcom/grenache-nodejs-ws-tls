// make sure you start 2 grapes
// grape --dp 20001 --apw 30001 --aph 30002 --bn '127.0.0.1:20002'
// grape --dp 20002 --apw 40001 --aph 40002 --bn '127.0.0.1:20001'

'use strict'

const { PeerRPCServer } = require('../')
const Link = require('grenache-nodejs-link')
const fs = require('fs')
const path = require('path')

const link = new Link({
  grape: 'http://127.0.0.1:30001'
})
link.start()

const opts = {
  secure: {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'server-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'server-crt.pem')),
    ca: fs.readFileSync(path.join(__dirname, 'certs', 'ca-crt.pem')),
    requestCert: true,
    rejectUnauthorized: false, // take care, can be dangerous in production!
    verifyClient: (info, cb) => {
      // console.log('--verifyClient---->', info.req.socket.getPeerCertificate())
      // cb(true) for success

      // cb(false) for failure -- code, name are optional

      // cb(sucess, code, name)
      // code {Number} When result is false this field determines the HTTP error status code to be sent to the client.
      // name {String} When result is false this field determines the HTTP reason phrase.
      // cb(false, 401, 'Forbidden')

      // eslint-disable-next-line
      cb(true)
    }
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
  link.announce('rpc_test', service.port, {})
}, 1000)

service.on('request', (rid, key, payload, handler, cert) => {
  console.log('client cert fingerprint:', cert.fingerprint)
  handler.reply(null, 'world')
})
