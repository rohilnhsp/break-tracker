import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css"; // Tailwind base styles

// ---- Supabase Clients ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";
const serviceKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDE2MjM3OCwiZXhwIjoyMDc1NzM4Mzc4fQ.Wu8NyTeIU5rB_evLHfg2RSTqt9UKjEQEIF-RCfbOvQM";

const supabase = createClient(supabaseUrl, anonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

function App() {
  const [teams, setTeams] = useState([]);
  const [adminLogged, setAdminLogged] = useState(false);
  const [adminLoginVisible, setAdminLoginVisible] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({
    username: "",
    password: "",
  });
  const [exportRange, setExportRange] = useState("daily");

  const fetchTeams = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");
      if (error) console.log("Fetch teams error:", error);

      if (data) {
        // Reset daily break if date changed
        const updatedData = data.map((team) => {
          if (!team.last_break_date || team.last_break_date !== today) {
            return { ...team, daily_break_seconds: 0, last_break_date: today };
          }
          return team;
        });
        setTeams(updatedData);
      }
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchTeams();
    const interval = setInterval(fetchTeams, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Live timer for current break
  useEffect(() => {
    const interval = setInterval(() => {
      setTeams((prev) =>
        prev.map((team) => {
          if (team.break_start && !team.break_end) {
            const start = new Date(team.break_start);
            const seconds =
              Math.floor((Date.now() - start.getTime()) / 1000) +
              (team.current_break_seconds || 0);
            return { ...team, current_break_seconds: seconds };
          }
          return { ...team, current_break_seconds: 0 };
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const punchInOut = async (team) => {
    const now = new Date().toISOString();
    try {
      if (!team.break_start) {
        // Punch in
        const { error } = await supabase
          .from("teams")
          .update({ break_start: now })
          .eq("id", team.id);
        if (error) throw error;
      } else {
        // Punch out
        const currentBreak =
          (team.current_break_seconds || 0) + (team.daily_break_seconds || 0);
        const { error } = await supabase
          .from("teams")
          .update({
            break_start: null,
            break_end: now,
            daily_break_seconds: currentBreak,
          })
          .eq("id", team.id);
        if (error) throw error;
      }
      fetchTeams();
    } catch (err) {
      console.log("Error punching:", err);
    }
  };

  const handleAdminLogin = () => {
    if (
      adminCredentials.username === "admin" &&
      adminCredentials.password === "admin123"
    ) {
      setAdminLogged(true);
      setAdminLoginVisible(false);
    } else {
      alert("Wrong credentials");
    }
  };

  const addUser = async () => {
    const name = prompt("Enter user name:");
    if (!name) return;
    try {
      const { error } = await supabaseAdmin.from("teams").insert([
        { name, daily_break_seconds: 0, last_break_date: new Date().toISOString().split("T")[0] },
      ]);
      if (error) throw error;
      fetchTeams();
    } catch (err) {
      console.log("Error adding user:", err);
    }
  };

  const removeUser = async (teamId) => {
    if (!window.confirm("Remove this user?")) return;
    try {
      const { error } = await supabaseAdmin.from("teams").delete().eq("id", teamId);
      if (error) throw error;
      fetchTeams();
    } catch (err) {
      console.log("Error removing user:", err);
    }
  };

  const exportData = () => {
    const date = new Date();
    let filtered = [...teams];
    if (exportRange === "daily") {
      const today = date.toISOString().split("T")[0];
      filtered = filtered.filter((t) => t.last_break_date === today);
    } else if (exportRange === "weekly") {
      const start = new Date(date);
      start.setDate(date.getDate() - 7);
      filtered = filtered.filter(
        (t) => new Date(t.last_break_date) >= start
      );
    } else if (exportRange === "monthly") {
      const start = new Date(date);
      start.setMonth(date.getMonth() - 1);
      filtered = filtered.filter(
        (t) => new Date(t.last_break_date) >= start
      );
    }

    const csv = [
      ["Name", "Daily Break (s)", "Current Break (s)"],
      ...filtered.map((t) => [
        t.name,
        t.daily_break_seconds || 0,
        t.current_break_seconds || 0,
      ]),
    ]
      .map((e) => e.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "break_data.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((sec % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Break Tracker</h1>
        <button
          className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
          onClick={() => setAdminLoginVisible(!adminLoginVisible)}
        >
          Admin
        </button>
      </header>

      {adminLoginVisible && !adminLogged && (
        <div className="mb-4 p-4 bg-white shadow rounded max-w-sm">
          <h2 className="text-lg font-semibold mb-2">Admin Login</h2>
          <input
            type="text"
            placeholder="Username"
            className="w-full mb-2 p-2 border rounded"
            value={adminCredentials.username}
            onChange={(e) =>
              setAdminCredentials({ ...adminCredentials, username: e.target.value })
            }
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full mb-2 p-2 border rounded"
            value={adminCredentials.password}
            onChange={(e) =>
              setAdminCredentials({ ...adminCredentials, password: e.target.value })
            }
          />
          <button
            className="px-3 py-1 rounded bg-green-500 text-white hover:bg-green-600"
            onClick={handleAdminLogin}
          >
            Login
          </button>
        </div>
      )}

      {adminLogged && (
        <div className="flex gap-2 mb-4">
          <button
            className="px-3 py-1 rounded bg-green-500 text-white hover:bg-green-600"
            onClick={addUser}
          >
            Add User
          </button>
          <button
            className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600"
            onClick={exportData}
          >
            Export {exportRange}
          </button>
          <select
            className="border rounded p-1"
            value={exportRange}
            onChange={(e) => setExportRange(e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team, idx) => {
          const isLongBreak = (team.current_break_seconds || 0) >= 60 * 15; // 15 min
          return (
            <div
              key={team.id}
              className={`p-4 rounded shadow-md bg-white ${
                idx % 2 === 0 ? "bg-gray-50" : "bg-white"
              }`}
            >
              <h2 className="text-lg font-semibold">{team.name}</h2>
              <p>
                Current Break:{" "}
                <span className={isLongBreak ? "text-red-500 font-bold" : ""}>
                  {formatTime(team.current_break_seconds || 0)}
                </span>
              </p>
              <p>Today's Total Break: {formatTime(team.daily_break_seconds || 0)}</p>
              <button
                className={`mt-2 px-3 py-1 rounded text-white ${
                  !team.break_start
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-red-500 hover:bg-red-600"
                }`}
                onClick={() => punchInOut(team)}
              >
                {!team.break_start ? "Punch In" : "Punch Out"}
              </button>
              {adminLogged && (
                <button
                  className="mt-2 ml-2 px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600"
                  onClick={() => removeUser(team.id)}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
