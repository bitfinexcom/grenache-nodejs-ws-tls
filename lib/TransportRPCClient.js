'use strict'

const GrenacheWs = require('grenache-nodejs-ws')
const Ws = require('ws')
const assert = require('assert')

class TransportRPCClient extends GrenacheWs.TransportRPCClient {
  connect () {
    const dest = `wss://${this.conf.dest}/ws`

    if (this.isConnected()) {
      return this.cbq.trigger('req')
    }

    if (this.isConnecting()) return

    this.disconnect()
    this.connecting()

    const socket = this.socket = this.getSocket(dest, this.conf)

    socket.on('message', (data) => {
      data = this.parse(data)
      if (!data) return

      const [rid, _err, res] = data
      this.handleReply(rid, _err ? new Error(_err) : null, res)
    })

    socket.on('open', () => {
      this.connected()
      this.cbq.trigger('req')
    })

    socket.on('close', () => {
      this.disconnected()
      this.cbq.trigger('req', new Error('ERR_TRANSPORT_CLOSE'))
    })
  }

  getSocket (dest, conf) {
    const secure = conf.secure

    assert(Buffer.isBuffer(secure.key), 'conf.secure.key must be a Buffer')
    assert(Buffer.isBuffer(secure.cert), 'conf.secure.cert must be a Buffer')
    assert(Buffer.isBuffer(secure.ca), 'conf.secure.ca must be a Buffer')

    const socket = this.socket = new Ws(dest, secure)
    return socket
  }
}

module.exports = TransportRPCClient
