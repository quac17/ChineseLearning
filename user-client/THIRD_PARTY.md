# Third-party code and data in user-client

| Package / data | Used for | License | How it is used |
|---|---|---|---|
| [`qrcode`](https://github.com/soldair/node-qrcode) 1.5.4 | Drawing the VietQR code on `/checkout` | MIT | npm dependency, bundled |
| [`hanzi-writer`](https://github.com/chanind/hanzi-writer) 3.7.3 | Stroke-order animation and stroke checking on `/writing` | MIT | npm dependency, bundled |
| [`hanzi-writer-data`](https://github.com/chanind/hanzi-writer-data) 2.0.1 | Stroke data for each character | Arphic Public License (derived from [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) and Arphic fonts) | **Not bundled.** Fetched at runtime from jsDelivr (`cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/<char>.json`), pinned version |

Fonts (Be Vietnam Pro, Noto Serif SC) come from Google Fonts under the SIL Open Font License.
Stock photos: `public/images/stock/CREDITS.md`.
