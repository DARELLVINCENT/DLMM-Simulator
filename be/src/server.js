/*
DLMM Simulator Backend — Express + PostgreSQL

Struktur project yang disarankan:

backend/
  package.json
  .env
  src/
    server.js

Cara menjalankan:
1. cd backend
2. npm install
3. Buat database PostgreSQL, misalnya: dlmm_simulator
4. Isi file .env
5. npm run dev

============================================================
FILE: package.json
============================================================
{
  "name": "dlmm-simulator-backend",
  "version": "1.0.0",
  "type": "module",
  "main": "src/server.js",
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js"
  },
  "dependencies": {
    "cors": "latest",
    "dotenv": "latest",
    "express": "latest",
    "helmet": "latest",
    "pg": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "nodemon": "latest"
  }
}

============================================================
FILE: .env
============================================================
PORT=4000
DATABASE_URL=postgresql://postgres:password@localhost:5432/dlmm_simulator
CLIENT_ORIGIN=http://localhost:5173

============================================================
FILE: src/server.js
============================================================
*/

import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import pg from "pg";
import { z } from "zod";

dotenv.config();

const { Pool } = pg;

const PORT = Number(process.env.PORT || 4000);
const DATABASE_URL = process.env.DATABASE_URL;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL belum diatur di file .env");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json({ limit: "1mb" }));

const simulationSchema = z.object({
  label: z.string().trim().max(120).optional().default("Untitled Simulation"),
  strategy: z.enum(["spot", "curve", "bidask"]),
  capital: z.number().positive(),
  dailyVolume: z.number().nonnegative(),
  poolTvl: z.number().positive(),
  baseFee: z.number().nonnegative(),
  volatilityBoost: z.number().nonnegative(),
  rangePercent: z.number().positive(),
  priceNow: z.number().positive(),
  lowerPrice: z.number().positive(),
  upperPrice: z.number().positive(),
});

const STRATEGY_MULTIPLIERS = {
  spot: 0.75,
  curve: 1,
  bidask: 1.2,
};

function calculateSimulation(input) {
  const effectiveFee = Math.max(0, input.baseFee + input.volatilityBoost);
  const shareOfPool = input.poolTvl > 0 ? input.capital / input.poolTvl : 0;
  const rangeConcentration = Math.max(0.2, Math.min(2.5, 10 / Math.max(input.rangePercent, 1)));
  const strategyMultiplier = STRATEGY_MULTIPLIERS[input.strategy];

  const estimatedDailyFee =
    input.dailyVolume *
    (effectiveFee / 100) *
    shareOfPool *
    rangeConcentration *
    strategyMultiplier;

  const estimatedMonthlyFee = estimatedDailyFee * 30;
  const estimatedYearlyFee = estimatedDailyFee * 365;
  const apr = input.capital > 0 ? (estimatedYearlyFee / input.capital) * 100 : 0;
  const lowerBound = input.priceNow * (1 - input.rangePercent / 100);
  const upperBound = input.priceNow * (1 + input.rangePercent / 100);
  const inManualRange = input.priceNow >= input.lowerPrice && input.priceNow <= input.upperPrice;
  const rangeWidth = input.upperPrice > input.lowerPrice
    ? ((input.upperPrice - input.lowerPrice) / input.priceNow) * 100
    : 0;

  return {
    effectiveFee,
    shareOfPool,
    rangeConcentration,
    estimatedDailyFee,
    estimatedMonthlyFee,
    estimatedYearlyFee,
    apr,
    lowerBound,
    upperBound,
    inManualRange,
    rangeWidth,
  };
}

async function migrate() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS simulations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      label TEXT NOT NULL DEFAULT 'Untitled Simulation',
      strategy TEXT NOT NULL CHECK (strategy IN ('spot', 'curve', 'bidask')),

      capital NUMERIC(18, 6) NOT NULL CHECK (capital > 0),
      daily_volume NUMERIC(18, 6) NOT NULL CHECK (daily_volume >= 0),
      pool_tvl NUMERIC(18, 6) NOT NULL CHECK (pool_tvl > 0),
      base_fee NUMERIC(10, 6) NOT NULL CHECK (base_fee >= 0),
      volatility_boost NUMERIC(10, 6) NOT NULL CHECK (volatility_boost >= 0),
      range_percent NUMERIC(10, 6) NOT NULL CHECK (range_percent > 0),
      price_now NUMERIC(18, 6) NOT NULL CHECK (price_now > 0),
      lower_price NUMERIC(18, 6) NOT NULL CHECK (lower_price > 0),
      upper_price NUMERIC(18, 6) NOT NULL CHECK (upper_price > 0),

      effective_fee NUMERIC(10, 6) NOT NULL,
      share_of_pool NUMERIC(18, 12) NOT NULL,
      range_concentration NUMERIC(10, 6) NOT NULL,
      estimated_daily_fee NUMERIC(18, 6) NOT NULL,
      estimated_monthly_fee NUMERIC(18, 6) NOT NULL,
      estimated_yearly_fee NUMERIC(18, 6) NOT NULL,
      apr NUMERIC(18, 6) NOT NULL,
      lower_bound NUMERIC(18, 6) NOT NULL,
      upper_bound NUMERIC(18, 6) NOT NULL,
      in_manual_range BOOLEAN NOT NULL,
      range_width NUMERIC(18, 6) NOT NULL,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_simulations_created_at
    ON simulations (created_at DESC);
  `);
}

function toNumberRow(row) {
  return {
    id: row.id,
    label: row.label,
    strategy: row.strategy,
    capital: Number(row.capital),
    dailyVolume: Number(row.daily_volume),
    poolTvl: Number(row.pool_tvl),
    baseFee: Number(row.base_fee),
    volatilityBoost: Number(row.volatility_boost),
    rangePercent: Number(row.range_percent),
    priceNow: Number(row.price_now),
    lowerPrice: Number(row.lower_price),
    upperPrice: Number(row.upper_price),
    result: {
      effectiveFee: Number(row.effective_fee),
      shareOfPool: Number(row.share_of_pool),
      rangeConcentration: Number(row.range_concentration),
      estimatedDailyFee: Number(row.estimated_daily_fee),
      estimatedMonthlyFee: Number(row.estimated_monthly_fee),
      estimatedYearlyFee: Number(row.estimated_yearly_fee),
      apr: Number(row.apr),
      lowerBound: Number(row.lower_bound),
      upperBound: Number(row.upper_bound),
      inManualRange: row.in_manual_range,
      rangeWidth: Number(row.range_width),
    },
    createdAt: row.created_at,
  };
}

app.get("/health", async (_req, res) => {
  const db = await pool.query("SELECT NOW() AS now");
  res.json({ status: "ok", databaseTime: db.rows[0].now });
});

app.post("/api/simulations/calculate", (req, res) => {
  const parsed = simulationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Input simulasi tidak valid",
      errors: parsed.error.flatten(),
    });
  }

  const result = calculateSimulation(parsed.data);
  res.json({ input: parsed.data, result });
});

app.post("/api/simulations", async (req, res, next) => {
  try {
    const parsed = simulationSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Input simulasi tidak valid",
        errors: parsed.error.flatten(),
      });
    }

    const input = parsed.data;
    const result = calculateSimulation(input);

    const query = `
      INSERT INTO simulations (
        label,
        strategy,
        capital,
        daily_volume,
        pool_tvl,
        base_fee,
        volatility_boost,
        range_percent,
        price_now,
        lower_price,
        upper_price,
        effective_fee,
        share_of_pool,
        range_concentration,
        estimated_daily_fee,
        estimated_monthly_fee,
        estimated_yearly_fee,
        apr,
        lower_bound,
        upper_bound,
        in_manual_range,
        range_width
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      )
      RETURNING *;
    `;

    const values = [
      input.label,
      input.strategy,
      input.capital,
      input.dailyVolume,
      input.poolTvl,
      input.baseFee,
      input.volatilityBoost,
      input.rangePercent,
      input.priceNow,
      input.lowerPrice,
      input.upperPrice,
      result.effectiveFee,
      result.shareOfPool,
      result.rangeConcentration,
      result.estimatedDailyFee,
      result.estimatedMonthlyFee,
      result.estimatedYearlyFee,
      result.apr,
      result.lowerBound,
      result.upperBound,
      result.inManualRange,
      result.rangeWidth,
    ];

    const saved = await pool.query(query, values);
    res.status(201).json(toNumberRow(saved.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.get("/api/simulations", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const query = `
      SELECT *
      FROM simulations
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const result = await pool.query(query, [limit, offset]);
    res.json({ data: result.rows.map(toNumberRow), limit, offset });
  } catch (error) {
    next(error);
  }
});

app.get("/api/simulations/:id", async (req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM simulations WHERE id = $1", [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Simulasi tidak ditemukan" });
    }

    res.json(toNumberRow(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/simulations/:id", async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM simulations WHERE id = $1 RETURNING id", [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Simulasi tidak ditemukan" });
    }

    res.json({ message: "Simulasi berhasil dihapus", id: result.rows[0].id });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: "Terjadi kesalahan pada server",
  });
});

await migrate();

app.listen(PORT, () => {
  console.log(`DLMM Simulator API berjalan di http://localhost:${PORT}`);
});

/*
============================================================
CONTOH REQUEST
============================================================

POST http://localhost:4000/api/simulations
Content-Type: application/json

{
  "label": "SOL/USDC Curve $50",
  "strategy": "curve",
  "capital": 50,
  "dailyVolume": 2000000,
  "poolTvl": 1000000,
  "baseFee": 0.3,
  "volatilityBoost": 0.15,
  "rangePercent": 8,
  "priceNow": 150,
  "lowerPrice": 138,
  "upperPrice": 162
}

============================================================
FRONTEND API HELPER OPSIONAL
============================================================

const API_BASE_URL = "http://localhost:4000";

export async function saveSimulation(payload) {
  const response = await fetch(`${API_BASE_URL}/api/simulations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Gagal menyimpan simulasi");
  }

  return response.json();
}

export async function getSimulations() {
  const response = await fetch(`${API_BASE_URL}/api/simulations`);

  if (!response.ok) {
    throw new Error("Gagal mengambil riwayat simulasi");
  }

  return response.json();
}
*/
