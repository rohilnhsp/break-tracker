import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Client ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDE2MjM3OCwiZXhwIjoyMDc1NzM4Mzc4fQ.Wu8NyTeIU5rB_evLHfg2RSTqt9UKjEQEIF-RCfbOvQM";

const supabase = createClient(supabaseUrl, anonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

const BREAK_TYPES = [
  { label: "Tea", emoji: "☕" },
  { label: "Bio", emoji: "🚻" },
  { label: "Lunch", emoji: "🍽️" },
  { label: "Dinner", emoji: "🍲" },
];

export default function App() {
  const [teams, setTeams] = useState([]);
  const [adminLogged, setAdminLogged] = useState(false);
  const [adminLogin, setAdminLogin] = useState({ username: "", password: "" });
  const [exportDateRange, setExportDateRange] = useState("daily");

  // Fetch teams/users
  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase.from("teams").select("*");
      if (error) console.error("Fetch teams error:", error);
      else setTeams(data || []);
    } catch (err) {
      console.error("Fetch teams exception:", err);
    }
  };

  useEffect(() => {
    fetchTeams();
    const interval = setInterval(fetchTeams, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Daily reset logic
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setTeams(prev =>
      prev.map(t => {
        if (!t.last_break_date || t.last_break_date !== today) {
          return { ...t, daily_break_seconds: 0, last_break_date: today };
        }
        return t;
      })
    );
  }, [teams]);

  // Punch in/out
  const punchInOut = async (team, breakType = null) => {
    const now = new Date().toISOString();
    const updatedTeam = { ...team };
    if (!team.break_start) {
      // Punch In
      updatedTeam.break_start = now;
      updatedTeam.break_type = breakType?.label || "Unknown";
    } else {
      // Punch Out
      const start = new Date(team.break_start);
      const diff = Math.floor((new Date() - start) / 1000);
      updatedTeam.daily_break_seconds = (team.daily_break_seconds || 0) + diff;
      updatedTeam.break_start = null;
      updatedTeam.break_type = null;
    }

    try {
      const { data, error } = await supabaseAdmin
        .from("teams")
        .update({
          break_start: updatedTeam.break_start,
          break_type: updatedTeam.break_type,
          daily_break_seconds: updatedTeam.daily_break_seconds || 0,
          last_break_date: updatedTeam.last_break_date || new Date().toISOString().split("T")[0],
        })
        .eq("id", team.id);

      if (error) console.error("Error punching in/out:", error);
      fetchTeams();
    } catch (err) {
      console.error("Punch in/out exception:", err);
    }
  };

  // Add User
  const addUser = async (name) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabaseAdmin
        .from("teams")
        .insert([{ name, daily_break_seconds: 0, last_break_date: today }]);
      if (error) console.error("Error adding user:", error);
      else fetchTeams();
    } catch (err) {
      console.error("Add user exception:", err);
    }
  };

  // Remove User
  const removeUser = async (id) => {
    try {
      const { error } = await supabaseAdmin.from("teams").delete().eq("id", id);
      if (error) console.error("Remove user error:", error);
      else fetchTeams();
    } catch (err) {
      console.error("Remove user exception:", err);
    }
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ["Name", "Break Type", "Daily Break (s)"];
    const rows = teams.map(t => [
      t.name,
      t.break_type || "-",
      t.daily_break_seconds || 0,
    ]);

    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";
    rows.forEach(r => {
      csvContent += r.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `breaks_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Admin Login
  const handleAdminLogin = () => {
    // Generic credentials
    if (adminLogin.username === "admin" && adminLogin.password === "admin123") {
      setAdminLogged(true);
      setAdminLogin({ username: "", password: "" });
    } else alert("Wrong admin credentials!");
  };

  return (
    <div className="p-4 font-sans">
      <h1 className="text-2xl font-bold mb-4">Break Tracker Dashboard</h1>

      {!adminLogged && (
        <div className="mb-4">
          <input
            className="border p-1 mr-2"
            placeholder="Admin Username"
            value={adminLogin.username}
            onChange={e => setAdminLogin(prev => ({ ...prev, username: e.target.value }))}
          />
          <input
            className="border p-1 mr-2"
            type="password"
            placeholder="Password"
            value={adminLogin.password}
            onChange={e => setAdminLogin(prev => ({ ...prev, password: e.target.value }))}
          />
          <button className="px-2 py-1 bg-blue-500 text-white rounded" onClick={handleAdminLogin}>
            Admin Login
          </button>
        </div>
      )}

      {adminLogged && (
        <div className="mb-4 flex gap-2">
          <button
            className="px-2 py-1 bg-green-500 text-white rounded"
            onClick={() => {
              const name = prompt("Enter user name");
              if (name) addUser(name);
            }}
          >
            Add User
          </button>
          <button
            className="px-2 py-1 bg-gray-500 text-white rounded"
            onClick={exportCSV}
          >
            Export CSV
          </button>
        </div>
      )}

      <table className="min-w-full border-collapse border border-gray-200 shadow-sm">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            <th className="p-2 border-b">Name</th>
            <th className="p-2 border-b">Break Type</th>
            <th className="p-2 border-b">Daily Break ⏱️</th>
            <th className="p-2 border-b">Current Break ⏱️</th>
            <th className="p-2 border-b">Actions</th>
          </tr>
        </thead>
        <tbody>
          {teams.map(team => {
            const currentBreakSeconds = team.break_start
              ? Math.floor((new Date() - new Date(team.break_start)) / 1000)
              : 0;
            return (
              <tr
                key={team.id}
                className={team.break_start ? "bg-yellow-50" : "bg-white"}
              >
                <td className="p-2 border-b">{team.name}</td>
                <td className="p-2 border-b">{team.break_type || "-"}</td>
                <td className="p-2 border-b">{team.daily_break_seconds || 0}</td>
                <td className="p-2 border-b">{currentBreakSeconds}</td>
                <td className="p-2 border-b flex gap-2 items-center">
                  {!team.break_start ? (
                    <>
                      <select
                        className="border rounded p-1"
                        value={team.selectedBreak || ""}
                        onChange={(e) => {
                          const selected = e.target.value;
                          setTeams(prev =>
                            prev.map(t =>
                              t.id === team.id ? { ...t, selectedBreak: selected } : t
                            )
                          );
                        }}
                      >
                        <option value="">Select Break</option>
                        {BREAK_TYPES.map((b) => (
                          <option key={b.label} value={b.label}>
                            {b.emoji} {b.label}
                          </option>
                        ))}
                      </select>
                      <button
                        className="px-2 py-1 rounded bg-green-500 text-white hover:bg-green-600"
                        onClick={() =>
                          punchInOut(team, BREAK_TYPES.find(b => b.label === team.selectedBreak))
                        }
                        disabled={!team.selectedBreak}
                      >
                        Punch In
                      </button>
                    </>
                  ) : (
                    <button
                      className="px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                      onClick={() => punchInOut(team)}
                    >
                      Punch Out
                    </button>
                  )}
                  {adminLogged && (
                    <button
                      className="px-2 py-1 rounded bg-gray-500 text-white hover:bg-gray-600"
                      onClick={() => removeUser(team.id)}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
