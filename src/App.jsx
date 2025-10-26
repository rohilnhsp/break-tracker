import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ----- Supabase Client -----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk"; // replace with your Supabase anon key
const supabase = createClient(supabaseUrl, anonKey);

function App() {
  const [teams, setTeams] = useState([]);
  const [adminLogged, setAdminLogged] = useState(false);
  const [adminLogin, setAdminLogin] = useState({ username: "", password: "" });
  const [exportRange, setExportRange] = useState("daily");
  const [columnsCache, setColumnsCache] = useState([]);
  const breakTypes = [
    { label: "☕ Tea", value: "tea" },
    { label: "🍽️ Lunch", value: "lunch" },
    { label: "🥗 Dinner", value: "dinner" },
    { label: "🚻 Bio Break", value: "bio" },
  ];

  // Fetch table columns to avoid missing column errors
  const fetchColumns = async () => {
    const { data, error } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_name", "teams");
    if (!error) setColumnsCache(data.map((c) => c.column_name));
  };

  const fetchTeams = async () => {
    const { data, error } = await supabase.from("teams").select("*");
    if (!error) setTeams(data || []);
  };

  useEffect(() => {
    fetchColumns();
    fetchTeams();
    const interval = setInterval(() => setTeams((prev) => [...prev]), 1000);
    return () => clearInterval(interval);
  }, []);

  const safeUpdateTeam = async (teamId, updates) => {
    const filtered = {};
    for (let key in updates) {
      if (columnsCache.includes(key)) filtered[key] = updates[key];
    }
    if (Object.keys(filtered).length === 0) return;
    const { error } = await supabase.from("teams").update(filtered).eq("id", teamId);
    if (error) console.error("Error updating team:", error);
    else fetchTeams();
  };

  const punchIn = (team) => {
    safeUpdateTeam(team.id, {
      punch_in: new Date().toISOString(),
      break_type: null,
      last_break_date: new Date().toISOString(),
    });
  };

  const punchOut = (team) => {
    const now = new Date();
    let additionalSeconds = 0;
    if (team.punch_in) {
      additionalSeconds = Math.floor((new Date() - new Date(team.punch_in)) / 1000);
    }
    safeUpdateTeam(team.id, {
      punch_in: null,
      daily_break_seconds: (team.daily_break_seconds || 0) + additionalSeconds,
      last_break_date: now.toISOString(),
    });
  };

  const addUser = async () => {
    const name = prompt("Enter new user name:");
    if (!name) return;
    const newUser = { name };
    if (columnsCache.includes("daily_break_seconds")) newUser.daily_break_seconds = 0;
    if (columnsCache.includes("last_break_date")) newUser.last_break_date = new Date().toISOString();
    const { error } = await supabase.from("teams").insert([newUser]);
    if (error) console.error("Error adding user:", error);
    else fetchTeams();
  };

  const removeUser = async (id) => {
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) console.error("Error removing user:", error);
    else fetchTeams();
  };

  const handleExport = () => {
    let csv = "Name,Punch In,Total Break (s),Break Type\n";
    teams.forEach((t) => {
      csv += `${t.name || ""},${t.punch_in || ""},${t.daily_break_seconds || 0},${t.break_type || ""}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `breaks_${exportRange}.csv`;
    a.click();
  };

  const loginAdmin = () => {
    const username = prompt("Admin Username:");
    const password = prompt("Admin Password:");
    if (username === "admin" && password === "password") setAdminLogged(true);
    else alert("Invalid credentials");
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>⏱️ Break Tracker Dashboard</h1>

      {/* Admin Button */}
      <div style={{ marginBottom: 20 }}>
        {adminLogged ? (
          <button onClick={() => setAdminLogged(false)}>Logout Admin</button>
        ) : (
          <button onClick={loginAdmin}>Login Admin</button>
        )}
      </div>

      {/* Admin Panel */}
      {adminLogged && (
        <div style={{ marginBottom: 20, border: "1px solid #ccc", padding: 10 }}>
          <h3>👤 Admin Panel</h3>
          <button onClick={addUser}>➕ Add User</button>
          <button onClick={handleExport} style={{ marginLeft: 10 }}>
            💾 Export CSV ({exportRange})
          </button>
          <select
            value={exportRange}
            onChange={(e) => setExportRange(e.target.value)}
            style={{ marginLeft: 10 }}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      )}

      {/* Users Table */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            minWidth: 600,
          }}
        >
          <thead style={{ position: "sticky", top: 0, backgroundColor: "#eee" }}>
            <tr>
              <th style={{ padding: 8, borderBottom: "1px solid #ccc" }}>Name</th>
              <th style={{ padding: 8, borderBottom: "1px solid #ccc" }}>Punch In</th>
              <th style={{ padding: 8, borderBottom: "1px solid #ccc" }}>Total Break ⏱️</th>
              <th style={{ padding: 8, borderBottom: "1px solid #ccc" }}>Current Break Type</th>
              {adminLogged && <th style={{ padding: 8, borderBottom: "1px solid #ccc" }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {teams.map((team, i) => {
              const isLongBreak = (team.daily_break_seconds || 0) >= 3600;
              const punchInTime = team.punch_in ? new Date(team.punch_in) : null;
              const duration = punchInTime ? Math.floor((new Date() - punchInTime) / 1000) : 0;

              return (
                <tr
                  key={team.id}
                  style={{
                    backgroundColor: i % 2 === 0 ? "#fafafa" : "#fff",
                    color: isLongBreak ? "red" : "black",
                  }}
                >
                  <td style={{ padding: 8 }}>{team.name}</td>
                  <td style={{ padding: 8 }}>
                    {punchInTime ? punchInTime.toLocaleTimeString() : "—"}
                  </td>
                  <td style={{ padding: 8 }}>
                    {(team.daily_break_seconds || 0) + duration}s
                  </td>
                  <td style={{ padding: 8 }}>
                    {punchInTime ? (
                      <select
                        value={team.break_type || ""}
                        onChange={(e) => safeUpdateTeam(team.id, { break_type: e.target.value })}
                      >
                        <option value="">—</option>
                        {breakTypes.map((b) => (
                          <option key={b.value} value={b.value}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      team.break_type || "—"
                    )}
                  </td>
                  {adminLogged && (
                    <td style={{ padding: 8 }}>
                      <button onClick={() => punchIn(team)}>⏯️ Punch In</button>
                      <button onClick={() => punchOut(team)} style={{ marginLeft: 5 }}>
                        ⏹️ Punch Out
                      </button>
                      <button
                        onClick={() => removeUser(team.id)}
                        style={{ marginLeft: 5, color: "red" }}
                      >
                        🗑️ Remove
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
