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

// ── Chain-specific Alchemy NFT API base URLs ───────────────────────────
// Reservoir (former data source) was fully decommissioned -- reservoir.tools
// pivoted to an unrelated crosschain-payments product, api.reservoir.tools /
// api-base.reservoir.tools no longer resolve in DNS (confirmed 2026-07-03).
// Migrated to Alchemy NFT API v3, which requires an app-scoped API key.
const ALCHEMY_URLS: Record<string, string> = {
  ethereum: "https://eth-mainnet.g.alchemy.com/nft/v3",
  base: "https://base-mainnet.g.alchemy.com/nft/v3",
};

const SUPPORTED_CHAINS = Object.keys(ALCHEMY_URLS);

function getBaseUrl(chain: string): string {
  return ALCHEMY_URLS[chain.toLowerCase()] || ALCHEMY_URLS.ethereum;
}

function getAlchemyKey(): string {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) throw new Error("ALCHEMY_API_KEY not configured");
  return key;
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

// ── Alchemy NFT API helpers ─────────────────────────────────────────────
async function fetchAlchemy(baseUrl: string, path: string): Promise<any> {
  const url = `${baseUrl}${path}`;
  const resp = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Alchemy NFT API ${resp.status}: ${text}`);
  }
  return resp.json();
}

// ── Collection data ────────────────────────────────────────────────────
async function fetchCollectionData(address: string, chain: string) {
  const cacheKey = `collection_${chain}_${address}`;
  const cached = getCached<any>(cacheKey, COLLECTION_CACHE_TTL);
  if (cached) return cached;

  const key = getAlchemyKey();
  const baseUrl = getBaseUrl(chain);
  const [contractResp, floorResp, ownersResp, ethPrice] = await Promise.all([
    fetchAlchemy(baseUrl, `/${key}/getContractMetadata?contractAddress=${address}`),
    fetchAlchemy(baseUrl, `/${key}/getFloorPrice?contractAddress=${address}`).catch(() => null),
    fetchAlchemy(baseUrl, `/${key}/getOwnersForContract?contractAddress=${address}&withTokenBalances=false`).catch(() => null),
    fetchEthPrice(),
  ]);

  if (!contractResp || !contractResp.address) {
    throw new Error(`Collection not found: ${address} on ${chain}`);
  }

  const openSeaFloor = floorResp?.openSea?.error ? null : floorResp?.openSea?.floorPrice ?? null;
  const looksRareFloor = floorResp?.looksRare?.error ? null : floorResp?.looksRare?.floorPrice ?? null;
  const floorPriceEth = openSeaFloor ?? looksRareFloor ?? contractResp.openSeaMetadata?.floorPrice ?? null;
  const holderCount = ownersResp && !ownersResp.pageKey ? (ownersResp.owners || []).length : null;

  const result = {
    name: contractResp.name || contractResp.openSeaMetadata?.collectionName || address,
    slug: contractResp.openSeaMetadata?.collectionSlug || null,
    image: contractResp.openSeaMetadata?.imageUrl || null,
    chain,
    contractAddress: address,
    floorPrice: {
      eth: floorPriceEth,
      usd: floorPriceEth && ethPrice ? parseFloat((floorPriceEth * ethPrice).toFixed(2)) : null,
      sources: { openSea: openSeaFloor, looksRare: looksRareFloor },
    },
    totalSupply: contractResp.totalSupply ? parseInt(contractResp.totalSupply) : null,
    holderCount,
    ethPriceUsd: ethPrice,
    source: "alchemy",
    cachedFor: "30s",
    timestamp: new Date().toISOString(),
  };

  setCache(cacheKey, result);
  return result;
}

// ── Collection-wide trait frequency (for rarity scoring) ───────────────
// Alchemy doesn't provide a precomputed rarity rank like Reservoir did --
// this computes a standard trait-rarity score (sum of 1/frequency per trait)
// from Alchemy's attribute summary. No exact numeric rank across the full
// collection (would require scoring every token), but real, live frequency
// data -- not a stub. Cached longer since trait distribution rarely changes.
const ATTRIBUTE_SUMMARY_CACHE_TTL = 600_000; // 10 minutes

async function fetchAttributeSummary(address: string, chain: string): Promise<Record<string, Record<string, number>>> {
  const cacheKey = `attrsummary_${chain}_${address}`;
  const cached = getCached<any>(cacheKey, ATTRIBUTE_SUMMARY_CACHE_TTL);
  if (cached) return cached;

  const key = getAlchemyKey();
  const baseUrl = getBaseUrl(chain);
  const resp = await fetchAlchemy(baseUrl, `/${key}/summarizeNFTAttributes?contractAddress=${address}`);
  const summary = resp.summary || {};
  setCache(cacheKey, summary);
  return summary;
}

// ── Token rarity ───────────────────────────────────────────────────────
async function fetchTokenRarity(address: string, tokenId: string, chain: string) {
  const cacheKey = `rarity_${chain}_${address}_${tokenId}`;
  const cached = getCached<any>(cacheKey, RARITY_CACHE_TTL);
  if (cached) return cached;

  const key = getAlchemyKey();
  const baseUrl = getBaseUrl(chain);
  const [tokenResp, attrSummary, ethPrice] = await Promise.all([
    fetchAlchemy(baseUrl, `/${key}/getNFTMetadata?contractAddress=${address}&tokenId=${tokenId}&refreshCache=false`),
    fetchAttributeSummary(address, chain).catch(() => ({})),
    fetchEthPrice(),
  ]);

  if (!tokenResp || !tokenResp.tokenId) {
    throw new Error(`Token not found: ${address}:${tokenId} on ${chain}`);
  }

  const totalSupply = tokenResp.contract?.totalSupply ? parseInt(tokenResp.contract.totalSupply) : null;
  const rawAttributes: { trait_type?: string; value?: string | number }[] =
    tokenResp.raw?.metadata?.attributes || [];

  let rarityScore = 0;
  const attributes = rawAttributes.map((attr) => {
    const traitType = String(attr.trait_type ?? "unknown");
    const value = String(attr.value ?? "");
    const frequency = attrSummary[traitType]?.[value] ?? null;
    const rarityPercent = frequency && totalSupply ? parseFloat(((frequency / totalSupply) * 100).toFixed(2)) : null;
    if (frequency) rarityScore += 1 / frequency;
    return {
      trait: traitType,
      value,
      tokenCount: frequency,
      rarity: rarityPercent,
    };
  });

  const result = {
    collection: tokenResp.contract?.name || address,
    contractAddress: address,
    tokenId,
    chain,
    name: tokenResp.name || tokenResp.raw?.metadata?.name || `#${tokenId}`,
    image: tokenResp.image?.originalUrl || tokenResp.image?.cachedUrl || null,
    rarityScore: rarityScore > 0 ? parseFloat(rarityScore.toFixed(4)) : null,
    totalSupply,
    attributes,
    attributeCount: attributes.length,
    ethPriceUsd: ethPrice,
    source: "alchemy",
    note: "rarityScore is a live trait-frequency score (sum of 1/frequency per trait). No global numeric rank is computed (would require scoring the full collection).",
    cachedFor: "60s",
    timestamp: new Date().toISOString(),
  };

  setCache(cacheKey, result);
  return result;
}

// ── Route registration ─────────────────────────────────────────────────
export function registerRoutes(app: Hono) {
  async function handleCollection(c: any, params: { address?: string; chain?: string }) {
    await tryRequirePayment(0.005);
    const address = params.address;
    const chain = params.chain || "ethereum";

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

    if (!ALCHEMY_URLS[chain.toLowerCase()]) {
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
  }

  async function handleRarity(c: any, params: { address?: string; tokenId?: string; chain?: string }) {
    await tryRequirePayment(0.003);
    const address = params.address;
    const tokenId = params.tokenId;
    const chain = params.chain || "ethereum";

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

    if (!ALCHEMY_URLS[chain.toLowerCase()]) {
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
  }

  app.get("/api/collection", async (c) => {
    return handleCollection(c, {
      address: c.req.query("address"),
      chain: c.req.query("chain"),
    });
  });

  // POST mirror of the GET route above -- Bazaar (CDP) only reliably indexes
  // POST payments with valid payloads (~82% conversion vs ~14% for GET-only
  // resources, confirmed empirically). Same params, same logic, just body
  // instead of query string.
  app.post("/api/collection", async (c) => {
    const body = await c.req.json().catch(() => ({}) as any);
    return handleCollection(c, {
      address: body.address,
      chain: body.chain,
    });
  });

  app.get("/api/rarity", async (c) => {
    return handleRarity(c, {
      address: c.req.query("address"),
      tokenId: c.req.query("tokenId"),
      chain: c.req.query("chain"),
    });
  });

  // POST mirror of the GET route above -- same rationale as /api/collection.
  app.post("/api/rarity", async (c) => {
    const body = await c.req.json().catch(() => ({}) as any);
    return handleRarity(c, {
      address: body.address,
      tokenId: body.tokenId,
      chain: body.chain,
    });
  });
}
