import createTorrent from 'create-torrent'; import parseTorrent from 'parse-torrent'; import { writeFileSync } from 'node:fs';
const [file, out, ...urls] = process.argv.slice(2);
const announce = ['wss://tracker.openwebtorrent.com','wss://tracker.webtorrent.dev','wss://tracker.btorrent.xyz','udp://tracker.opentrackr.org:1337/announce','udp://open.tracker.cl:1337/announce'];
createTorrent(file, { announceList: announce.map(a => [a]), urlList: urls, pieceLength: 262144, createdBy: 'blaketestnode', comment: 'txbt4 epoch package 151200→153216' }, async (err, buf) => {
  if (err) throw err; writeFileSync(out, buf);
  const t = await parseTorrent(buf);
  console.log(JSON.stringify({ infoHash: t.infoHash, name: t.name, length: t.length, pieces: t.pieces.length, pieceLength: t.pieceLength, urlList: t.urlList, announce: t.announce }, null, 1));
  const ws = urls.map(u => '&ws=' + encodeURIComponent(u)).join(''); const tr = announce.map(a => '&tr=' + encodeURIComponent(a)).join('');
  console.log(`magnet:?xt=urn:btih:${t.infoHash}&dn=${encodeURIComponent(t.name)}${tr}${ws}`);
});
