// The always-on seeder: seeds the snapshot file into the swarm over TCP/uTP (desktop clients), DHT, and WebRTC (browsers,
// through the WebSocket trackers), with a line in the log for every peer and the running total uploaded. The file path,
// trackers and web seeds are arguments; nothing is hard-wired to a host.
//   node seed.mjs <file> [--announce wss://… ...] [--webseed https://… ...] [--every 60]
import WebTorrent from 'webtorrent';
const args = process.argv.slice(2); const file = args.find((a) => !a.startsWith('--')); const list = (flag) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []));
const announce = list('--announce'); const urlList = list('--webseed'); const every = Number(list('--every')[0] ?? 60);
if (!file) { console.error('a file to seed is needed'); process.exit(2); }
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const client = new WebTorrent({ dht: true });
client.on('error', (e) => log('client error', e.message));
log('hashing', file, '…');
client.seed(file, { announce, urlList, pieceLength: 4194304 }, (t) => {
  log('seeding', t.infoHash, `· ${t.length} bytes · ${t.pieces.length} pieces · trackers ${announce.join(' ') || '(none)'}`);
  log('magnet', t.magnetURI);
  t.on('wire', (w, addr) => log('peer', w.type === 'webrtc' || !addr ? 'webrtc' : addr, 'joined ·', t.numPeers, 'now'));
  t.on('warning', (e) => log('warning', e.message)); t.on('error', (e) => log('torrent error', e.message));
  setInterval(() => log(`peers ${t.numPeers} · uploaded ${(t.uploaded / 1048576).toFixed(1)} MB · ${(t.uploadSpeed / 1024).toFixed(0)} kB/s`), every * 1000);
});
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => client.destroy(() => process.exit(0)));
