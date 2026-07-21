# SOL-PUMP-PROVENANCE-001 — Pump.fun decoder provenance

## Verdict

**GREEN.** The Owner-authorized anchor produced verified `create_v2`, `buy`, and
`sell` instructions, and an independently located finalized transaction produced
the required `migrate` instruction. All four scrubbed local fixtures are pinned
to the official program ID, the hash-pinned IDL, finalized slots, transaction
signatures, retrieval watermarks, and local SHA-256 hashes. Decoder tests must
read only these local artifacts and must never fetch mutable live transactions.

This report records only public program documentation and source-control
identifiers. It intentionally contains no live RPC response body, provider
credential, request header, or nonpublic data.

## Retrieval watermark

Retrieved at: `2026-07-19T14:13:27Z`.

Official source repository: <https://github.com/pump-fun/pump-public-docs>

Pinned revision: [`9c82f61cb711b044a17f770ab8ce9f9bdf78f333`](https://github.com/pump-fun/pump-public-docs/tree/9c82f61cb711b044a17f770ab8ce9f9bdf78f333)
(repository commit timestamp: `2026-07-16T02:22:27+08:00`).

The pin and file hashes below are the source watermark. `main` must never be
used as a decoder fixture source without replacing this pin and recording a new
hash.

| Official source artifact | Immutable direct URL | SHA-256 |
| --- | --- | --- |
| Pump IDL | <https://raw.githubusercontent.com/pump-fun/pump-public-docs/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump.json> | `b90bc471327f671449271d5d1d42354d1fae6f5a06502f5834459a3108138e49` |
| Pump AMM IDL | <https://raw.githubusercontent.com/pump-fun/pump-public-docs/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/idl/pump_amm.json> | `6b5c7ec4e5ef9742fa99dc57b0d75b1031b379bba02a7e1b3c5a4cad68d77e56` |
| Pump program semantics | <https://raw.githubusercontent.com/pump-fun/pump-public-docs/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/PUMP_PROGRAM_README.md> | `3532f985fcab38480392759a6c2f01015b7178b9f2c7dc0db8c9f85ce9f72571` |
| Coin creation account/data guide | <https://raw.githubusercontent.com/pump-fun/pump-public-docs/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/instructions/COIN_CREATION.md> | `310f4560d0c95d8a196a4d3193399de87407de7f90218949290d4b03ec874536` |
| Buy guide | <https://raw.githubusercontent.com/pump-fun/pump-public-docs/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/instructions/BUY.md> | `b2ba018cf1512d95a84482298091facdec532e9c734a2c6890e56461405987b7` |
| Sell guide | <https://raw.githubusercontent.com/pump-fun/pump-public-docs/9c82f61cb711b044a17f770ab8ce9f9bdf78f333/docs/instructions/SELL.md> | `02037217c2fb0b83c70380888535107d8649116719f504646a5cc200765d1910` |

Reproduction:

```text
git clone https://github.com/pump-fun/pump-public-docs.git
git -C pump-public-docs checkout 9c82f61cb711b044a17f770ab8ce9f9bdf78f333
shasum -a 256 pump-public-docs/idl/pump.json
```

## Official facts used by the decoder

- The official Pump program ID is
  `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`.
- The official program guide defines `create(user, ..., creator)` and states
  that `user` and `creator` can differ. The decoded `creator` field therefore
  has priority; payer, signer, metadata, and labels are not fallback evidence
  while that field is present.
- The same guide defines `migrate(user, mint)` as permissionless migration of a
  completed bonding curve to PumpSwap. A transfer alone is never migration
  evidence.

## Version-selection rule

1. Accept a Pump instruction only when its invoked program ID exactly matches
   the registered Pump program ID and its first eight instruction-data bytes
   match a discriminator in a hash-pinned IDL registry entry.
2. Store the registry key as `(program_id, source_commit, idl_sha256)` and
   store the matching discriminator, instruction name, transaction signature,
   slot, and RPC retrieval watermark with every decoded result.
3. The `metadata.version` value in the IDL is not a sufficient deployment or
   upgrade boundary. Do not select an IDL from that value or from a transaction
   date alone. A new source revision needs a new pinned registry entry and
   fixture replay before it becomes supported.
4. This pinned IDL contains both legacy and v2 forms. The decoder must recognize
   only the explicitly listed form present in a pinned fixture; an unknown
   discriminator, account layout, program ID, or failed replay returns an
   unsupported-version result and preserves raw provenance rather than guessing.
5. For a historical replay, the fixture's captured program ID, discriminator,
   signature, finalized slot, block time, IDL pin, and fixture SHA-256 must all
   match the registry record. Otherwise the fixture is rejected.

| Instruction | Discriminator bytes from pinned `pump.json` |
| --- | --- |
| `create` | `24,30,200,40,5,28,7,119` |
| `create_v2` | `214,144,76,236,95,139,49,180` |
| `buy` | `102,6,61,18,1,218,235,234` |
| `buy_v2` | `184,23,238,97,103,197,211,61` |
| `sell` | `51,230,133,164,1,127,131,173` |
| `sell_v2` | `93,246,130,60,231,233,64,178` |
| `migrate` | `155,234,231,146,236,158,162,30` |

## Fixed transaction-fixture provenance — bounded public-RPC result

Retrieved at: `2026-07-20T06:38:51.888Z` from the public no-key endpoint
`https://solana-rpc.publicnode.com`, with `commitment: finalized`.

Owner-authorized anchor:
`GyjN383QnJvUPbgNxaJBcWsKK35wU8HUnorKACsDpump`.

The anchor's finalized mint history contained successful instructions whose
invoked program ID and first eight data bytes exactly matched the pinned IDL's
`create_v2`, `buy`, and `sell` entries. The token had not migrated during the
bounded observation window, so it was not used to infer migration.

The `migrate` candidate was located without guessing from token transfers. The
pinned IDL identifies `withdraw_authority` as a relation of the Pump Global
account. The finalized Global account
`4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf` had the registered Global
discriminator and decoded `withdraw_authority`
`39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg`. Its finalized history yielded
the selected successful transaction, whose Pump instruction matched the exact
`migrate` discriminator and 25-account layout from the pinned IDL.

Common registry values for every row are program ID
`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`, IDL commit
`9c82f61cb711b044a17f770ab8ce9f9bdf78f333`, and IDL SHA-256
`b90bc471327f671449271d5d1d42354d1fae6f5a06502f5834459a3108138e49`.

| Action | Form | Signature | Slot | Block time | Fixture SHA-256 |
| --- | --- | --- | ---: | ---: | --- |
| create | `create_v2` | `4VXF3mBhmFYkSXuminmxq9g3VK59bVtBESy3dE3NVjFdEQXPpwvmT8DwobgwNZALiJzv8BgQsp2tDBoPTL73rMq9` | `434047786` | `1784528592` | `fb300d0db2bdb5c7f5dfbf8cddc1323d71457eaab075e907954bf9fd5b8cb89a` |
| buy | `buy` | `2DS1pF9ZCRCyk3S1BkEeoZqhnnDFzffVYy4uzo6iPXqjXLXhWKLvFrzLK55Rq7Ze2X4m3Up7cyqR8nE5q1qTW7ER` | `434047816` | `1784528606` | `c3e3cbe3112f4c7e9b9ad607040d0c361bf3268366b5561a2e531315b1e0aa95` |
| sell | `sell` | `3DEYyFfxBa7wey9Cj53JNYeU9frT5PKTz8tdrHduaSrsjpe7EkhwoifXW926L2uodCHNB4F6Wz7VJQ2QP42gXgmN` | `434047820` | `1784528607` | `097134849841c5f1acae2cdb4d9856413c2321957c7e851f3379b7ce83114dbd` |
| migrate | `migrate` | `4E9PEac1ndE2smnGcfrbmDKwwMMMPRZnn7J6enNrPSPSpGU5L5W3xgZ8TWzjE6WUoVxuwCQP3BBXm8C73iAukBDA` | `434047842` | `1784528616` | `222df022fd8ae0532696c9860391e68a359682c3ef0a9630075b6b4b381c1632` |

The machine-readable manifest is
`test/fixtures/solana/pump/manifest.json`. Each fixture retains only the
selected Pump instruction, ordered accounts, transaction identity, finalized
watermark, and retrieval metadata; raw provider envelopes and unrelated
instructions were not retained.

## Consequence for SOL-PUMP-001

`SOL-PUMP-001` is ready for dispatch. Its decoder has a complete offline fixture
quartet and must enforce the registry and unsupported-version rules above.

## Previous rejected anchor CA check

Owner-authorized public anchor:
`G9j8WWDeJXZdvwQgP82ooDuHmpc3Gy8NCSins71Lpump`.

Retrieved at: `2026-07-19T15:35:38Z` from the public no-key endpoint
`https://api.mainnet-beta.solana.com`, with `commitment: finalized`.

The bounded trace returned five pages of 1,000 signatures for the anchor. Its
observed finalized range was slot `433917611` through `433922091` and block time
`1784473353` through `1784475242`. The ten most recent successful candidate
transactions were then inspected for the official Pump program ID in both
top-level and inner instructions. None contained that program ID, so none was
eligible as a Pump fixture. No `migrate` discriminator was found in this
sample.

This does **not** claim that the CA is not a Pump token: the public signature
history is too dense to reach the creation transaction within the bounded trace.
It does establish that mint metadata, a `pump`-looking address, token transfers,
and unverified transaction history are insufficient evidence. No local fixture
was created and no transient RPC response was retained.

This prior result remains recorded to show why an unverified anchor must not be
substituted for the now-pinned fixture evidence above.
