"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AUTH_STORAGE_KEY } from "@/lib/auth";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
} from "recharts";
import {
  Droplets,
  Thermometer,
  Gauge,
  Wind,
  Sun,
  Moon,
  Leaf,
  Flame,
  Activity,
  Zap,
  AlertTriangle,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { getEsp32WsUrl, CHART_HISTORY_LENGTH } from "@/lib/config";
import type { SensorData } from "@/lib/types";

function formatVal(
  v: number | undefined,
  fallback: string,
  suffix = ""
): string {
  if (v === undefined || v === null || Number.isNaN(v)) return fallback;
  return `${Number(v).toFixed(1)}${suffix}`;
}

/** Gauge color by level: green (good), yellow (moderate), red (critical) */
function getGaugeColor(level: "good" | "moderate" | "critical"): string {
  switch (level) {
    case "good":
      return "#22c55e";
    case "moderate":
      return "#eab308";
    case "critical":
      return "#ef4444";
  }
}

/** Current sensor 0–5A: good < 2.0A, moderate 2.0–3.5A, critical > 3.5A */
function getCurrentLevel(value: number): "good" | "moderate" | "critical" {
  if (value < 2) return "good";
  if (value <= 3.5) return "moderate";
  return "critical";
}

/** Power 0–1000W: good < 300W, moderate 300–700W, critical > 700W */
function getPowerLevel(value: number): "good" | "moderate" | "critical" {
  if (value < 300) return "good";
  if (value <= 700) return "moderate";
  return "critical";
}

/** Energy 0–5kWh (demo range): good < 1kWh, moderate 1–3kWh, critical > 3kWh */
function getEnergyLevel(value: number): "good" | "moderate" | "critical" {
  if (value < 1) return "good";
  if (value <= 3) return "moderate";
  return "critical";
}

type SemicircleGaugeProps = {
  label: string;
  value: number;
  max: number;
  displaySuffix: string;
  level: "good" | "moderate" | "critical";
  icon: React.ComponentType<{ className?: string; size?: number }>;
};

function SemicircleGauge({
  label,
  value,
  max,
  displaySuffix,
  level,
  icon: Icon,
}: SemicircleGaugeProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = getGaugeColor(level);
  const trackColor = "var(--border)";

  const gaugeData = [
    { name: "track", value: 100, fill: trackColor },
    { name: "fill", value: percent, fill: barColor },
  ];

  const displayValue = max === 500 ? Math.round(value) : value.toFixed(1);

  return (
    <div className="panel-item panel-item--gauge" data-no-sparkline>
      <div className="panel-item-label">
        <Icon className="panel-item-icon" />
        {label}
      </div>
      <div className="gauge-wrap">
        <ResponsiveContainer width="100%" height={100}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="95%"
            barSize={12}
            data={gaugeData}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <PolarRadiusAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={6}
              isAnimationActive
              animationDuration={400}
              animationEasing="ease-out"
            >
              {gaugeData.map((entry, index) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </RadialBar>
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="gauge-value" style={{ color: "var(--foreground)" }}>
          {displayValue}
          {displaySuffix}
        </div>
      </div>
    </div>
  );
}

/** Sparkline for last 10 readings, 80x30, no axes. Client-only to avoid Recharts hydration mismatch (clipPathId). */
const SPARKLINE_WIDTH = 80;
const SPARKLINE_HEIGHT = 30;

function SparklineMini({ data, stroke = "var(--muted)" }: { data: number[]; stroke?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Defer state update to avoid eslint rule "setState in effect".
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);
  const chartData = data.length ? data.map((v, i) => ({ i, v })) : [{ i: 0, v: 0 }];
  return (
    <div className="sparkline-wrap" style={{ width: SPARKLINE_WIDTH, height: SPARKLINE_HEIGHT }}>
      {mounted ? (
        <LineChart width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT} data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.5} dot={false} isAnimationActive />
        </LineChart>
      ) : null}
    </div>
  );
}

/** Mock sensor data so UI always has values (no blanks) */
function getMockSensorData(): SensorData {
  return {
    voltage_v: 230,
    current_a: 1.2,
    power_w: 275,
    energy_kwh: 0.45,
    relay_status: "ON",
    event: "",
  };
}

/** Mock chart history so graph is never empty */
function getMockHistory(): SensorData[] {
  return Array.from({ length: 50 }, (_, i) => {
    const powerBase = 170;
    const wave = Math.sin(i / 6) * 90;
    const loadPulse = i % 14 < 6 ? 220 : 0; // "load on/off" visual rhythm
    const power = Math.max(0, powerBase + wave + loadPulse);
    const current = power / 230;
    return {
      voltage_v: 230,
      current_a: Math.round(current * 100) / 100,
      power_w: Math.round(power * 10) / 10,
      energy_kwh: Math.round((i * 0.07 + (Math.sin(i / 4) + 1) * 0.02) * 100) / 100,
      relay_status: i % 14 < 6 ? "ON" : "OFF",
      event: "",
      time: `${String(10 + Math.floor(i / 6) % 12).padStart(2, "0")}:${String((i * 2) % 60).padStart(2, "0")}`,
    };
  });
}

const THEME_STORAGE_KEY = "dashboard-theme";
const MAX_TOASTS = 3;
const TOAST_AUTO_DISMISS_MS = 5000;
const SPARKLINE_LENGTH = 10;

type ToastSeverity = "Warning" | "Critical";
type ToastItem = {
  id: number;
  sensor: string;
  value: string;
  severity: ToastSeverity;
  createdAt: number;
};

function Dashboard({ userName }: { userName: string }) {
  const [data, setData] = useState<SensorData | null>(null);
  const [history, setHistory] = useState<SensorData[]>([]);
  const [aiConnected, setAiConnected] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [mobileTab, setMobileTab] = useState<"power" | "energy" | "control" | "prediction">("power");
  const wsRef = useRef<WebSocket | null>(null);
  const lastUpdatedAtRef = useRef(0);
  const toastIdRef = useRef(0);

  // Restore theme from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  // Apply theme to document and persist
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  const exportCsv = () => {
    setCsvDownloading(true);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const rows: [string, string, string, string][] = [
      ["Parameter", "Value", "Unit", "Timestamp"],
      ["Voltage", String(displayData.voltage_v ?? ""), "V", new Date().toISOString()],
      ["Current", String(displayData.current_a ?? ""), "A", new Date().toISOString()],
      ["Power", String(displayData.power_w ?? ""), "W", new Date().toISOString()],
      ["Energy", String(displayData.energy_kwh ?? ""), "kWh", new Date().toISOString()],
      ["Relay", String(displayData.relay_status ?? ""), "", new Date().toISOString()],
      ["Event", String(displayData.event ?? ""), "", new Date().toISOString()],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enviro-data-${timestamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setCsvDownloading(false), 1000);
  };

  const mockData = useMemo(() => getMockSensorData(), []);
  const mockHistory = useMemo(() => getMockHistory(), []);

  const displayData = data ?? mockData;
  const displayHistory = history.length > 0 ? history : mockHistory;
  const predictionWindowMinutes = 30;
  const predictionAvgPowerW = useMemo(() => {
    const last = displayHistory.slice(-10);
    if (!last.length) return 0;
    const sum = last.reduce((acc, h) => acc + (h.power_w ?? 0), 0);
    return sum / last.length;
  }, [displayHistory]);
  const predictedEnergyNext30mKwh = (predictionAvgPowerW * (predictionWindowMinutes / 60)) / 1000;

  // Last updated: increment every second
  useEffect(() => {
    if (lastUpdatedAtRef.current === 0) {
      lastUpdatedAtRef.current = Date.now();
    }
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastUpdatedAtRef.current) / 1000);
      setSecondsSinceUpdate(elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Toast auto-dismiss after 5s
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = toasts[toasts.length - 1];
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== t.id));
    }, TOAST_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  // Fullscreen change listener
  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const addToast = useCallback(
    (sensor: string, value: string, severity: ToastSeverity) => {
      const id = ++toastIdRef.current;
      setToasts((prev) => {
        const next = [...prev, { id, sensor, value, severity, createdAt: Date.now() }].slice(-MAX_TOASTS);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    const wsUrl = getEsp32WsUrl();
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      try {
        const parsed: SensorData = JSON.parse(msg.data as string) as SensorData;
        parsed.time = new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        lastUpdatedAtRef.current = Date.now();
        setAiConnected(true);
        setData(parsed);
        setHistory((prev) => {
          const next = [...prev, parsed].slice(-CHART_HISTORY_LENGTH);
          return next;
        });

        // Energy Guardian toast rules (simple thresholds for expo demo)
        const currentLimitA = 2.5;
        const powerLimitW = 600;
        const currentA = parsed.current_a ?? 0;
        const powerW = parsed.power_w ?? 0;
        const event = (parsed.event ?? "").trim();

        if (event) {
          const critical = event.includes("OVER") || event.includes("TIME") || event.includes("FAIL");
          addToast("Event", event, critical ? "Critical" : "Warning");
        } else {
          if (currentA > currentLimitA) {
            addToast("Current", `${currentA.toFixed(2)} A`, currentA > currentLimitA * 1.3 ? "Critical" : "Warning");
          }
          if (powerW > powerLimitW) {
            addToast("Power", `${powerW.toFixed(1)} W`, powerW > powerLimitW * 1.3 ? "Critical" : "Warning");
          }
        }
      } catch {
        // ignore
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
      setAiConnected(false);
    };
  }, [addToast]);

  const sparklineLast10 = useMemo(
    () => displayHistory.slice(-SPARKLINE_LENGTH),
    [displayHistory]
  );
  const getSparkData = (key: keyof SensorData) =>
    sparklineLast10.map((h) => (h[key] as number) ?? 0);

  const currentLimitA = 2.5;
  const powerLimitW = 600;
  const currentA = displayData.current_a ?? 0;
  const powerW = displayData.power_w ?? 0;

  const autoOffStatus = currentA > currentLimitA || powerW > powerLimitW ? "AUTO-OFF Recommended" : "Within Limits";
  const riskText = currentA > currentLimitA || powerW > powerLimitW ? "HIGH RISK" : "LOW RISK";

  const powerCards = [
    { label: "Current (A)", value: `${formatVal(displayData.current_a, "1.2", "A")}`, icon: Zap, sparkKey: "current_a" as const },
    { label: "Power (W)", value: `${formatVal(displayData.power_w, "275", "W")}`, icon: Activity, sparkKey: "power_w" as const },
    { label: "Voltage (V)", value: `${formatVal(displayData.voltage_v, "230", "V")}`, icon: Gauge, sparkKey: "voltage_v" as const },
    { label: "Relay", value: displayData.relay_status ?? "OFF", icon: Zap },
  ];

  const energyCards = [
    { label: "Energy (kWh)", value: `${formatVal(displayData.energy_kwh, "0.45", "kWh")}`, icon: Leaf, sparkKey: "energy_kwh" as const },
    {
      label: "Predicted kWh (Next 30m)",
      value: `${predictedEnergyNext30mKwh.toFixed(2)} kWh`,
      icon: AlertTriangle,
    },
    { label: "Relay Status", value: displayData.relay_status ?? "OFF", icon: Zap },
    { label: "Power Limit", value: `${powerLimitW} W`, icon: Flame },
  ];

  const controlCards = [
    { label: "Auto-Off Status", value: autoOffStatus, icon: AlertTriangle },
    { label: "Overcurrent Risk", value: currentA > currentLimitA ? "YES" : "NO", icon: Flame },
    { label: "Overpower Risk", value: powerW > powerLimitW ? "YES" : "NO", icon: Flame },
    { label: "Last Event", value: (displayData.event ?? "").trim() ? (displayData.event ?? "") : "—", icon: AlertTriangle },
  ];

  const predictionCards = [
    { label: "Energy Next 30m", value: `${predictedEnergyNext30mKwh.toFixed(2)} kWh`, icon: AlertTriangle },
    { label: "Risk Level", value: riskText, icon: Flame },
    { label: "If Over Limit", value: "Relay OFF + Alert", icon: Zap },
    { label: "Demo Mode", value: "Moving Avg Prediction", icon: Activity },
  ];

  const sensorHealthRows = useMemo(() => {
    const d = displayData;
    const status = (
      v: number | undefined,
      lowOk: number,
      highOk: number,
      warnLo?: number,
      warnHi?: number
    ): "Online" | "Offline" | "Warning" => {
      if (v == null || Number.isNaN(v)) return "Offline";
      if (warnLo != null && v <= warnLo) return "Warning";
      if (warnHi != null && v >= warnHi) return "Warning";
      if (v >= lowOk && v <= highOk) return "Online";
      return "Warning";
    };
    return [
      { name: "Current (A)", value: d.current_a, unit: "A", status: status(d.current_a, 0, 2.5, undefined, 3.5) },
      { name: "Voltage (V)", value: d.voltage_v, unit: "V", status: status(d.voltage_v, 210, 245, 200, 250) },
      { name: "Power (W)", value: d.power_w, unit: "W", status: status(d.power_w, 0, 400, undefined, 650) },
      { name: "Energy (kWh)", value: d.energy_kwh, unit: "kWh", status: status(d.energy_kwh, 0, 3, undefined, 4.5) },
    ];
  }, [displayData]);

  const panelSections = [
    { title: "Power Panel", cards: powerCards },
    { title: "Energy Panel", cards: energyCards },
    { title: "Control Panel", cards: controlCards },
    { title: "Prediction Panel", cards: predictionCards },
  ];

  const allParams = [
    { label: "Voltage (V)", value: `${formatVal(displayData.voltage_v, "230")} V` },
    { label: "Current (A)", value: `${formatVal(displayData.current_a, "1.2")} A` },
    { label: "Power (W)", value: `${formatVal(displayData.power_w, "275")} W` },
    { label: "Energy (kWh)", value: `${formatVal(displayData.energy_kwh, "0.45")} kWh` },
    { label: "Relay Status", value: displayData.relay_status ?? "OFF" },
    { label: "Predicted Energy (Next 30m)", value: `${predictedEnergyNext30mKwh.toFixed(2)} kWh` },
    { label: "Auto-Off Status", value: autoOffStatus },
  ];

  const lastUpdatedClass =
    secondsSinceUpdate > 30 ? "last-updated--disconnected" : secondsSinceUpdate >= 10 ? "last-updated--delayed" : "last-updated--live";

  return (
    <main className="dashboard-page">
      <div className="dashboard-user-badge" title={userName}>
        {userName}
      </div>
      <button
        type="button"
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      <button
        type="button"
        className="top-btn top-btn--fullscreen"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
      <div className="backend-badge">
        <span
          className={`backend-dot ${aiConnected ? "backend-dot--live" : "backend-dot--off"}`}
        />
        Backend {aiConnected ? "Live" : "Offline"}
      </div>

      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.severity.toLowerCase()}`}
            role="alert"
          >
            <span className="toast-sensor">{toast.sensor}</span>
            <span className="toast-value">{toast.value}</span>
            <span className="toast-severity">{toast.severity}</span>
          </div>
        ))}
      </div>

      <header className="dashboard-header">
        <h1 className="dashboard-title">Smart Energy Guardian (Auto-Off)</h1>
        <p className={`last-updated ${lastUpdatedClass}`}>
          {secondsSinceUpdate <= 10 && <span className="last-updated-dot" />}
          Last updated: {secondsSinceUpdate} second{secondsSinceUpdate !== 1 ? "s" : ""} ago
        </p>
      </header>

      <section className="panel-grid panel-grid--desktop">
        {panelSections.map((section) => {
          const sectionId = section.title.startsWith("Power")
            ? "power"
            : section.title.startsWith("Energy")
              ? "energy"
              : section.title.startsWith("Control")
                ? "control"
                : "prediction";
          const hiddenOnMobile = mobileTab !== sectionId;
          return (
            <div
              key={section.title}
              className={`panel-card ${hiddenOnMobile ? "panel-card--hidden-mobile" : ""}`}
              id={`panel-${sectionId}`}
            >
              <h2 className="panel-title">{section.title}</h2>
              <div className="panel-cards">
                {section.cards.map((c) => {
                  if (c.label === "Current (A)")
                    return (
                      <SemicircleGauge
                        key={c.label}
                        label="Current (A)"
                        value={Number(displayData.current_a ?? 0)}
                        max={5}
                        displaySuffix="A"
                        level={getCurrentLevel(Number(displayData.current_a ?? 0))}
                        icon={Zap}
                      />
                    );
                  if (c.label === "Power (W)")
                    return (
                      <SemicircleGauge
                        key={c.label}
                        label="Power (W)"
                        value={Number(displayData.power_w ?? 0)}
                        max={1000}
                        displaySuffix="W"
                        level={getPowerLevel(Number(displayData.power_w ?? 0))}
                        icon={Activity}
                      />
                    );
                  if (c.label === "Energy (kWh)")
                    return (
                      <SemicircleGauge
                        key={c.label}
                        label="Energy (kWh)"
                        value={Number(displayData.energy_kwh ?? 0)}
                        max={5}
                        displaySuffix="kWh"
                        level={getEnergyLevel(Number(displayData.energy_kwh ?? 0))}
                        icon={Leaf}
                      />
                    );
                  const sparkKey =
                    "sparkKey" in c ? (c.sparkKey as keyof SensorData | undefined) : undefined;
                  return (
                    <div key={c.label} className="panel-item">
                      <div className="panel-item-label">
                        <c.icon className="panel-item-icon" />
                        {c.label}
                      </div>
                      <p className="panel-item-value">{c.value}</p>
                      {sparkKey != null ? (
                        <SparklineMini data={getSparkData(sparkKey)} stroke="var(--muted)" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className="params-section">
        <div className="params-heading-row">
          <h2 className="params-heading">All Parameters</h2>
          <button
            type="button"
            className="params-export-btn"
            onClick={exportCsv}
            disabled={csvDownloading}
          >
            {csvDownloading ? "Downloading..." : "Export CSV"}
          </button>
        </div>
        <div className="params-grid">
          {allParams.map((item) => (
            <div key={item.label} className="params-item">
              <p className="params-item-label">{item.label}</p>
              <p className="params-item-value">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="chart-section">
        <h2 className="chart-heading">Live Power (W)</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={displayHistory}
              margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
              <XAxis
                dataKey="time"
                stroke="#555"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="power"
                stroke="#16a34a"
                tick={{ fontSize: 11 }}
                domain={[0, 1000]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                }}
                labelStyle={{ color: "#111" }}
              />
              <Legend />
              <Line
                type="monotone"
                yAxisId="power"
                dataKey="power_w"
                name="Power (W)"
                stroke="#16a34a"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="sensor-health-section">
        <h2 className="sensor-health-heading">Sensor Health</h2>
        <div className="sensor-health-table-wrap">
          <table className="sensor-health-table">
            <thead>
              <tr>
                <th>Sensor</th>
                <th>Value</th>
                <th>Status</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {sensorHealthRows.map((row, i) => (
                <tr key={row.name} className={i % 2 === 1 ? "sensor-health-row--alt" : ""}>
                  <td>{row.name}</td>
                  <td>{row.value != null ? `${row.value}${row.unit}` : "—"}</td>
                  <td>
                    <span className={`sensor-badge sensor-badge--${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <div className="signal-bars">
                      {[1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`signal-bar ${row.status === "Online" ? "signal-bar--on" : row.status === "Warning" && i <= 2 ? "signal-bar--on" : ""}`}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <nav className="bottom-nav" aria-label="Panel tabs">
        <button
          type="button"
          className={`bottom-nav-btn ${mobileTab === "power" ? "bottom-nav-btn--active" : ""}`}
          onClick={() => setMobileTab("power")}
        >
          Power
        </button>
        <button
          type="button"
          className={`bottom-nav-btn ${mobileTab === "energy" ? "bottom-nav-btn--active" : ""}`}
          onClick={() => setMobileTab("energy")}
        >
          Energy
        </button>
        <button
          type="button"
          className={`bottom-nav-btn ${mobileTab === "control" ? "bottom-nav-btn--active" : ""}`}
          onClick={() => setMobileTab("control")}
        >
          Control
        </button>
        <button
          type="button"
          className={`bottom-nav-btn ${mobileTab === "prediction" ? "bottom-nav-btn--active" : ""}`}
          onClick={() => setMobileTab("prediction")}
        >
          Prediction
        </button>
      </nav>
    </main>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userName, setUserName] = useState("");
  useEffect(() => {
    const name = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!name) {
      router.replace("/login");
      return;
    }
    const id = window.setTimeout(() => {
      setUserName(name);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [router]);
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <span className="app-spinner" role="status" aria-label="Please wait" />
      </div>
    );
  }
  return <Dashboard userName={userName} />;
}