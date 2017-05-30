# grenache-nodejs-ws-tls

Grenache TLS support with optional payload validation based on client certificate

<br />
<br />

Grenache is a micro-framework for connecting microservices. Its simple and optimized for performance.

Internally, Grenache uses Distributed Hash Tables (DHT, known from Bittorrent) for Peer to Peer connections. You can find more details how Grenche internally works at the [Main Project Homepage](https://github.com/bitfinexcom/grenache)

 - [Setup](#setup)
 - [Examples](#examples)
 - [API](#api)

## Setup

### Install
```
npm install --save grenache-nodejs-ws
```

### Other Requirements

Install `Grenache Grape`: https://github.com/bitfinexcom/grenache-grape:

```bash
npm i -g grenache-grape
```

```
// Start 2 Grapes
grape --dp 20001 --apw 30001 --aph 30002 --bn '127.0.0.1:20002'
grape --dp 20002 --apw 40001 --aph 40002 --bn '127.0.0.1:20001'
```

### Examples

#### RPC Server / Client

This RPC Server example announces a service called `rpc_test`
on the overlay network. When a request from a client is received,
it replies with `world`. It receives the payload `hello` from the
client.

The client sends `hello` and receives `world` from the server.

Internally the DHT is asked for the IP of the server and then the
request is done as Peer-to-Peer request via websockets.

**Grape:**

```bash
grape --dp 20001 --apw 30001 --aph 30002 --bn '127.0.0.1:20002'
grape --dp 20002 --apw 40001 --aph 40002 --bn '127.0.0.1:20001'
```

**Server:**

```js
const link = new Link({
  grape: 'ws://127.0.0.1:30001'
})
link.start()

const opts = {
  secure: {
    key: fs.readFileSync(path.join(__dirname, 'server-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'server-crt.pem')),
    ca: fs.readFileSync(path.join(__dirname, 'ca-crt.pem')),
    requestCert: true,
    rejectUnauthorized: false, // take care, can be dangerous in production!
    verifyClient: (info, cb) => {
      // access cert data with:
      // info.req.socket.getPeerCertificate()
      cb(true)
    }
  }
}
const peer = new Peer(
  link,
  opts
)

const service = peer.transport('server')
service.listen(_.random(1000) + 1024)

setInterval(function () {
  link.announce('rpc_test', service.port, {})
}, 1000)

service.on('request', (rid, key, payload, handler) => {
  console.log(payload) // hello
  handler.reply(null, 'world')
})
```

**Client:**

```js
const link = new Link({
  grape: 'ws://127.0.0.1:30001'
})
link.start()

const secure = {
  key: fs.readFileSync(path.join(__dirname, 'client1-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'client1-crt.pem')),
  ca: fs.readFileSync(path.join(__dirname, 'ca-crt.pem')),
  rejectUnauthorized: false // take care, can be dangerous in production!
}

const peer = new Peer(
  link,
  { secure: secure }
)

const reqs = 10
setTimeout(() => {
  for (let i = 0; i < reqs; i++) {
    peer.map('rpc_test', 'hello', { timeout: 10000 }, (err, data) => {
      console.log(err, data)
    })
  }
}, 2000)
```

[Code Server](https://github.com/bitfinexcom/grenache-nodejs-ws-tls/tree/master/examples/rpc_server.js)
[Code Client](https://github.com/bitfinexcom/grenache-nodejs-ws-tls/tree/master/examples/rpc_client_map.js)

## API

### Class: Link

#### new Link(options)

 - `options` &lt;Object&gt; Options for the link
    - `grape` &lt;String&gt; Address of the Grenache Grape instance. Communication is done via WebSocket or HTTP.
    - `lruMaxSizeLookup` &lt;Number&gt; Maximum size of the cache,
        checked by applying the length function to all values
        in the cache
    - `lruMaxAgeLookup` &lt;Number&gt; Maximum cache age in ms.

#### Event: 'connect'

Emitted when the link connected to Grape.

#### Event 'disconnect'

Emitted when the link disconnected from Grape.

#### link.start()

Sets up a connection to the DHT. Emits a `connect` event on
successful connection.

#### link.stop()

Stops the connection to the DHT. Emits a `disconnect` event on
successful disconnection.

#### link.announce(name)

  - name &lt;String&gt; Name of the service, used to find the service
    from other peers

Used to announce a service, e.g. a [RPC Server](#class-peerrpcserver).

#### link.put(options)

  - `options`
    - `v`: &lt;String&gt; value to store
  - `callback` &lt;function&gt;

Puts a value into the DHT.

#### link.get(hash, callback)

  - `hash` &lt;String&gt; Hash used for lookup
  - `callback` &lt;function&gt;

Retrieves a stored value from the DHT via a `hash` &lt;String&gt;.
Callback returns `err` &lt;Object&gt; and data &lt;Object&gt;.


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

#### Example

This RPC Server example announces a service called `rpc_test`
on the overlay network. When a request from a client is received,
it replies with `world`. It receives the payload `hello` from the
client.

The client sends `hello` and receives `world` from the server.

Internally the DHT is asked for the IP of the server and then the
request is done as Peer-to-Peer request via websockets.

The server can use the `verifyClient` function to make validations
**before** the WebSocket connection is established.

The cert data is also available in each request-handler.

**Server:**

```js
const link = new Base.Link({
  grape: 'ws://127.0.0.1:30001'
})
link.start()

const opts = {
  secure: {
    key: fs.readFileSync(path.join(__dirname, 'server-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'server-crt.pem')),
    ca: fs.readFileSync(path.join(__dirname, 'ca-crt.pem')),
    requestCert: true,
    rejectUnauthorized: false, // take care, can be dangerous in production!
    verifyClient: (info, cb) => {
      // console.log(info.req.socket.getPeerCertificate())
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
const peer = new Peer(
  link,
  opts
)
peer.init()

const service = peer.transport('server')
service.listen(_.random(1000) + 1024)

setInterval(function () {
  link.announce('rpc_test', service.port, {})
}, 1000)

service.on('request', (rid, key, payload, handler, cert) => {
  console.log(cert.fingerprint)
  handler.reply(null, 'world')
})
```

**Client:**

```js
const link = new Base.Link({
  grape: 'ws://127.0.0.1:30001'
})

link.start()

const secure = {
  key: fs.readFileSync(path.join(__dirname, 'client1-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'client1-crt.pem')),
  ca: fs.readFileSync(path.join(__dirname, 'ca-crt.pem')),
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
```

[Server](https://github.com/bitfinexcom/grenache-nodejs-ws-tls/tree/master/examples/rpc_server.js)
[Client](https://github.com/bitfinexcom/grenache-nodejs-ws-tls/tree/master/examples/rpc_client_map.js)


### Class: PeerRPCClient

#### new PeerRPCServer(link, [options])

 - `link` &lt;Object&gt; Instance of a [Link Class](#new-linkoptions)
 - `options` &lt;Object&gt;

Creates a new instance of a `PeerRPCClient`, which connects to the DHT
using the passed `link`.

#### peer.init()

Sets the peer active. Must get called before we start to make requests.

#### peer.map(name, payload, [options], callback)
  - `name` &lt;String&gt; Name of the service to address
  - `payload` &lt;String&gt; Payload to send
  - `options` &lt;Object&gt; Options for the request
    - `timeout` &lt;Number&gt; timeout in ms
    - `limit` &lt;Number&gt; maximum requests per available worker
  - `callback` &lt;function&gt;

Maps a number of requests over the amount of registered workers / PeerRPCServers.
[Example](https://github.com/bitfinexcom/grenache-nodejs-ws-tls/tree/master/examples/rpc_client_map.js).


#### peer.request(name, payload, [options], callback)
  - `name` &lt;String&gt; Name of the service to address
  - `payload` &lt;String&gt; Payload to send
  - `options` &lt;Object&gt; Options for the request
    - `timeout` &lt;Number&gt; timeout in ms
  - `callback` &lt;function&gt;

Sends a single request to a RPC server/worker.

### Class: PeerPub

#### new PeerPub(link, [options])

 - `link` &lt;Object&gt; Instance of a [Link Class](#new-linkoptions)
 - `options` &lt;Object&gt;

#### peer.init()

Sets the peer active. Must get called before we get a transport
to set up a server.

#### peer.transport('server')

Must get called after the peer is active. Sets peer into server-
mode.

#### peer.listen(port)

Lets the `PeerRPCServer` listen on the desired `port`. The port is
stored in the DHT.

#### peer.pub(payload)

  - payload &lt;String&gt; Payload to send

Sends a message to all connected peers.

### Class: PeerSub

#### new PeerSub(link, [options])

 - `link` &lt;Object&gt; Instance of a [Link Class](#new-linkoptions)
 - `options` &lt;Object&gt;

Creates a new instance of a `PeerSub`, which connects to the DHT
using the passed `link`.

#### .sub(name, [options])
  - name &lt;String&gt; Name of the Pub Channel to register
  - `options` &lt;Object&gt; Options for the request
    - `timeout` &lt;Number&gt; timeout in ms

Registers as a receiver for messages.

#### Event: 'connected'

Emitted when the client is connected to the Pub Server.

#### Event: 'disconnected'

Emitted when the client disconnects.

#### Event: 'message'

Emitted when a payload is received.
