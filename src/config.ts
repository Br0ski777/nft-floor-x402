import type { ApiConfig } from "./shared";

export const API_CONFIG: ApiConfig = {
  name: "nft-floor",
  slug: "nft-floor",
  description: "NFT collection floor price, volume, rarity data via Reservoir.",
  version: "1.0.0",
  routes: [
    {
      method: "GET",
      path: "/api/collection",
      price: "$0.005",
      description: "Get NFT collection floor price, volume, and stats",
      toolName: "nft_get_collection_data",
      toolDescription:
        "Use this when you need NFT collection floor price, volume, or rarity data. Returns floor price, 24h volume, total supply, holder count, listed count, top trait floors. Supports Ethereum and Base collections. Powered by Reservoir. Do NOT use for token safety — use token_check_safety. Do NOT use for wallet holdings — use wallet_get_portfolio.",
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
    },
    {
      method: "GET",
      path: "/api/rarity",
      price: "$0.003",
      description: "Get NFT token rarity rank, score, and trait floor prices",
      toolName: "nft_get_token_rarity",
      toolDescription:
        "Use this when you need rarity data for a specific NFT token. Returns rarity rank, rarity score, token attributes with trait floor prices. Supports Ethereum and Base. Do NOT use for collection-level stats — use nft_get_collection_data. Do NOT use for wallet holdings — use wallet_get_portfolio.",
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
    },
  ],
};
