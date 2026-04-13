import type { ApiConfig } from "./shared";

export const API_CONFIG: ApiConfig = {
  name: "nft-floor",
  slug: "nft-floor",
  description: "NFT collection floor price, volume, holders, rarity data. Ethereum and Base via Reservoir.",
  version: "1.0.0",
  routes: [
    {
      method: "GET",
      path: "/api/collection",
      price: "$0.005",
      description: "Get NFT collection floor price, volume, and stats",
      toolName: "nft_get_collection_data",
      toolDescription: `Use this when you need NFT collection floor price, volume, or holder data. Returns comprehensive collection stats from Reservoir for Ethereum and Base NFTs.

1. floorPrice: current floor price in ETH and USD
2. volume24h: 24-hour trading volume in ETH and USD
3. totalSupply: total number of NFTs in the collection
4. holderCount: number of unique holders
5. listedCount: number of NFTs currently listed for sale
6. listedPercent: percentage of supply listed
7. topTraitFloors: floor prices broken down by top traits

Example output: {"floorPrice":{"eth":12.5,"usd":44000},"volume24h":{"eth":89.3,"usd":314000},"totalSupply":10000,"holderCount":5421,"listedCount":312,"listedPercent":3.12,"topTraitFloors":[{"trait":"Gold Fur","floor":45.2}]}

Use this FOR tracking NFT collection values, comparing collections, or monitoring floor price movements. Essential for NFT portfolio valuation and market analysis.

Do NOT use for individual token rarity -- use nft_get_token_rarity. Do NOT use for wallet holdings -- use wallet_get_portfolio. Do NOT use for token safety -- use token_check_safety.`,
      inputSchema: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "NFT collection contract address. e.g. 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D (BAYC)",
          },
          chain: {
            type: "string",
            description: "Blockchain: ethereum or base. Default: ethereum",
          },
        },
        required: ["address"],
      },
      outputSchema: {
          "type": "object",
          "properties": {
            "address": {
              "type": "string",
              "description": "Contract address"
            },
            "chain": {
              "type": "string",
              "description": "Blockchain"
            },
            "name": {
              "type": "string",
              "description": "Collection name"
            },
            "floorPrice": {
              "type": "number",
              "description": "Floor price in ETH"
            },
            "floorPriceUsd": {
              "type": "number"
            },
            "totalSupply": {
              "type": "number"
            },
            "owners": {
              "type": "number"
            },
            "volume24h": {
              "type": "number"
            }
          },
          "required": [
            "address",
            "chain"
          ]
        },
    },
    {
      method: "GET",
      path: "/api/rarity",
      price: "$0.003",
      description: "Get NFT token rarity rank, score, and trait floor prices",
      toolName: "nft_get_token_rarity",
      toolDescription: `Use this when you need rarity data for a specific NFT token. Returns rarity rank, score, attributes, and trait-level floor prices for valuation.

1. rarityRank: token's rarity rank within the collection (e.g. 142 out of 10000)
2. rarityScore: computed rarity score
3. totalSupply: total tokens in the collection
4. attributes: array of token traits with name, value, frequency, and trait floor price
5. estimatedValue: estimated value based on rarity and trait floors

Example output: {"rarityRank":142,"rarityScore":285.4,"totalSupply":10000,"attributes":[{"trait":"Background","value":"Gold","frequency":0.02,"traitFloor":18.5},{"trait":"Eyes","value":"Laser","frequency":0.04,"traitFloor":15.2}],"estimatedValue":{"eth":22.3,"usd":78500}}

Use this FOR valuing individual NFTs, finding underpriced tokens, or building rarity-based trading strategies.

Do NOT use for collection-level stats -- use nft_get_collection_data. Do NOT use for wallet holdings -- use wallet_get_portfolio. Do NOT use for token safety checks -- use token_check_safety.`,
      inputSchema: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "NFT collection contract address",
          },
          tokenId: {
            type: "string",
            description: "Token ID within the collection. e.g. 1234",
          },
          chain: {
            type: "string",
            description: "Blockchain: ethereum or base. Default: ethereum",
          },
        },
        required: ["address", "tokenId"],
      },
      outputSchema: {
          "type": "object",
          "properties": {
            "address": {
              "type": "string"
            },
            "tokenId": {
              "type": "string"
            },
            "chain": {
              "type": "string"
            },
            "rarityScore": {
              "type": "number"
            },
            "rarityRank": {
              "type": "number"
            },
            "traits": {
              "type": "array",
              "items": {
                "type": "object"
              }
            }
          },
          "required": [
            "address",
            "tokenId"
          ]
        },
    },
  ],
};
