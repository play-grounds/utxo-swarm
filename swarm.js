// The playground's wiring: webtorrent in the browser against the snapshot's torrent, every byte attributed to the wire
// it came from (a WebRTC peer or the web seed), the whole file's SHA-256 checked at the end, the tab seeding while open.
import WebTorrent from 'https://cdn.jsdelivr.net/npm/webtorrent@3.0.21/dist/webtorrent.min.js'; // an ES module build
const INFOHASH = '242e9b7dcba15cc0ed8f1bc5f06b68da008f87c0', BYTES = 869836053, SHA256 = '86118db3a692b7c64bd4d9aef51a401f09722b9e92acb2826e7e76ac964529cd';
const DEFAULT_TRACKERS = ['wss://tracker.openwebtorrent.com', 'wss://tracker.webtorrent.dev'];
const SCHEMA = 'https://cdn.jsdelivr.net/gh/bitcoin-desktop/schema@b8cbf6337c7450fe14ddc5bce00c7280059aab5d';
const q = new URLSearchParams(location.search); const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString('en-US'); const mb = (n) => (n / 1048576).toFixed(1) + ' MB'; const rate = (bps) => (bps / 1048576).toFixed(2) + ' MB/s';
const log = (t) => { $('log').textContent += new Date().toISOString().slice(11, 19) + ' ' + t + '\n'; };
$('trackers').value = q.get('tracker') ? q.getAll('tracker').join(',') : DEFAULT_TRACKERS.join(',');
$('webseed').value = q.get('webseed') ?? '';
const trackers = () => $('trackers').value.split(',').map((s) => s.trim()).filter(Boolean);
const webseed = () => $('webseed').value.trim();

let client = null, torrent = null, t0 = 0, doneAt = 0, timer = null;
// bytes by source: a wire's own count dies with the wire (peers come and go), so what a closed wire brought is kept here
const closed = { peer: 0, 'web seed': 0 }; const kindOf = (w) => (w.type === 'webSeed' ? 'web seed' : 'peer');
function draw() {
  if (!torrent) return;
  const rows = []; let peerBytes = closed.peer, seedBytes = closed['web seed'];
  for (const w of torrent.wires) { const kind = kindOf(w); const b = w.downloaded; if (kind === 'peer') peerBytes += b; else seedBytes += b; rows.push([kind, w.remoteAddress ?? (w.type === 'webSeed' ? webseed() : w.peerId?.slice(0, 12) ?? '?'), b, w.downloadSpeed()]); }
  const total = torrent.downloaded || 1;
  $('src').innerHTML = [['<b>peers (WebRTC)</b>', '', peerBytes, 0], ['<b>web seed (HTTP)</b>', '', seedBytes, 0], ...rows].map(([k, who, b, r]) => `<tr><td>${k} <span class="mono tiny mut">${who}</span></td><td class="n">${mb(b)}</td><td class="n">${((b / total) * 100).toFixed(1)}%</td><td class="n">${r ? rate(r) : ''}</td></tr>`).join('');
  $('bar').value = torrent.progress; $('peers').textContent = torrent.numPeers; $('up').textContent = mb(torrent.uploaded); $('elapsed').textContent = (((doneAt || Date.now()) - t0) / 1000).toFixed(0) + ' s';
  const received = peerBytes + seedBytes; // what actually crossed the network; the rest came from this browser's storage
  $('state').textContent = torrent.done ? (received < torrent.length / 2 ? `done in ${((doneAt - t0) / 1000).toFixed(1)} s: ${mb(torrent.length - received)} was already in this browser's storage from an earlier run (clear it to measure again) · seeding, ${mb(torrent.uploaded)} served to ${torrent.numPeers} peer(s)` : `done: ${mb(received)} from the swarm in ${((doneAt - t0) / 1000).toFixed(1)} s · seeding, ${mb(torrent.uploaded)} served to ${torrent.numPeers} peer(s)`) : `${(torrent.progress * 100).toFixed(1)}% · ${rate(torrent.downloadSpeed)} · ${torrent.numPeers} peer(s)`;
}
async function verify() {
  $('verify').textContent = 'hashing…';
  try {
    const { sha256, bytesToHex } = await import(`${SCHEMA}/codec/hash.js`);
    const buf = new Uint8Array(await torrent.files[0].arrayBuffer()); const h = bytesToHex(sha256(buf));
    const ok = h === SHA256 && buf.length === BYTES; $('verify').innerHTML = ok ? '<span class="ok">sha256 matches the snapshot</span>' : `<span class="bad">sha256 ${h.slice(0, 16)}… does not match</span>`; log(`verify ${ok ? 'ok' : 'FAILED ' + h}`);
  } catch (e) { $('verify').innerHTML = `<span class="bad">could not hash: ${e.message}</span>`; log('verify error ' + e.message); }
}
$('go').onclick = async () => {
  $('go').disabled = true; $('stop').disabled = false; $('state').textContent = 'starting…'; t0 = Date.now(); doneAt = 0;
  client = new WebTorrent({ tracker: { announce: trackers() } });
  client.on('error', (e) => log('client error ' + e.message));
  const meta = await (await fetch('utxo-knots-150307.torrent')).arrayBuffer();
  const opts = { announce: trackers(), ...(webseed() ? { urlList: [webseed()] } : {}) };
  torrent = client.add(new Uint8Array(meta), opts);
  log(`added ${INFOHASH} · trackers ${trackers().join(' ')} · web seed ${webseed() || 'none'}`);
  torrent.on('infoHash', () => log('infohash ' + torrent.infoHash + (torrent.infoHash === INFOHASH ? ' (as expected)' : ' (UNEXPECTED)')));
  torrent.on('wire', (w, addr) => { log(`wire ${w.type === 'webSeed' ? 'web seed' : 'peer ' + (addr ?? '')}`); w.once('close', () => { closed[kindOf(w)] += w.downloaded; }); });
  torrent.on('warning', (e) => log('warning ' + e.message)); torrent.on('error', (e) => log('error ' + e.message));
  torrent.on('done', () => { doneAt = Date.now(); log(`done ${mb(torrent.downloaded)} in ${((Date.now() - t0) / 1000).toFixed(1)} s`); draw(); verify(); });
  timer = setInterval(draw, 1000);
};
$('stop').onclick = () => { clearInterval(timer); client?.destroy(); client = null; torrent = null; $('state').textContent = 'stopped'; $('go').disabled = false; $('stop').disabled = true; };
// the stored copy lives in this browser's origin storage (OPFS, webtorrent's own store) and survives reloads: that is the
// seeding-across-reloads the goal needs, and it is also why a second run finishes in a second; clear it to measure again
$('clear').onclick = async () => {
  clearInterval(timer); $('clear').disabled = true;
  try {
    const c = client ?? new WebTorrent({ tracker: { announce: [] } }); const meta = new Uint8Array(await (await fetch('utxo-knots-150307.torrent')).arrayBuffer());
    const t = torrent ?? await new Promise((res) => c.add(meta, { announce: [] }, res));
    await new Promise((res) => c.remove(t, { destroyStore: true }, res)); if (!client) c.destroy(); client = null; torrent = null;
    $('state').textContent = 'stored copy cleared'; $('go').disabled = false; $('stop').disabled = true; log('stored copy cleared');
  } catch (e) { $('state').textContent = 'could not clear: ' + e.message; }
  $('clear').disabled = false;
};

// plain HTTP, the same file, for the comparison
$('http').onclick = async () => {
  const url = webseed(); if (!url) return ($('hstate').textContent = 'needs a web seed URL');
  $('http').disabled = true; const t = Date.now(); let got = 0;
  try {
    const r = await fetch(url); if (!r.ok) throw new Error(r.status + ' ' + r.statusText); const total = Number(r.headers.get('content-length')) || BYTES; const reader = r.body.getReader();
    for (;;) { const { done, value } = await reader.read(); if (done) break; got += value.length; $('hbar').value = got / total; $('hstate').textContent = `${mb(got)} · ${rate(got / ((Date.now() - t) / 1000))}`; }
    $('hstate').textContent = `done: ${mb(got)} in ${((Date.now() - t) / 1000).toFixed(1)} s (${rate(got / ((Date.now() - t) / 1000))})`; log('http ' + $('hstate').textContent);
  } catch (e) { $('hstate').textContent = 'failed: ' + e.message; log('http failed ' + e.message); }
  $('http').disabled = false;
};
if (webseed()) $('hstate').textContent = 'ready';
