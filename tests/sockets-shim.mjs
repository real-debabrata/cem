// Node stand-in for cloudflare:sockets (connect + startTls), for tests only.
import net from 'node:net';
import tls from 'node:tls';
function wrap(sock, starttls, host) {
  const readable = new ReadableStream({
    start(c) {
      sock.on('data', d => c.enqueue(new Uint8Array(d)));
      sock.on('end', () => { try { c.close(); } catch (e) {} });
      sock.on('error', e => { try { c.error(e); } catch (x) {} });
    }, cancel() { sock.destroy(); }
  });
  const writable = new WritableStream({
    write(chunk) { return new Promise((res, rej) => sock.write(chunk, e => e ? rej(e) : res())); },
    close() { sock.end(); }
  });
  const opened = new Promise((res, rej) => { sock.once(sock instanceof tls.TLSSocket ? 'secureConnect' : 'connect', res); sock.once('error', rej); });
  return {
    readable, writable, opened,
    startTls() { sock.removeAllListeners('data'); sock.removeAllListeners('end'); const t = tls.connect({ socket: sock, servername: host, rejectUnauthorized: false }); return wrap(t, false, host); },
    close() { sock.destroy(); }
  };
}
export function connect({ hostname, port }, opts = {}) {
  if (opts.secureTransport === 'on') return wrap(tls.connect({ host: '127.0.0.1', port, servername: hostname, rejectUnauthorized: false }), false, hostname);
  return wrap(net.connect({ host: '127.0.0.1', port }), opts.secureTransport === 'starttls', hostname);
}
