import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const STORAGE_KEY = "piano-sessions";

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatMinutes(mins) {
  if (mins >= 60) return `${(mins / 60).toFixed(1)}h`;
  return `${Math.round(mins)}m`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekData(sessions) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const now = new Date();
  const data = days.map((label, i) => {
    const dayStart = startOfDay(new Date(now));
    dayStart.setDate(now.getDate() - now.getDay() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    const mins = sessions
      .filter(s => s.start >= dayStart.getTime() && s.start < dayEnd.getTime())
      .reduce((acc, s) => acc + s.duration / 60, 0);
    return { label, mins: Math.round(mins * 10) / 10 };
  });
  return data;
}

function getMonthData(sessions) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const data = [];
  for (let week = 0; week < Math.ceil(daysInMonth / 7); week++) {
    const startDay = week * 7 + 1;
    const endDay = Math.min(startDay + 6, daysInMonth);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), startDay, 0, 0, 0, 0);
    const weekEnd = new Date(now.getFullYear(), now.getMonth(), endDay + 1, 0, 0, 0, 0);
    const mins = sessions
      .filter(s => s.start >= weekStart.getTime() && s.start < weekEnd.getTime())
      .reduce((acc, s) => acc + s.duration / 60, 0);
    data.push({ label: `W${week + 1}`, mins: Math.round(mins * 10) / 10 });
  }
  return data;
}

function getYearData(sessions) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  return months.map((label, i) => {
    const start = new Date(now.getFullYear(), i, 1).getTime();
    const end = new Date(now.getFullYear(), i + 1, 1).getTime();
    const mins = sessions
      .filter(s => s.start >= start && s.start < end)
      .reduce((acc, s) => acc + s.duration / 60, 0);
    return { label, mins: Math.round(mins * 10) / 10 };
  });
}

function getMaxData(sessions) {
  if (!sessions.length) return [];
  const byYear = {};
  sessions.forEach(s => {
    const yr = new Date(s.start).getFullYear();
    byYear[yr] = (byYear[yr] || 0) + s.duration / 60;
  });
  return Object.entries(byYear)
    .sort(([a], [b]) => a - b)
    .map(([label, mins]) => ({ label, mins: Math.round(mins * 10) / 10 }));
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "#1a1a1a",
        border: "1px solid #c9a84c",
        borderRadius: 8,
        padding: "8px 14px",
        fontFamily: "'Crimson Pro', serif",
        color: "#f5ead8",
        fontSize: 14,
      }}>
        <div style={{ color: "#c9a84c", fontWeight: 600 }}>{label}</div>
        <div>{formatMinutes(payload[0].value)}</div>
      </div>
    );
  }
  return null;
};

export default function PianoTracker() {
  const [sessions, setSessions] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [view, setView] = useState("week");
  const [loaded, setLoaded] = useState(false);
  const [pulse, setPulse] = useState(false);
  const startRef = useRef(null);
  const timerRef = useRef(null);

  // Load sessions from storage
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (result && result.value) {
          setSessions(JSON.parse(result.value));
        }
      } catch (e) { /* no sessions yet */ }
      setLoaded(true);
    })();
  }, []);

  // Persist sessions
  useEffect(() => {
    if (!loaded) return;
    window.storage.set(STORAGE_KEY, JSON.stringify(sessions)).catch(() => {});
  }, [sessions, loaded]);

  // Timer
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        setPulse(p => !p);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  const handleToggle = useCallback(() => {
    if (!isRunning) {
      startRef.current = Date.now();
      setElapsed(0);
      setIsRunning(true);
    } else {
      setIsRunning(false);
      const duration = Math.floor((Date.now() - startRef.current) / 1000);
      if (duration >= 1) {
        setSessions(prev => [...prev, { start: startRef.current, duration }]);
      }
      setElapsed(0);
    }
  }, [isRunning]);

  const chartData = view === "week" ? getWeekData(sessions)
    : view === "month" ? getMonthData(sessions)
    : view === "year" ? getYearData(sessions)
    : getMaxData(sessions);

  const totalSeconds = sessions.reduce((a, s) => a + s.duration, 0);
  const todaySessions = sessions.filter(s => s.start >= startOfDay(new Date()).getTime());
  const todaySeconds = todaySessions.reduce((a, s) => a + s.duration, 0);
  const maxMins = Math.max(...chartData.map(d => d.mins), 1);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0d0d",
      backgroundImage: "radial-gradient(ellipse at 20% 50%, #1a1208 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #0d0d18 0%, transparent 50%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "40px 20px 60px",
      fontFamily: "'Crimson Pro', Georgia, serif",
      color: "#f5ead8",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.4em", color: "#c9a84c", textTransform: "uppercase", marginBottom: 10, opacity: 0.8 }}>
          Practice Journal
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "clamp(32px, 6vw, 52px)",
          fontWeight: 700,
          margin: 0,
          letterSpacing: "-0.01em",
          color: "#f5ead8",
          lineHeight: 1,
        }}>
          Piano Tracker
        </h1>
        <div style={{ width: 60, height: 1, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)", margin: "18px auto 0" }} />
      </div>

      {/* Stats Row */}
      <div style={{
        display: "flex",
        gap: 24,
        marginBottom: 48,
        flexWrap: "wrap",
        justifyContent: "center",
      }}>
        {[
          { label: "Today", value: formatDuration(todaySeconds) },
          { label: "All Time", value: formatDuration(totalSeconds) },
          { label: "Sessions", value: sessions.length },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: "linear-gradient(135deg, #1c1710 0%, #141414 100%)",
            border: "1px solid #2e2a20",
            borderRadius: 12,
            padding: "18px 28px",
            textAlign: "center",
            minWidth: 110,
          }}>
            <div style={{ fontSize: 11, letterSpacing: "0.25em", color: "#8a7a56", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 26, fontFamily: "'Playfair Display', serif", fontWeight: 700, color: "#f5ead8" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Timer + Button */}
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        {/* Timer Display */}
        <div style={{
          fontSize: "clamp(48px, 12vw, 80px)",
          fontFamily: "'Playfair Display', serif",
          fontWeight: 400,
          letterSpacing: "0.04em",
          color: isRunning ? "#c9a84c" : "#3a3530",
          transition: "color 0.6s ease",
          marginBottom: 32,
          lineHeight: 1,
          userSelect: "none",
        }}>
          {String(Math.floor(elapsed / 3600)).padStart(2, "0")}:
          {String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:
          {String(elapsed % 60).padStart(2, "0")}
        </div>

        {/* Start / Stop Button */}
        <button
          onClick={handleToggle}
          style={{
            position: "relative",
            width: 140,
            height: 140,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: isRunning
              ? "radial-gradient(circle at 35% 35%, #8b1a1a, #3d0808)"
              : "radial-gradient(circle at 35% 35%, #2a2218, #0f0e0b)",
            boxShadow: isRunning
              ? "0 0 0 2px #6b1212, 0 0 40px rgba(180,40,40,0.35), 0 8px 32px rgba(0,0,0,0.8)"
              : "0 0 0 2px #3a3020, 0 0 0 4px #1a1810, 0 8px 32px rgba(0,0,0,0.8)",
            transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
            transform: isRunning ? "scale(1.05)" : "scale(1)",
          }}
        >
          {/* Inner ring */}
          <div style={{
            position: "absolute",
            inset: 8,
            borderRadius: "50%",
            border: `1px solid ${isRunning ? "rgba(220,80,80,0.3)" : "rgba(180,150,80,0.2)"}`,
            transition: "border-color 0.4s ease",
          }} />
          {/* Icon */}
          <div style={{
            position: "relative",
            zIndex: 1,
            fontSize: 38,
            lineHeight: 1,
            userSelect: "none",
          }}>
            {isRunning ? "⏹" : "▶"}
          </div>
          {/* Pulse ring */}
          {isRunning && (
            <div style={{
              position: "absolute",
              inset: -8,
              borderRadius: "50%",
              border: "2px solid rgba(180,40,40,0.4)",
              animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
            }} />
          )}
        </button>

        <div style={{
          marginTop: 20,
          fontSize: 13,
          letterSpacing: "0.2em",
          color: "#5a5040",
          textTransform: "uppercase",
        }}>
          {isRunning ? "Session in progress" : "Tap to begin"}
        </div>
      </div>

      {/* Chart */}
      <div style={{
        width: "100%",
        maxWidth: 680,
        background: "linear-gradient(135deg, #161309 0%, #111111 100%)",
        border: "1px solid #2a2518",
        borderRadius: 16,
        padding: "28px 24px 24px",
      }}>
        {/* View Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "#0d0d0d", borderRadius: 8, padding: 4 }}>
          {["week", "month", "year", "max"].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                flex: 1,
                padding: "8px 4px",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: "'Crimson Pro', serif",
                fontSize: 14,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                transition: "all 0.25s ease",
                background: view === v ? "linear-gradient(135deg, #2a2010, #1e1a0e)" : "transparent",
                color: view === v ? "#c9a84c" : "#5a5040",
                boxShadow: view === v ? "inset 0 1px 0 rgba(200,168,76,0.15)" : "none",
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Bar Chart */}
        {chartData.every(d => d.mins === 0) ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#3a3020", fontStyle: "italic", fontSize: 18 }}>
            No practice recorded yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barCategoryGap="28%">
              <XAxis
                dataKey="label"
                tick={{ fill: "#7a6a48", fontSize: 12, fontFamily: "'Crimson Pro', serif", letterSpacing: "0.05em" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatMinutes}
                tick={{ fill: "#5a4e30", fontSize: 11, fontFamily: "'Crimson Pro', serif" }}
                axisLine={false}
                tickLine={false}
                width={38}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(200,168,76,0.05)" }} />
              <Bar dataKey="mins" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.mins === maxMins && entry.mins > 0
                      ? "url(#goldGrad)"
                      : entry.mins > 0
                        ? "#3a3020"
                        : "#1a1810"
                    }
                  />
                ))}
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d4a84c" />
                    <stop offset="100%" stopColor="#8a6828" />
                  </linearGradient>
                </defs>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        <div style={{ marginTop: 8, textAlign: "right", fontSize: 11, color: "#3a3020", letterSpacing: "0.1em" }}>
          TOTAL PRACTICE TIME
        </div>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.4); opacity: 0; }
        }
        button:active { transform: scale(0.97) !important; }
      `}</style>
    </div>
  );
}
