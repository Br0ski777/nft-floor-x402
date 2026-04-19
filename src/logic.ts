import type { Hono } from "hono";


// ATXP: requirePayment only fires inside an ATXP context (set by atxpHono middleware).
// For raw x402 requests, the existing @x402/hono middleware handles the gate.
// If neither protocol is active (ATXP_CONNECTION unset), tryRequirePayment is a no-op.
async function tryRequirePayment(price: number): Promise<void> {
  if (!process.env.ATXP_CONNECTION) return;
  try {
    const { requirePayment } = await import("@atxp/server");
    const BigNumber = (await import("bignumber.js")).default;
    await requirePayment({ price: BigNumber(price) });
  } catch (e: any) {
    if (e?.code === -30402) throw e;
  }
}

// ── Cache ──────────────────────────────────────────────────────────────
interface CacheEntry {
  data: any;
  timestamp: number;
}

const COLLECTION_CACHE_TTL = 30_000; // 30 seconds
const RARITY_CACHE_TTL = 60_000; // 60 seconds
const cache = new Map<string, CacheEntry>();

function getCached<T>(key: string, ttl: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttl) return entry.data as T;
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ── Chain-specific base URLs ───────────────────────────────────────────
const RESERVOIR_URLS: Record<string, string> = {
  ethereum: "https://api.reservoir.tools",
  base: "https://api-base.reservoir.tools",
};

function getBaseUrl(chain: string): string {
  return RESERVOIR_URLS[chain.toLowerCase()] || RESERVOIR_URLS.ethereum;
}

// ── ETH price (cached) ────────────────────────────────────────────────
async function fetchEthPrice(): Promise<number | null> {
  const cacheKey = "eth_price_usd";
  const cached = getCached<number>(cacheKey, 30_000);
  if (cached !== null) return cached;

  try {
    const resp = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    );
    const json = await resp.json();
    const price = json.ethereum?.usd ?? null;
    if (price !== null) setCache(cacheKey, price);
    return price;
  } catch {
    return null;
  }
}

// ── Reservoir API helpers ──────────────────────────────────────────────
async function fetchReservoir(baseUrl: string, path: string): Promise<any> {
  const url = `${baseUrl}${path}`;
  const resp = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Reservoir API ${resp.status}: ${text}`);
  }
  return resp.json();
}

// ── Collection data ────────────────────────────────────────────────────
async function fetchCollectionData(address: string, chain: string) {
  const cacheKey = `collection_${chain}_${address}`;
  const cached = getCached<any>(cacheKey, COLLECTION_CACHE_TTL);
  if (cached) return cached;

  const baseUrl = getBaseUrl(chain);
  const [collectionResp, ethPrice] = await Promise.all([
    fetchReservoir(baseUrl, `/collections/v7?id=${address}`),
    fetchEthPrice(),
  ]);

  const collections = collectionResp.collections || [];
  if (collections.length === 0) {
    throw new Error(`Collection not found: ${address} on ${chain}`);
  }

  const col = collections[0];
  const floorAsk = col.floorAsk || {};
  const floorPriceEth = floorAsk.price?.amount?.native ?? null;
  const volume24h = col.volume?.["1day"] ?? null;
  const volume7d = col.volume?.["7day"] ?? null;
  const volume30d = col.volume?.["30day"] ?? null;
  const topBidEth = col.topBid?.price?.amount?.native ?? null;

  const result = {
    name: col.name || address,
    slug: col.slug || null,
    image: col.image || null,
    chain,
    contractAddress: address,
    floorPrice: {
      eth: floorPriceEth,
      usd: floorPriceEth && ethPrice ? parseFloat((floorPriceEth * ethPrice).toFixed(2)) : null,
    },
    topBid: {
      eth: topBidEth,
      usd: topBidEth && ethPrice ? parseFloat((topBidEth * ethPrice).toFixed(2)) : null,
    },
    volume: {
      "24h_eth": volume24h,
      "24h_usd": volume24h && ethPrice ? parseFloat((volume24h * ethPrice).toFixed(2)) : null,
      "7d_eth": volume7d,
      "30d_eth": volume30d,
    },
    totalSupply: col.tokenCount ? parseInt(col.tokenCount) : null,
    holderCount: col.ownerCount ? parseInt(col.ownerCount) : null,
    listedCount: col.onSaleCount ? parseInt(col.onSaleCount) : null,
    listedPercentage:
      col.onSaleCount && col.tokenCount
        ? parseFloat(((parseInt(col.onSaleCount) / parseInt(col.tokenCount)) * 100).toFixed(2))
        : null,
    floorChange: {
      "1day": col.floorSaleChange?.["1day"] ?? null,
      "7day": col.floorSaleChange?.["7day"] ?? null,
      "30day": col.floorSaleChange?.["30day"] ?? null,
    },
    ethPriceUsd: ethPrice,
    cachedFor: "30s",
    timestamp: new Date().toISOString(),
  };

  setCache(cacheKey, result);
  return result;
}

// ── Token rarity ───────────────────────────────────────────────────────
async function fetchTokenRarity(address: string, tokenId: string, chain: string) {
  const cacheKey = `rarity_${chain}_${address}_${tokenId}`;
  const cached = getCached<any>(cacheKey, RARITY_CACHE_TTL);
  if (cached) return cached;

  const baseUrl = getBaseUrl(chain);
  const [tokenResp, ethPrice] = await Promise.all([
    fetchReservoir(baseUrl, `/tokens/v7?tokens=${address}:${tokenId}&includeAttributes=true`),
    fetchEthPrice(),
  ]);

  const tokens = tokenResp.tokens || [];
  if (tokens.length === 0) {
    throw new Error(`Token not found: ${address}:${tokenId} on ${chain}`);
  }

  const tok = tokens[0];
  const token = tok.token || tok;
  const market = tok.market || {};

  const attributes = (token.attributes || []).map((attr: any) => ({
    trait: attr.key,
    value: attr.value,
    tokenCount: attr.tokenCount ? parseInt(attr.tokenCount) : null,
    rarity: attr.tokenCount && token.collection?.tokenCount
      ? parseFloat(
          ((parseInt(attr.tokenCount) / parseInt(token.collection.tokenCount)) * 100).toFixed(2)
        )
      : null,
    floorPrice: attr.floorAskPrice
      ? {
          eth: attr.floorAskPrice,
          usd: ethPrice ? parseFloat((attr.floorAskPrice * ethPrice).toFixed(2)) : null,
        }
      : null,
  }));

  const result = {
    collection: token.collection?.name || address,
    contractAddress: address,
    tokenId,
    chain,
    name: token.name || `#${tokenId}`,
    image: token.image || token.imageSmall || null,
    rarityRank: token.rarityRank ?? null,
    rarityScore: token.rarityScore ? parseFloat(parseFloat(token.rarityScore).toFixed(4)) : null,
    totalSupply: token.collection?.tokenCount ? parseInt(token.collection.tokenCount) : null,
    owner: token.owner || null,
    lastSale: market.lastBuy?.value
      ? {
          eth: market.lastBuy.value,
          usd: ethPrice ? parseFloat((market.lastBuy.value * ethPrice).toFixed(2)) : null,
          timestamp: market.lastBuy.timestamp || null,
        }
      : null,
    currentAsk: market.floorAsk?.price?.amount?.native
      ? {
          eth: market.floorAsk.price.amount.native,
          usd: ethPrice
            ? parseFloat((market.floorAsk.price.amount.native * ethPrice).toFixed(2))
            : null,
        }
      : null,
    attributes,
    attributeCount: attributes.length,
    ethPriceUsd: ethPrice,
    cachedFor: "60s",
    timestamp: new Date().toISOString(),
  };

  setCache(cacheKey, result);
  return result;
}

// ── Route registration ─────────────────────────────────────────────────
export function registerRoutes(app: Hono) {
  app.get("/api/collection", async (c) => {
    await tryRequirePayment(0.005);
    const address = c.req.query("address");
    const chain = c.req.query("chain") || "ethereum";

    if (!address) {
      return c.json(
        {
          error: "Missing required parameter: address",
          example: "/api/collection?address=0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D&chain=ethereum",
          supportedChains: ["ethereum", "base"],
        },
        400
      );
    }

    if (!RESERVOIR_URLS[chain.toLowerCase()]) {
      return c.json(
        { error: `Unsupported chain: ${chain}`, supportedChains: ["ethereum", "base"] },
        400
      );
    }

    try {
      const result = await fetchCollectionData(address, chain.toLowerCase());
      return c.json(result);
    } catch (err: any) {
      return c.json({ error: "Failed to fetch collection data", details: err.message }, 502);
    }
  });

  app.get("/api/rarity", async (c) => {
    await tryRequirePayment(0.003);
    const address = c.req.query("address");
    const tokenId = c.req.query("tokenId");
    const chain = c.req.query("chain") || "ethereum";

    if (!address || !tokenId) {
      return c.json(
        {
          error: "Missing required parameters: address, tokenId",
          example: "/api/rarity?address=0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D&tokenId=1234&chain=ethereum",
          supportedChains: ["ethereum", "base"],
        },
        400
      );
    }

    if (!RESERVOIR_URLS[chain.toLowerCase()]) {
      return c.json(
        { error: `Unsupported chain: ${chain}`, supportedChains: ["ethereum", "base"] },
        400
      );
    }

    try {
      const result = await fetchTokenRarity(address, tokenId, chain.toLowerCase());
      return c.json(result);
    } catch (err: any) {
      return c.json({ error: "Failed to fetch token rarity", details: err.message }, 502);
    }
  });
}
