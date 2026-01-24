# deck belcher

**[deckbelcher.com](https://deckbelcher.com)**

deckbelcher is a social decklist builder, built on top of atproto.

If you've ever used a tool like moxfield, archidekt, tappedout, deckstats... this aims to replace it.

You can see the lexicons [here](./lexicons/) which are derived from typespec [here](./typelex/).

Perhaps the most interesting non-atproto thing here is the local card search engine. Card data is loaded into a SharedWorker in the background ([here](./src/workers/cards.worker.ts)) and queried and cached in the site with tanstack query. During SSR, binary search of a map of sorted UUIDs -> chunk id + text range allows loading and parsing a minimal amount of JSON (parsing all JSON is extremely slow and won't fit in the CF workers memory limit) to preload these queries. This creates a rather seamless experience, and I find you can't tell that the magic trick is happening unless you look for it. Chunks are content hashed and sorted, so updates usually only require refetching a couple chunks. Volatile data like pricing is split into its own chunk, otherwise chunk caching is essentially moot.

```
getCardById("abc-123")
        │
        ▼
┌───────────────────┐
│   card LRU cache  │──hit──▶ return Card
│    (10k cards)    │
└───────────────────┘
        │ miss
        ▼
┌───────────────────┐
│ cards-byteindex   │  binary search sorted UUIDs
│      .bin         │  25 bytes/record: UUID(16) + chunk(1) + offset(4) + len(4)
└───────────────────┘
        │
        ▼
   { chunk: 42, offset: 81920, len: 2048 }
        │
        ▼
┌───────────────────┐
│  chunk LRU cache  │──hit──▶ use cached chunk text
│   (12 chunks)     │
└───────────────────┘
        │ miss
        ▼
   fetch cards/cards-042-a1b2c3.json
        │
        ▼
   chunkText.slice(81920, 81920 + 2048)
        │
        ▼
   JSON.parse ──▶ cache ──▶ return Card
```

On the client, a [SharedWorker](https://caniuse.com/sharedworkers) (or regular Worker on Android) loads everything into memory at startup:

```
┌─────────────────────────────────────────────────────────────┐
│                    SharedWorker init                        │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   fetch chunk 0       fetch chunk 1  ...  fetch chunk N     (parallel)
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
              merge into cards: Record<id, Card>
                            │
              ┌─────────────┼─────────────────┐
              ▼             ▼                 ▼
       build id index   build oracle    build MiniSearch
       Map<id, Card>    → printings     fuzzy index
                            │
                            ▼
                   ~115k cards in memory
                   ready for queries
```

```
searchCards("lightning bolt")
        │
        ▼
┌───────────────────────────────────────┐
│           main thread                 │
│  TanStack Query ──▶ Comlink RPC call  │
└───────────────────────────────────────┘
        │ postMessage
        ▼
┌───────────────────────────────────────┐
│         SharedWorker                  │
│                                       │
│  MiniSearch.search("lightning bolt")  │
│         │                             │
│         ▼                             │
│  filter by restrictions (format, CI)  │
│         │                             │
│         ▼                             │
│  return Card[]                        │
└───────────────────────────────────────┘
        │ postMessage
        ▼
   results hydrated in UI
```

Together, the two paths look like this:

```
                     ┌────────────────────────────────┐
                     │       public/data/cards/       │
                     │ ┌────────────────────────────┐ │
                     │ │ cards-000-xxx.json         │ │
                     │ │ cards-001-xxx.json         │ │
                     │ │ ...                        │ │
                     │ │ cards-NNN-xxx.json         │ │
                     │ ├────────────────────────────┤ │
                     │ │ cards-byteindex.bin        │ │
                     │ │ indexes.json               │ │
                     │ │ volatile.bin               │ │
                     │ └────────────────────────────┘ │
                     └────────────────────────────────┘
                            │                 │
            ┌───────────────┘                 └───────────────┐
            │ SSR: binary search                              │ client: load all
            │ + byte slice                                    │ into worker
            ▼                                                 ▼
┌─────────────────────────┐                     ┌─────────────────────────┐
│     CF Worker (SSR)     │                     │   SharedWorker/Worker   │
│                         │                     │                         │
│ byteindex lookup O(logn)│                     │ ~115k cards in RAM      │
│ parse single card       │                     │ MiniSearch index        │
│ LRU cache (cards+chunks)│                     │ scryfall syntax engine  │
└─────────────────────────┘                     └─────────────────────────┘
            │                                                 │
            └───────────────────────┬─────────────────────────┘
                                    ▼
                      TanStack Query cache unifies both
                      (SSR preloads, client hydrates)
```

Once you have all the data in memory, a lot of things get easy. For example, we are able to do [MiniSearch](https://github.com/lucaong/minisearch) powered fuzzy search over cards in near real time, and implement a scryfall query engine and run it over the cards in memory. We can show a virtualized list of all results, and only copy the details for cards across the IPC barrier when they are on screen. A user on 3G can add cards to their decklist or check the language of a card, without enduring the latency of their connection, as long as they had the chunks cached. High latency 4G connections are much more tolerable. Total data over the wire is ~140mb, which is both a lot (sooo much text) and only a little (most sites, including this one, show cards via images, which quickly add up to exceed this amount).

Even though card data lives locally, we still rely on scryfall for their card CDN. This project is only possible because they are so generous with their data export. You can see the script that processes it [here](./scripts/download-scryfall.ts).

## Further Reading

More detailed docs live in `.claude/` although they were written (by claude) to help claude keep track of the finer details of these systems:

- [CARD_DATA.md](./.claude/CARD_DATA.md) - card data pipeline and provider architecture
- [SEARCH.md](./.claude/SEARCH.md) - scryfall-like query engine (lexer → parser → matcher)
- [ATPROTO.md](./.claude/ATPROTO.md) - AT Protocol integration, PDS writes, Slingshot reads
- [DECK_VALIDATION.md](./.claude/DECK_VALIDATION.md) - format rules with MTG comprehensive rules citations
- [DECK_FORMATS.md](./.claude/DECK_FORMATS.md) - import/export format comparison (Arena, Moxfield, MTGO, etc.)

## Beware!

While I have reviewed all the code, the *entirety* of the code in this repo was written by claude. I wrote *most of* the prose, like this README (I hate being made to read someone else's LLM output, and I try not to be a hypocrite). I feel that using claude to write this allowed me to take on developer QOL, powerful UX, and extensive testing that I would not have otherwise--but I also feel it's worth being upfront that the workflow here was iterative reviews with claude, feature by feature, rather than by hand.

## Getting Started

```bash
# nix-direnv (recommended) auto-loads the shell when you cd in
# https://github.com/nix-community/nix-direnv
# the flake includes node 22, typespec, playwright, a patched goat, and LSPs
direnv allow

# or manually: nix develop

# install deps + download scryfall data (~500MB, takes a minute)
npm install

# start dev server on 127.0.0.1:3000 (not localhost, for oauth)
npm run dev
```

Other useful commands:

```bash
npm run test        # run tests
npm run check       # lint + format
npm run typecheck   # type check

npm run lexicons:all   # recompile typespec → lexicons → typescript
```
