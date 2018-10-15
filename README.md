# grenache-nodejs-ws-tls

<img src="logo.png" width="15%" />


## deprecated! grenache-nodejs-ws-tls is part of [grenache-nodejs-ws](https://github.com/bitfinexcom/grenache-nodejs-ws) now.

[grenache-nodejs-ws](https://github.com/bitfinexcom/grenache-nodejs-ws) with TLS support and optional payload validation based on client certificate.

Grenache is a micro-framework for connecting microservices. Its simple and optimized for performance.

Internally, Grenache uses Distributed Hash Tables (DHT, known from Bittorrent) for Peer to Peer connections. You can find more details how Grenche internally works at the [Main Project Homepage](https://github.com/bitfinexcom/grenache).

  - [Currently Supported](#currently-supported)
  - [Example](#example)
  - [API](#api)

## Currently Supported

```
PeerRPCClient
PeerRPCServer
```

## Example

This RPC Server example announces a service called
`rpc_whitelist_service` on the overlay network. When a client tries to
connect, we check on the serverside if the certificate fingerprint
matches the list of clients that we have whitelisted for connections,
using [the verifyClient callback](https://github.com/websockets/ws/blob/62cd03ea3705123136c20eedac1b57559d8ea542/doc/ws.md#new-websocketserveroptions-callback).

In case of a matching fingerprint, we establish the Websocket
connection.

The certificate data is also passed to the request handlers of the
server. That allows us to further define permissions for each client.

The fingerprint allows us to verify that just certain clients are
allowed to run a specific action. In the example the client is allowed
to run the `ping` command, but is not allowed to execute the action
`deleteHarddisk`.

Behind the scenes the DHT is asked for the IP of the server and then
the request is done as Peer-to-Peer request via Websockets.

**Server:**

```js
const Link = require('grenache-nodejs-link')

const link = new Link({
  grape: 'http://127.0.0.1:30001'
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
    return cb(true)
  }

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
```

**Client:**

```js
const Link = require('grenache-nodejs-link')
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

link.on('connect', () => {
  peer.request('rpc_whitelist_service', { action: 'ping' }, { timeout: 10000 }, (err, data) => {
    console.log(err, data) // logs: null 'ping action is allowed for this client'
  })

  // errors with forbidden error
  peer.request('rpc_whitelist_service', { action: 'deleteHarddisk' }, { timeout: 10000 }, (err, data) => {
    console.log(err, data) // logs: Error: forbidden
  })
})
```

[Server Code](https://github.com/bitfinexcom/grenache-nodejs-ws-tls/tree/master/examples/rpc_cert_whitelist_server.js)
<br/>
[Client Code](https://github.com/bitfinexcom/grenache-nodejs-ws-tls/tree/master/examples/rpc_cert_whitelist_client.js)


## API

### Class: PeerRPCServer

#### Event: 'request'

Emitted when a request from a RPC client is received.

  - `rid` unique request id
  - `key` name of the service
  - `payload` Payload sent by client
  - `handler` Handler object, used to reply to a client.

```js
service.on('request', (rid, key, payload, handler) => {
  handler.reply(null, 'world')
})
```

#### new PeerRPCServer(link, [options])

  - `link` &lt;Object&gt; Instance of a [Link Class](#new-linkoptions)
  - `options` &lt;Object&gt;
    - `secure` &lt;Object&gt; TLS options
      - `key` &lt;Buffer&gt; Key file content
      - `cert` &lt;Buffer&gt; Cert file content
      - `ca` &lt;Buffer&gt; Ca file content
      - `rejectUnauthorized` &lt;Boolean&gt; Reject IPs / Hostnames not in cert's list
      - `requestCert` &lt;Boolean&gt; Request a certificate from a connecting client
      - `verifyClient` &lt;Function&gt; Function to verify connecting client before Websocket connection is established.

Creates a new instance of a `PeerRPCServer`, which connects to the DHT
using the passed `link`.

#### peer.init()

Sets the peer active. Must get called before we get a transport
to set up a server.

#### peer.transport('server')

Must get called after the peer is active. Sets peer into server-
mode.

#### peer.listen(port)

Lets the `PeerRPCServer` listen on the desired `port`. The port is
stored in the DHT.

#### peer.port

Port of the server (set by `listen(port)`).


### Class: PeerRPCClient

#### new PeerRPCClient(link, [options])

  - `link` &lt;Object&gt; Instance of a [Link Class](#new-linkoptions)
  - `options` &lt;Object&gt;
    - `maxActiveKeyDests` &lt;Number&gt;
    - `maxActiveDestTransports` &lt;Number&gt;
    - `secure`: &lt;Object&gt; TLS options
      - `key` &lt;Buffer&gt; Key file content
      - `cert` &lt;Buffer&gt; Cert file content
      - `ca` &lt;Buffer&gt; Ca file content
      - `rejectUnauthorized` &lt;Boolean&gt; Reject IPs / Hostnames not in cert's list

Creates a new instance of a `PeerRPCClient`, which connects to the DHT
using the passed `link`.

A PeerRPCClient can communicate with multiple Servers and map work items over them.
With `maxActiveKeyDests` you can limit the maximum amount of destinations.
Additionally, you can limit the amount of transports with `maxActiveDestTransports`.

#### peer.init()

Sets the peer active. Must get called before we start to make requests.

#### peer.map(name, payload, [options], callback)
  - `name` &lt;String&gt; Name of the service to address
  - `payload` &lt;String&gt; Payload to send
  - `options` &lt;Object&gt; Options for the request
    - `timeout` &lt;Number&gt; timeout in ms
    - `limit` &lt;Number&gt; maximum requests per available worker
  - `callback` &lt;Function&gt;

Maps a number of requests over the amount of registered workers / PeerRPCServers.

[Example](https://github.com/bitfinexcom/grenache-nodejs-ws/tree/master/examples/rpc_cert_whitelist_server.js).


#### peer.request(name, payload, [options], callback)
  - `name` &lt;String&gt; Name of the service to address
  - `payload` &lt;String&gt; Payload to send
  - `options` &lt;Object&gt; Options for the request
    - `timeout` &lt;Number&gt; timeout in ms
    - `retry` &lt;Number&gt; attempts to make before giving up. default is 1
  - `callback` &lt;Function&gt;

Sends a single request to a RPC server/worker.

[Example](https://github.com/bitfinexcom/grenache-nodejs-ws/tree/master/examples/rpc_cert_whitelist_client.js).
