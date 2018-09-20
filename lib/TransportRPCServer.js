'use strict'

const ws = require('ws')
const https = require('https')

const GrenacheWs = require('grenache-nodejs-ws')
const assert = require('assert')

class TransportRPCServer extends GrenacheWs.TransportRPCServer {
  listen (port) {
    assert(Number.isInteger(port), 'port must be an Integer')

    this.listening()

    const socket = this.getSocket(port, this.conf)
    socket.on('connection', (socket, req) => {
      const cert = req.connection.getPeerCertificate()
      socket.on('message', data => {
        this.handleRequest({
          reply: (rid, err, res) => {
            this.sendReply(socket, rid, err, res)
          }
        },
        this.parse(data),
        cert
        )
      })
    })

    socket.on('close', () => {
      this.unlistening()
    })

    this.socket = socket
    this.port = port

    return this
  }

  handleRequest (handler, data, cert) {
    if (!data) {
      this.emit('request-error')
      return
    }

    const rid = data[0]
    const key = data[1]
    const payload = data[2]

    this.emit(
      'request', rid, key, payload,
      {
        reply: (err, res) => {
          handler.reply(rid, err, res)
        }
      },
      cert
    )
  }

  getSocket (port, conf) {
    const secure = conf.secure

    assert(Buffer.isBuffer(secure.key), 'conf.secure.key must be a Buffer')
    assert(Buffer.isBuffer(secure.cert), 'conf.secure.cert must be a Buffer')
    assert(Buffer.isBuffer(secure.ca), 'conf.secure.ca must be a Buffer')
    assert.strictEqual(typeof secure.verifyClient, 'function', 'conf.secure.verify must be a function')

    const opts = Object.assign({}, secure, { requestCert: true })
    const httpsServer = https.createServer(opts, (req, res) => {
      req.socket.write('')
      req.socket.end()
    }).listen(port)

    return new ws.Server({
      server: httpsServer,
      verifyClient: secure.verifyClient
    })
  }
}

module.exports = TransportRPCServer
