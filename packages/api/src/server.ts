import "dotenv/config";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { LRUCache } from "lru-cache";
import QRCode from "qrcode";
import { Wallet, JsonRpcProvider } from "ethers";
import { ARCNames, normalizeName, ANS_REGISTRY_ADDRESSES, ANS_RPC_URLS } from "@arc/names";

const ARC_CHAIN_ID = Number(process.env.ARC_CHAIN_ID || "5042002");
const PORT = Number(process.env.PORT || "8787");
const ARC_RPC_URL = process.env.ARC_RPC_URL || ANS_RPC_URLS[ARC_CHAIN_ID] || "https://rpc.testnet.arc.network";
const ANS_REGISTRY_ADDRESS = process.env.ANS_REGISTRY_ADDRESS || ANS_REGISTRY_ADDRESSES[ARC_CHAIN_ID] || "";
const AGENT_API_KEY = process.env.AGENT_API_KEY || "";
const REGISTRAR_PRIVATE_KEY = process.env.REGISTRAR_PRIVATE_KEY || "";

if (!ANS_REGISTRY_ADDRESS) {
  throw new Error("ANS_REGISTRY_ADDRESS is required");
}

const ans = new ARCNames({
  rpcUrl: ARC_RPC_URL,
  registryAddress: ANS_REGISTRY_ADDRESS,
  cacheTimeout: 60_000
});

// Server-side signer for agent/payment registrations (optional — only if key configured)
let registrarAns: ARCNames | null = null;
if (REGISTRAR_PRIVATE_KEY) {
  const registrarProvider = new JsonRpcProvider(ARC_RPC_URL);
  const registrarSigner = new Wallet(REGISTRAR_PRIVATE_KEY, registrarProvider);
  registrarAns = new ARCNames({
    rpcUrl: ARC_RPC_URL,
    registryAddress: ANS_REGISTRY_ADDRESS,
    signer: registrarSigner,
  });
  console.log(`Registrar wallet: ${registrarSigner.address}`);
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false
  })
);

const apiCache = new LRUCache<string, any>({
  max: 5000,
  ttl: 30_000
});

function cacheGet<T>(key: string): T | null {
  const cached = apiCache.get(key);
  return cached === undefined ? null : (cached as T);
}

function cacheSet<T>(key: string, value: T, ttlMs = 30_000): T {
  apiCache.set(key, value, { ttl: ttlMs });
  return value;
}

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    network: "arcTestnet",
    chainId: 5042002,
    timestamp: new Date().toISOString()
  });
});

app.get("/resolve/:name", async (req, res, next) => {
  try {
    const label = normalizeName(req.params.name);
    const cacheKey = `resolve:${label}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const info = await ans.getNameInfo(label);
    const payload = {
      name: `${label}.arc`,
      address: info.address,
      owner: info.owner,
      expiry: info.expiry,
      resolved: Boolean(info.address)
    };
    res.json(cacheSet(cacheKey, payload));
  } catch (error) {
    next(error);
  }
});

app.get("/reverse/:address", async (req, res, next) => {
  try {
    const cacheKey = `reverse:${req.params.address.toLowerCase()}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const name = await ans.reverseLookup(req.params.address);
    const payload = {
      address: req.params.address,
      name,
      resolved: Boolean(name)
    };
    res.json(cacheSet(cacheKey, payload));
  } catch (error) {
    next(error);
  }
});

app.get("/available/:name", async (req, res, next) => {
  try {
    const label = normalizeName(req.params.name);
    const cacheKey = `available:${label}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const payload = {
      name: `${label}.arc`,
      available: await ans.isAvailable(label)
    };
    res.json(cacheSet(cacheKey, payload));
  } catch (error) {
    next(error);
  }
});

app.get("/profile/:name", async (req, res, next) => {
  try {
    const label = normalizeName(req.params.name);
    const cacheKey = `profile:${label}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const info = await ans.getNameInfo(label);
    const payload = {
      name: `${label}.arc`,
      address: info.address,
      expiry: info.expiry,
      qrUrl: `${req.protocol}://${req.get("host")}/qr/${label}.arc`,
      profileUrl: `${req.protocol}://${req.get("host")}/profile/${label}.arc`
    };
    res.json(cacheSet(cacheKey, payload));
  } catch (error) {
    next(error);
  }
});

app.get("/qr/:name", async (req, res, next) => {
  try {
    const label = normalizeName(req.params.name);
    const size = Math.max(100, Math.min(Number(req.query.size || "300"), 1000));
    const format = (req.query.format || "png").toString().toLowerCase();
    const payload = `https://arcnames.io/pay/${label}.arc`;
    const cacheKey = `qr:${label}:${size}:${format}`;
    const cached = cacheGet<string>(cacheKey);

    if (format === "svg") {
      const svg = cached || (await QRCode.toString(payload, { type: "svg", width: size, errorCorrectionLevel: "M" }));
      cacheSet(cacheKey, svg);
      res.setHeader("Content-Type", "image/svg+xml");
      return res.send(svg);
    }

    const imageData = cached || (await QRCode.toDataURL(payload, { width: size, errorCorrectionLevel: "M" }));
    cacheSet(cacheKey, imageData);
    const base64 = imageData.replace(/^data:image\/png;base64,/, "");
    res.setHeader("Content-Type", "image/png");
    return res.send(Buffer.from(base64, "base64"));
  } catch (error) {
    next(error);
  }
});

// ── Agent & Payment App API ──────────────────────────────────────────

function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!AGENT_API_KEY) {
    return res.status(503).json({ error: "Agent API not configured. Set AGENT_API_KEY env var." });
  }
  const provided = req.headers["x-api-key"] || req.headers.authorization?.replace("Bearer ", "");
  if (provided !== AGENT_API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key. Pass via x-api-key header." });
  }
  next();
}

const agentLimiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });

// GET /agent/check/:name — check availability (name must end with -agent)
app.get("/agent/check/:name", async (req, res, next) => {
  try {
    const raw = req.params.name;
    const label = normalizeName(raw);
    if (!label.endsWith("-agent")) {
      return res.status(400).json({ error: "Agent names must end with '-agent' (e.g., mybot-agent.arc)" });
    }
    const available = await ans.isAvailable(label);
    const quote = await ans.quotePrice(label);
    res.json({
      name: `${label}.arc`,
      available,
      registrationFeeUSDC: Number(quote) / 1e6,
    });
  } catch (error) { next(error); }
});

// POST /agent/register — register an agent name (requires -agent suffix + API key)
app.post("/agent/register", requireApiKey, agentLimiter, async (req, res, next) => {
  try {
    if (!registrarAns) {
      return res.status(503).json({ error: "Server-side registration not configured. Set REGISTRAR_PRIVATE_KEY env var." });
    }
    const { name, owner } = req.body || {};
    if (!name || !owner) {
      return res.status(400).json({ error: "Missing required fields: name, owner" });
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) {
      return res.status(400).json({ error: "Invalid owner address" });
    }
    const label = normalizeName(name);
    if (!label.endsWith("-agent")) {
      return res.status(400).json({ error: "Agent names must end with '-agent' (e.g., mybot-agent.arc)" });
    }
    const available = await ans.isAvailable(label);
    if (!available) {
      return res.status(409).json({ error: `${label}.arc is already taken` });
    }
    const txHash = await registrarAns.register(label, owner);
    res.json({
      success: true,
      name: `${label}.arc`,
      owner,
      txHash,
      network: "arc-testnet",
      chainId: ARC_CHAIN_ID,
    });
  } catch (error) { next(error); }
});

// GET /payment/check/:name — check availability (name must end with -usdc)
app.get("/payment/check/:name", async (req, res, next) => {
  try {
    const raw = req.params.name;
    const label = normalizeName(raw);
    if (!label.endsWith("-usdc")) {
      return res.status(400).json({ error: "Payment app names must end with '-usdc' (e.g., payflow-usdc.arc)" });
    }
    const available = await ans.isAvailable(label);
    const quote = await ans.quotePrice(label);
    res.json({
      name: `${label}.arc`,
      available,
      registrationFeeUSDC: Number(quote) / 1e6,
    });
  } catch (error) { next(error); }
});

// POST /payment/register — register a payment app name (requires -usdc suffix + API key)
app.post("/payment/register", requireApiKey, agentLimiter, async (req, res, next) => {
  try {
    if (!registrarAns) {
      return res.status(503).json({ error: "Server-side registration not configured. Set REGISTRAR_PRIVATE_KEY env var." });
    }
    const { name, owner } = req.body || {};
    if (!name || !owner) {
      return res.status(400).json({ error: "Missing required fields: name, owner" });
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) {
      return res.status(400).json({ error: "Invalid owner address" });
    }
    const label = normalizeName(name);
    if (!label.endsWith("-usdc")) {
      return res.status(400).json({ error: "Payment app names must end with '-usdc' (e.g., payflow-usdc.arc)" });
    }
    const available = await ans.isAvailable(label);
    if (!available) {
      return res.status(409).json({ error: `${label}.arc is already taken` });
    }
    const txHash = await registrarAns.register(label, owner);
    res.json({
      success: true,
      name: `${label}.arc`,
      owner,
      txHash,
      network: "arc-testnet",
      chainId: ARC_CHAIN_ID,
    });
  } catch (error) { next(error); }
});

// ── Error handler ────────────────────────────────────────────────────

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(400).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`ANS API listening on :${PORT}`);
});
