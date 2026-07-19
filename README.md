# NFT Floor Price & Rarity API

[![MCP Server](https://img.shields.io/badge/MCP-server-blue)](https://nft-floor.api.klymax402.com/mcp)
[![x402](https://img.shields.io/badge/payments-x402-6E56CF)](https://x402.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

NFT collection floor price, volume, holders, rarity data. Ethereum and Base via Alchemy. Pay-per-call via [x402](https://x402.org) (USDC on Base L2) -- no API key, no signup, no rate-limit wall.

Part of the [klymax402](https://klymax402.com) marketplace -- 100 x402 micropayment APIs for AI agents, one wallet, USDC on Base.

## Quickstart -- MCP

Add to your MCP client config (Claude Desktop, Cursor, ElizaOS, etc.):

```json
{
  "mcpServers": {
    "nft-floor": {
      "url": "https://nft-floor.api.klymax402.com/mcp"
    }
  }
}
```

## Quickstart -- HTTP (x402)

```bash
curl "https://nft-floor.api.klymax402.com/api/collection?address=0x0000000000000000000000000000000000dEaD"
# -> 402 Payment Required, with an x402 payment challenge in the response body
```

Any x402-aware client ([`@x402/fetch`](https://www.npmjs.com/package/@x402/fetch), [`x402-agent-tools`](https://www.npmjs.com/package/x402-agent-tools), ATXP) handles the 402 -> sign -> retry cycle automatically.

## Tools

| Tool | Method | Path | Price | Description |
|---|---|---|---|---|
| `nft_get_collection_data` | GET | `/api/collection` | $0.012 | Get NFT collection floor price, volume, and stats |
| `nft_get_collection_data` | POST | `/api/collection` | $0.012 | Get NFT collection floor price, volume, and stats (POST variant) |
| `nft_get_token_rarity` | GET | `/api/rarity` | $0.008 | Get NFT token rarity rank, score, and trait floor prices |
| `nft_get_token_rarity` | POST | `/api/rarity` | $0.008 | Get NFT token rarity rank, score, and trait floor prices (POST variant) |

### `nft_get_collection_data`

Use this when you need NFT collection floor price, volume, or holder data. Returns comprehensive collection stats from Alchemy for Ethereum and Base NFTs.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `address` | string | yes | NFT collection contract address. e.g. 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D (BAYC) |
| `chain` | string | no | Blockchain: ethereum or base. Default: ethereum |

**Returns**

- `floorPrice` -- current floor price in ETH and USD
- `volume24h` -- 24-hour trading volume in ETH and USD
- `totalSupply` -- total number of NFTs in the collection
- `holderCount` -- number of unique holders
- `listedCount` -- number of NFTs currently listed for sale
- `listedPercent` -- percentage of supply listed
- `topTraitFloors` -- floor prices broken down by top traits

Example response:

```json
{"floorPrice":{"eth":12.5,"usd":44000},"volume24h":{"eth":89.3,"usd":314000},"totalSupply":10000,"holderCount":5421,"listedCount":312,"listedPercent":3.12,"topTraitFloors":[{"trait":"Gold Fur","floor":45.2}]}
```

**When to use**: tracking NFT collection values, comparing collections, or monitoring floor price movements. Essential for NFT portfolio valuation and market analysis.

### `nft_get_collection_data`

Use this when you need NFT collection floor price, volume, or holder data. Returns comprehensive collection stats from Alchemy for Ethereum and Base NFTs. POST variant of nft_get_collection_data -- same params passed as JSON body instead of query string.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `address` | string | yes | NFT collection contract address. e.g. 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D (BAYC) |
| `chain` | string | no | Blockchain: ethereum or base. Default: ethereum |

**Returns**

- `floorPrice` -- current floor price in ETH and USD
- `volume24h` -- 24-hour trading volume in ETH and USD
- `totalSupply` -- total number of NFTs in the collection
- `holderCount` -- number of unique holders
- `listedCount` -- number of NFTs currently listed for sale
- `listedPercent` -- percentage of supply listed
- `topTraitFloors` -- floor prices broken down by top traits

Example response:

```json
{"floorPrice":{"eth":12.5,"usd":44000},"volume24h":{"eth":89.3,"usd":314000},"totalSupply":10000,"holderCount":5421,"listedCount":312,"listedPercent":3.12,"topTraitFloors":[{"trait":"Gold Fur","floor":45.2}]}
```

**When to use**: tracking NFT collection values, comparing collections, or monitoring floor price movements. Essential for NFT portfolio valuation and market analysis.

### `nft_get_token_rarity`

Use this when you need rarity data for a specific NFT token. Returns rarity rank, score, attributes, and trait-level floor prices for valuation.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `address` | string | yes | NFT collection contract address |
| `tokenId` | string | yes | Token ID within the collection. e.g. 1234 |
| `chain` | string | no | Blockchain: ethereum or base. Default: ethereum |

**Returns**

- `rarityRank` -- token's rarity rank within the collection (e.g. 142 out of 10000)
- `rarityScore` -- computed rarity score
- `totalSupply` -- total tokens in the collection
- `attributes` -- array of token traits with name, value, frequency, and trait floor price
- `estimatedValue` -- estimated value based on rarity and trait floors

Example response:

```json
{"rarityRank":142,"rarityScore":285.4,"totalSupply":10000,"attributes":[{"trait":"Background","value":"Gold","frequency":0.02,"traitFloor":18.5},{"trait":"Eyes","value":"Laser","frequency":0.04,"traitFloor":15.2}],"estimatedValue":{"eth":22.3,"usd":78500}}
```

**When to use**: valuing individual NFTs, finding underpriced tokens, or building rarity-based trading strategies.

### `nft_get_token_rarity`

Use this when you need rarity data for a specific NFT token. Returns rarity rank, score, attributes, and trait-level floor prices for valuation. POST variant of nft_get_token_rarity -- same params passed as JSON body instead of query string.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `address` | string | yes | NFT collection contract address |
| `tokenId` | string | yes | Token ID within the collection. e.g. 1234 |
| `chain` | string | no | Blockchain: ethereum or base. Default: ethereum |

**Returns**

- `rarityRank` -- token's rarity rank within the collection (e.g. 142 out of 10000)
- `rarityScore` -- computed rarity score
- `totalSupply` -- total tokens in the collection
- `attributes` -- array of token traits with name, value, frequency, and trait floor price
- `estimatedValue` -- estimated value based on rarity and trait floors

Example response:

```json
{"rarityRank":142,"rarityScore":285.4,"totalSupply":10000,"attributes":[{"trait":"Background","value":"Gold","frequency":0.02,"traitFloor":18.5},{"trait":"Eyes","value":"Laser","frequency":0.04,"traitFloor":15.2}],"estimatedValue":{"eth":22.3,"usd":78500}}
```

**When to use**: valuing individual NFTs, finding underpriced tokens, or building rarity-based trading strategies.

## Example agent prompts

- "NFT collection floor price, volume, or holder data"
- "NFT collection floor price, volume, or holder data"
- "Rarity data for a specific NFT token"

## Payment

- Protocol: [x402](https://x402.org) -- HTTP-native pay-per-call, no signup, no API key
- Network: Base L2 (`eip155:8453`)
- Asset: USDC
- Facilitator: Coinbase CDP (primary), PayAI (fallback)
- Also reachable via [ATXP](https://atxp.ai) (OAuth-wrapped x402, RFC 9728 protected-resource metadata)

## Part of klymax402

100 x402 micropayment APIs for AI agents -- one wallet, USDC on Base, zero signup.

- Catalog: https://klymax402.com/llms.txt
- Full API reference: https://klymax402.com/llms-full.txt
- Live stats: https://klymax402.com/stats

## License

MIT
