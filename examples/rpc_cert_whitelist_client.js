// make sure you start 2 grapes
// grape --dp 20001 --apw 30001 --aph 30002 --bn '127.0.0.1:20002'
// grape --dp 20002 --apw 40001 --aph 40002 --bn '127.0.0.1:20001'

'use strict'

const { PeerRPCClient, Link } = require('../')
const fs = require('fs')
const path = require('path')

const link = new Link({
  grape: 'http://127.0.0.1:30001'
})

link.start()

const secure = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'client1-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'client1-crt.pem')),
  ca: fs.readFileSync(path.join(__dirname, 'certs', 'ca-crt.pem')),
  rejectUnauthorized: false // take care, can be dangerous in production!
}

const peer = new PeerRPCClient(
  link,
  { secure: secure }
)

peer.init()

peer.request('rpc_whitelist_service', { action: 'ping' }, { timeout: 10000 }, (err, data) => {
  console.log(err, data) // logs: null 'ping action is allowed for this client'
})

// errors with forbidden error
peer.request('rpc_whitelist_service', { action: 'deleteHarddisk' }, { timeout: 10000 }, (err, data) => {
  console.log(err, data) // logs: Error: forbidden
})
