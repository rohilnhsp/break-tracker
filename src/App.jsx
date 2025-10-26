import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Clients ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk"; // replace with actual anonKey
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDE2MjM3OCwiZXhwIjoyMDc1NzM4Mzc4fQ.Wu8NyTeIU5rB_evLHfg2RSTqt9UKjEQEIF-RCfbOvQM"; // replace with actual serviceKey
const supabase = createClient(supabaseUrl, anonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

export default function App() {
  const [teams, setTeams] = useState([]);
  const [adminLogged, setAdminLogged] = useState(false);
  const [adminLogin, setAdminLogin] = useState({ username: "", password: "" });
  const [exportDateRange, setExportDateRange] = useState("daily");
  const [adminVisible, setAdminVisible] = useState(false);

  // Fetch teams/users
  const fetchTeams = async () => {
    try {
      const { data } = await supabase.from("teams").select("*");
      setTeams(data || []);
    } catch (err) {
      console.error("Error fetching teams:", err);
    }
  };

  useEffect(() => {
    fetchTeams();
    const interval = setInterval(() => {
      setTeams((prev) => [...prev]); // triggers live timer re-render
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Punch In / Out
  const handlePunch = async (id) => {
    const team = teams.find((t) => t.id === id);
    const now = new Date().toISOString();

    try {
      let updates = {};
      if (!team.break_start || team.break_end) {
        // Punch in
        updates = { break_start: now, break_end: null };
      } else {
        // Punch out
        const start = new Date(team.break_start);
        const seconds = Math.floor((new Date() - start) / 1000);
        const total = (team.daily_break_seconds || 0) + seconds;
        updates = { break_end: now, daily_break_seconds: total };
      }

      await supabase.from("teams").update(updates).eq("id", id);
      fetchTeams();
    } catch (err) {
      console.error("Error punching:", err);
    }
  };

  // Admin login
  const handleAdminLogin = () => {
    if (adminLogin.username === "admin" && adminLogin.password === "password") {
      setAdminLogged(true);
      setAdminVisible(false);
    } else {
      alert("Invalid credentials");
    }
  };

  // Add user
  const handleAddUser = async () => {
    const name = prompt("Enter user name:");
    if (!name) return;
    try {
      await supabaseAdmin.from("teams").insert([{ name }]);
      fetchTeams();
    } catch (err) {
      console.error("Error adding user:", err);
    }
  };

  // Remove user
  const handleRemoveUser = async (id) => {
    if (!window.confirm("Are you sure you want to remove this user?")) return;
    try {
      await supabaseAdmin.from("teams").delete().eq("id", id);
      fetchTeams();
    } catch (err) {
      console.error("Error removing user:", err);
    }
  };

  // Export CSV
  const handleExport = () => {
    const rows = teams.map((t) => ({
      name: t.name,
      currentBreak: formatHHMMSS(
        t.break_start && !t.break_end
          ? Math.floor((new Date() - new Date(t.break_start)) / 1000)
          : 0
      ),
      dailyBreak: formatHHMMSS(t.daily_break_seconds || 0),
    }));
    const csv =
      Object.keys(rows[0]).join(",") +
      "\n" +
      rows.map((r) => Object.values(r).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-${exportDateRange}.csv`;
    a.click();
  };

  // Format HH:MM:SS
  const formatHHMMSS = (secs) => {
    const h = Math.floor(secs / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((secs % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(secs % 60)
      .toString()
      .padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
      {/* Admin Button */}
      <div className="flex justify-end mb-4">
        {!adminLogged && (
          <button
            onClick={() => setAdminVisible(!adminVisible)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Admin Login
          </button>
        )}
      </div>

      {/* Admin Login Panel */}
      {adminVisible && !adminLogged && (
        <div className="mb-4 p-4 bg-white rounded shadow-md max-w-md mx-auto">
          <input
            type="text"
            placeholder="Username"
            value={adminLogin.username}
            onChange={(e) =>
              setAdminLogin({ ...adminLogin, username: e.target.value })
            }
            className="border p-2 mb-2 w-full rounded"
          />
          <input
            type="password"
            placeholder="Password"
            value={adminLogin.password}
            onChange={(e) =>
              setAdminLogin({ ...adminLogin, password: e.target.value })
            }
            className="border p-2 mb-2 w-full rounded"
          />
          <button
            onClick={handleAdminLogin}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition w-full"
          >
            Login
          </button>
        </div>
      )}

      {/* Dashboard Table */}
      <div className="overflow-x-auto w-full max-w-6xl mx-auto">
        <table className="min-w-full border-collapse shadow-lg rounded-lg overflow-hidden">
          <thead className="bg-gray-200 sticky top-0">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Current Break</th>
              <th className="text-left px-4 py-3">Today's Total Break</th>
              <th className="text-left px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, idx) => {
              const longBreak = (t.daily_break_seconds || 0) / 60 > 15;
              const currentBreakSeconds =
                t.break_start && !t.break_end
                  ? Math.floor((new Date() - new Date(t.break_start)) / 1000)
                  : 0;
              const rowColor = idx % 2 === 0 ? "bg-white" : "bg-gray-50";
              return (
                <tr
                  key={t.id}
                  className={`${rowColor} ${longBreak ? "bg-red-100" : ""} border-b`}
                >
                  <td className="px-4 py-2">{t.name}</td>
                  <td className="px-4 py-2">{formatHHMMSS(currentBreakSeconds)}</td>
                  <td className="px-4 py-2">{formatHHMMSS(t.daily_break_seconds || 0)}</td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      onClick={() => handlePunch(t.id)}
                      className="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700 transition"
                    >
                      {t.break_start && !t.break_end ? "Punch Out" : "Punch In"}
                    </button>
                    {adminLogged && (
                      <button
                        onClick={() => handleRemoveUser(t.id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
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

      {/* Admin Functions */}
      {adminLogged && (
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          <button
            onClick={handleAddUser}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Add User
          </button>
          <select
            value={exportDateRange}
            onChange={(e) => setExportDateRange(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <button
            onClick={handleExport}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
          >
            Export
          </button>
        </div>
      )}
    </div>
  );
}
