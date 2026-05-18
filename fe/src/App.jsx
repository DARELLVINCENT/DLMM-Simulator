import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Calculator, TrendingUp, Wallet, Zap } from "lucide-react";

const STRATEGIES = {
  spot: {
    label: "Spot",
    risk: "Rendah",
    description: "Liquidity disebar merata. Cocok untuk pemula dan market yang arahnya belum jelas.",
    multiplier: 0.75,
    rangeSuggestion: "±8–12%",
  },
  curve: {
    label: "Curve",
    risk: "Sedang",
    description: "Liquidity dipusatkan di sekitar active bin. Fee lebih optimal, tapi lebih sensitif terhadap harga keluar range.",
    multiplier: 1,
    rangeSuggestion: "±4–8%",
  },
  bidask: {
    label: "Bid-Ask",
    risk: "Tinggi",
    description: "Mirip order book: beli lebih rendah, jual lebih tinggi. Agresif dan butuh monitoring lebih sering.",
    multiplier: 1.2,
    rangeSuggestion: "±3–6%",
  },
};

const SCENARIOS = [
  { name: "Konservatif", volume: 500_000, badge: "Aman" },
  { name: "Moderat", volume: 2_000_000, badge: "Seimbang" },
  { name: "Optimis", volume: 5_000_000, badge: "Agresif" },
];

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 3 : 2,
    maximumFractionDigits: value < 1 ? 3 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function percent(value) {
  return `${Number.isFinite(value) ? value.toFixed(2) : "0.00"}%`;
}

function Card({ children, className = "" }) {
  return <div className={`rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function StatCard({ icon: Icon, title, value, helper }) {
  return (
    <Card className="bg-white/85 backdrop-blur">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
            {helper ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{helper}</p> : null}
          </div>
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function NumberField({ label, value, onChange, prefix, suffix, min = 0, step = "any" }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        {prefix ? <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{prefix}</span> : null}
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`${prefix ? "pl-8" : ""} ${suffix ? "pr-12" : ""} w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}
        />
        {suffix ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{suffix}</span> : null}
      </div>
    </div>
  );
}

function StrategyButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
        active ? "bg-slate-950 text-white shadow-sm" : "bg-transparent text-slate-600 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [capital, setCapital] = useState(50);
  const [dailyVolume, setDailyVolume] = useState(2_000_000);
  const [poolTvl, setPoolTvl] = useState(1_000_000);
  const [baseFee, setBaseFee] = useState(0.3);
  const [volatilityBoost, setVolatilityBoost] = useState(0.15);
  const [rangePercent, setRangePercent] = useState(8);
  const [priceNow, setPriceNow] = useState(150);
  const [lowerPrice, setLowerPrice] = useState(138);
  const [upperPrice, setUpperPrice] = useState(162);
  const [strategy, setStrategy] = useState("curve");

  const result = useMemo(() => {
    const selected = STRATEGIES[strategy];
    const effectiveFee = Math.max(0, baseFee + volatilityBoost);
    const shareOfPool = poolTvl > 0 ? capital / poolTvl : 0;
    const rangeConcentration = Math.max(0.2, Math.min(2.5, 10 / Math.max(rangePercent, 1)));
    const strategyMultiplier = selected.multiplier;
    const estimatedDailyFee = dailyVolume * (effectiveFee / 100) * shareOfPool * rangeConcentration * strategyMultiplier;
    const estimatedMonthlyFee = estimatedDailyFee * 30;
    const estimatedYearlyFee = estimatedDailyFee * 365;
    const apr = capital > 0 ? (estimatedYearlyFee / capital) * 100 : 0;
    const lowerBound = priceNow * (1 - rangePercent / 100);
    const upperBound = priceNow * (1 + rangePercent / 100);
    const inManualRange = priceNow >= lowerPrice && priceNow <= upperPrice;
    const rangeWidth = upperPrice > lowerPrice ? ((upperPrice - lowerPrice) / priceNow) * 100 : 0;

    return {
      selected,
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
  }, [capital, dailyVolume, poolTvl, baseFee, volatilityBoost, rangePercent, priceNow, lowerPrice, upperPrice, strategy]);

  const scenarioRows = useMemo(() => {
    return SCENARIOS.map((scenario) => {
      const selected = STRATEGIES[strategy];
      const effectiveFee = Math.max(0, baseFee + volatilityBoost);
      const shareOfPool = poolTvl > 0 ? capital / poolTvl : 0;
      const rangeConcentration = Math.max(0.2, Math.min(2.5, 10 / Math.max(rangePercent, 1)));
      const dailyFee = scenario.volume * (effectiveFee / 100) * shareOfPool * rangeConcentration * selected.multiplier;
      const monthlyFee = dailyFee * 30;
      const apr = capital > 0 ? ((dailyFee * 365) / capital) * 100 : 0;
      return { ...scenario, dailyFee, monthlyFee, apr };
    });
  }, [capital, poolTvl, baseFee, volatilityBoost, rangePercent, strategy]);

  const applySuggestedRange = () => {
    const lower = priceNow * (1 - rangePercent / 100);
    const upper = priceNow * (1 + rangePercent / 100);
    setLowerPrice(Number(lower.toFixed(2)));
    setUpperPrice(Number(upper.toFixed(2)));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"
        >
          <div className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
            <div className="p-7 md:p-9">
              <span className="mb-5 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm text-white">Meteora DLMM Simulator</span>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
                Simulasi fee, APR, dan risiko range untuk LP DLMM.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                Masukkan modal, volume pool, TVL, fee, volatilitas, dan range harga. Simulator ini membantu pemula memahami proyeksi hasil sebelum membuka posisi liquidity.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs text-slate-300">Strategi aktif</p>
                  <p className="mt-1 text-lg font-semibold">{result.selected.label}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs text-slate-300">Effective fee</p>
                  <p className="mt-1 text-lg font-semibold">{percent(result.effectiveFee)}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs text-slate-300">Risk level</p>
                  <p className="mt-1 text-lg font-semibold">{result.selected.risk}</p>
                </div>
              </div>
            </div>
          </div>

          <Card className="shadow-xl">
            <div className="border-b border-slate-100 p-6 pb-4">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <Calculator className="h-5 w-5" /> Input Simulasi
              </h2>
            </div>
            <div className="space-y-5 p-6">
              <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
                <StrategyButton active={strategy === "spot"} onClick={() => setStrategy("spot")}>Spot</StrategyButton>
                <StrategyButton active={strategy === "curve"} onClick={() => setStrategy("curve")}>Curve</StrategyButton>
                <StrategyButton active={strategy === "bidask"} onClick={() => setStrategy("bidask")}>Bid-Ask</StrategyButton>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <p className="font-medium text-slate-800">{result.selected.label} — Risiko {result.selected.risk}</p>
                <p className="mt-1">{result.selected.description}</p>
                <p className="mt-2 text-xs text-slate-500">Saran range: {result.selected.rangeSuggestion}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField label="Modal LP" value={capital} onChange={setCapital} prefix="$" />
                <NumberField label="Daily Volume Pool" value={dailyVolume} onChange={setDailyVolume} prefix="$" />
                <NumberField label="Pool TVL" value={poolTvl} onChange={setPoolTvl} prefix="$" />
                <NumberField label="Harga SOL Sekarang" value={priceNow} onChange={setPriceNow} prefix="$" />
                <NumberField label="Base Fee" value={baseFee} onChange={setBaseFee} suffix="%" step="0.01" />
                <NumberField label="Volatility Boost" value={volatilityBoost} onChange={setVolatilityBoost} suffix="%" step="0.01" />
              </div>

              <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Range dari harga sekarang</label>
                  <span className="text-sm font-semibold">±{rangePercent}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={rangePercent}
                  onChange={(event) => setRangePercent(Number(event.target.value))}
                  className="w-full accent-slate-950"
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{currency(result.lowerBound)}</span>
                  <span>{currency(result.upperBound)}</span>
                </div>
                <button
                  type="button"
                  onClick={applySuggestedRange}
                  className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Terapkan ke Range Manual
                </button>
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard icon={Wallet} title="Fee / Hari" value={currency(result.estimatedDailyFee)} helper="Estimasi berdasarkan share modal terhadap TVL dan konsentrasi range." />
          <StatCard icon={TrendingUp} title="Fee / Bulan" value={currency(result.estimatedMonthlyFee)} helper="Menggunakan asumsi 30 hari dengan volume dan fee konstan." />
          <StatCard icon={Zap} title="APR Estimasi" value={percent(result.apr)} helper="Belum termasuk impermanent loss, slippage, atau perubahan volume." />
          <StatCard icon={Calculator} title="Share Pool" value={percent(result.shareOfPool * 100)} helper="Semakin kecil TVL relatif terhadap modalmu, semakin besar fee share." />
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <div className="border-b border-slate-100 p-6 pb-4">
              <h2 className="text-xl font-semibold">Range & Risiko Impermanent Loss</h2>
            </div>
            <div className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField label="Harga Bawah" value={lowerPrice} onChange={setLowerPrice} prefix="$" />
                <NumberField label="Harga Atas" value={upperPrice} onChange={setUpperPrice} prefix="$" />
              </div>

              <div className={`rounded-2xl p-5 ${result.inManualRange ? "bg-emerald-50" : "bg-amber-50"}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`mt-0.5 h-5 w-5 ${result.inManualRange ? "text-emerald-600" : "text-amber-600"}`} />
                  <div>
                    <p className="font-semibold text-slate-900">
                      {result.inManualRange ? "Harga masih di dalam range" : "Harga berada di luar range"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {result.inManualRange
                        ? "Posisi masih berpotensi menghasilkan fee dari swap di sekitar active bin. Tetap pantau jika harga mendekati batas range."
                        : "Jika harga keluar range, posisi bisa berubah dominan ke salah satu token dan fee bisa menurun. Pertimbangkan rebalance."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Lebar range manual</span>
                  <span className="font-semibold">{percent(result.rangeWidth)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.min(result.rangeWidth, 100)}%` }} />
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  Range sempit biasanya meningkatkan potensi fee, tetapi risiko keluar range juga lebih tinggi. Range lebar lebih aman, tapi fee bisa lebih kecil.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="border-b border-slate-100 p-6 pb-4">
              <h2 className="text-xl font-semibold">Perbandingan Skenario Volume</h2>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Skenario</th>
                      <th className="px-4 py-3">Volume</th>
                      <th className="px-4 py-3">Fee/Hari</th>
                      <th className="px-4 py-3">Fee/Bulan</th>
                      <th className="px-4 py-3">APR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scenarioRows.map((row) => (
                      <tr key={row.name} className="bg-white">
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-900">{row.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{row.badge}</div>
                        </td>
                        <td className="px-4 py-4">{currency(row.volume)}</td>
                        <td className="px-4 py-4 font-semibold">{currency(row.dailyFee)}</td>
                        <td className="px-4 py-4">{currency(row.monthlyFee)}</td>
                        <td className="px-4 py-4 font-semibold">{percent(row.apr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">
                <p>
                  Catatan: Ini hanya estimasi front-end. Perhitungan DLMM asli dapat dipengaruhi active bin, distribusi liquidity per bin, dynamic fee aktual, swap path, insentif farm, perubahan harga, dan biaya rebalance.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
