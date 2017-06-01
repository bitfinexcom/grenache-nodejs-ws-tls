// make sure you start 2 grapes
// grape --dp 20001 --apw 30001 --aph 30002 --bn '127.0.0.1:20002'
// grape --dp 20002 --apw 40001 --aph 40002 --bn '127.0.0.1:20001'

'use strict'

const Base = require('grenache-nodejs-base')
const Peer = require('../').PeerRPCClient
const fs = require('fs')
const path = require('path')

const link = new Base.Link({
  grape: 'ws://127.0.0.1:30001'
})

link.start()

const secure = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'client1-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'client1-crt.pem')),
  ca: fs.readFileSync(path.join(__dirname, 'certs', 'ca-crt.pem')),
  rejectUnauthorized: false // take care, can be dangerous in production!
}

const peer = new Peer(
  link,
  { secure: secure }
)

peer.init()

const reqs = 10

setTimeout(() => {
  for (let i = 0; i < reqs; i++) {
    peer.map('rpc_test', 'hello', { timeout: 10000 }, (err, data) => {
      console.log(err, data)
    })
  }
}, 2000)
