# UTXO swarm

A playground for one question: can the txbt4 UTXO snapshot (869,836,053 bytes, 208 pieces of 4 MiB, infohash `242e9b7dcba15cc0ed8f1bc5f06b68da008f87c0`) reach a browser from a BitTorrent swarm, and how does that compare with fetching it from one host? The goal behind it: many nodes holding the UTXO set, none of them special.

Live: https://play-grounds.github.io/utxo-swarm/ — nothing else depends on this; the apps that use the snapshot (Reef, Bight, Winch, Hitch, the browser node) still fetch it by HTTP until this proves itself.

## The swarm, additively

One infohash, every kind of peer, each making the others stronger:

- **Desktop clients** (qBittorrent, Transmission, anything): add the magnet below, seed. This is where the node count comes from.
- **The seeder** (`seeder/seed.mjs`): webtorrent 3 in Node, which speaks TCP/uTP and DHT to desktop clients *and* WebRTC to browsers through the WebSocket trackers. Without one of these a browser finds no peer at all. One runs now.
- **Web seeds** (BEP 19): plain HTTP mirrors of the file, inside the magnet rather than the infohash, so a swarm of zero still works. Passed as `?webseed=` here; none is hard-wired.
- **Browser peers**: this page, and later every synced tab, fetch over WebRTC and seed while open.

The page also shows the swarm's state as the trackers tell it: seeders and leechers per tracker, asked every minute. Overlapping counts (one seeder is on several trackers), a browser asking counts as a leecher, nothing self-reported, nothing new on the wire.

    magnet:?xt=urn:btih:242e9b7dcba15cc0ed8f1bc5f06b68da008f87c0&dn=utxo-knots-150307.dat&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=wss%3A%2F%2Ftracker.webtorrent.dev&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce

The torrent's metadata is in the repo (`utxo-knots-150307.torrent`), so a browser needs no peer to learn the pieces. Pieces are checked by SHA-1 as they arrive; the whole file's SHA-256 (`86118db3…29cd`, the snapshot's known hash) is checked at the end.

## The page

`index.html` + `swarm.js`: trackers and web seed as inputs (query string `?tracker=…&webseed=…`), **Fetch from the swarm** with every byte attributed to the wire it came from (WebRTC peer or web seed), rate, peers, uploaded while seeding, the SHA-256 check; **Fetch by HTTP** of the web seed for the comparison. webtorrent 3.0.21 from the CDN, pinned. webtorrent stores the pieces in the browser's origin storage (OPFS) by default, so the copy survives reloads and the tab seeds at once on the next visit; **Clear the stored copy** deletes it to measure the swarm again.

## The seeder

    cd seeder && npm install
    node seed.mjs <file> --announce wss://tracker.openwebtorrent.com --announce wss://tracker.webtorrent.dev --announce udp://tracker.opentrackr.org:1337/announce [--webseed https://…] [--every 60]

Logs each peer and the running total uploaded. Run it anywhere the file is; several are better than one.

Not done, by design, until the page shows the numbers: a tracker of our own (two of the three public WebSocket trackers were flaky or dead when checked), a second web seed, and any change to the apps.

AGPL-3.0-or-later.
