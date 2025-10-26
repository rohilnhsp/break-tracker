import React, { useEffect, useState } from "react";

// ---- Supabase Client ----
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";
const supabase = createClient(supabaseUrl, anonKey);

// ---- Generic Admin ----
const GENERIC_ADMIN = { username: "admin", password: "admin123" };

const App = () => {
  const [teams, setTeams] = useState([]);
  const [adminLogged, setAdminLogged] = useState(false);
  const [adminLogin, setAdminLogin] = useState({ username: "", password: "" }));
  const [exportDateRange, setExportDateRange] = useState("daily");

  // Fetch teams
  const fetchTeams = async () => {
    const { data, error } = await supabase.from("teams").select("*");
    if (error) console.error(error);
    else setTeams(data);
  };

  useEffect(() => {
    fetchTeams();
    // Real-time subscription
    const subscription = supabase
      .channel("table_teams")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, fetchTeams)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Punch in/out with daily break accumulation
  const handlePunch = async (team) => {
    const now = new Date();
    if (team.break_start && !team.break_end) {
      // Punch Out
      const breakStart = new Date(team.break_start);
      const durationSec = Math.floor((now - breakStart) / 1000);
      const newDailyBreak = (team.daily_break_seconds || 0) + durationSec;

      const { error } = await supabase
        .from("teams")
        .update({
          break_start: null,
          break_end: now.toISOString(),
          daily_break_seconds: newDailyBreak,
        })
        .eq("id", team.id);
      if (error) console.error("Error punching out:", error);
    } else {
      // Punch In
      const { error } = await supabase
        .from("teams")
        .update({ break_start: now.toISOString(), break_end: null })
        .eq("id", team.id);
      if (error) console.error("Error punching in:", error);
    }
  };

  // Calculate live HH:MM:SS for display
  const getLiveBreak = (team) => {
    let total = team.daily_break_seconds || 0;
    if (team.break_start && !team.break_end) {
      total += Math.floor((new Date() - new Date(team.break_start)) / 1000);
    }
    const hrs = String(Math.floor(total / 3600)).padStart(2, "0");
    const mins = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const secs = String(total % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  useEffect(() => {
    const interval = setInterval(fetchTeams, 1000); // live update every second
    return () => clearInterval(interval);
  }, []);

  // Admin login
  const loginAdmin = () => {
    if (adminLogin.username === GENERIC_ADMIN.username && adminLogin.password === GENERIC_ADMIN.password) {
      setAdminLogged(true);
      setAdminLogin({ username: "", password: "" });
    } else {
      alert("Invalid admin credentials");
    }
  };

  // Add User
  const addUser = async () => {
    const name = prompt("Enter new user's name");
    if (!name) return;
    const { error } = await supabase.from("teams").insert({ name });
    if (error) alert("Error adding user");
  };

  // Remove User
  const removeUser = async (team) => {
    if (!window.confirm(`Remove user ${team.name}?`)) return;
    const { error } = await supabase.from("teams").delete().eq("id", team.id);
    if (error) alert("Error removing user");
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ["Name", "Total Break"];
    const rows = teams.map((t) => [t.name, getLiveBreak(t)]);
    const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `breaks_${exportDateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 font-sans">
      <h1 className="text-2xl mb-4">Team Break Dashboard</h1>

      {/* Admin Login */}
      {!adminLogged && (
        <div className="mb-4 p-2 border rounded w-64">
          <h2 className="font-bold">Admin Login</h2>
          <input
            type="text"
            placeholder="Username"
            value={adminLogin.username}
            onChange={(e) => setAdminLogin({ ...adminLogin, username: e.target.value })}
            className="border p-1 w-full mb-1"
          />
          <input
            type="password"
            placeholder="Password"
            value={adminLogin.password}
            onChange={(e) => setAdminLogin({ ...adminLogin, password: e.target.value })}
            className="border p-1 w-full mb-1"
          />
          <button onClick={loginAdmin} className="bg-blue-500 text-white px-2 py-1 rounded">
            Login
          </button>
        </div>
      )}

      {/* Admin Actions */}
      {adminLogged && (
        <div className="mb-4 space-x-2">
          <button onClick={addUser} className="bg-green-500 text-white px-2 py-1 rounded">Add User</button>
          <button onClick={exportCSV} className="bg-blue-500 text-white px-2 py-1 rounded">Export CSV</button>
          <select onChange={(e) => setExportDateRange(e.target.value)} value={exportDateRange}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      )}

      {/* User Table */}
      <table className="w-full border-collapse border">
        <thead>
          <tr>
            <th className="border p-1">Name</th>
            <th className="border p-1">Break Duration (HH:MM:SS)</th>
            <th className="border p-1">Action</th>
            {adminLogged && <th className="border p-1">Admin</th>}
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => {
            const totalSeconds = team.daily_break_seconds || 0;
            const ongoing = team.break_start && !team.break_end;
            const longBreak = totalSeconds >= 60 * 30; // 30 minutes
            return (
              <tr key={team.id} className={longBreak ? "bg-red-100" : ""}>
                <td className="border p-1">{team.name}</td>
                <td className="border p-1">{getLiveBreak(team)}</td>
                <td className="border p-1">
                  <button
                    onClick={() => handlePunch(team)}
                    className={`px-2 py-1 rounded ${ongoing ? "bg-red-500 text-white" : "bg-green-500 text-white"}`}
                  >
                    {ongoing ? "Punch Out" : "Punch In"}
                  </button>
                </td>
                {adminLogged && (
                  <td className="border p-1">
                    <button
                      onClick={() => removeUser(team)}
                      className="bg-gray-500 text-white px-2 py-1 rounded"
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default App;
