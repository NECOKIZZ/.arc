import "dotenv/config";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { LRUCache } from "lru-cache";
import QRCode from "qrcode";
import { ARCNames, normalizeName } from "@arc/names";

const PORT = Number(process.env.PORT || "8787");
const ARC_RPC_URL = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
const ANS_REGISTRY_ADDRESS = process.env.ANS_REGISTRY_ADDRESS || "";

if (!ANS_REGISTRY_ADDRESS) {
  throw new Error("ANS_REGISTRY_ADDRESS is required");
}

const ans = new ARCNames({
  rpcUrl: ARC_RPC_URL,
  registryAddress: ANS_REGISTRY_ADDRESS,
  cacheTimeout: 60_000
});

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

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(400).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`ANS API listening on :${PORT}`);
});
