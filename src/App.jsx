import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ulgagdsllwkqxluakifk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Admin secret for generic login
const ADMIN_SECRET = "supersecret"; // Change to your chosen password

export default function App() {
  const [user, setUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminMode, setAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  const [newUser, setNewUser] = useState({ name: "", email: "", role: "user" });

  // Ref to store timers
  const timersRef = useRef({});

  // Fetch current user from Supabase
  useEffect(() => {
    const fetchUser = async () => {
      const { data: u, error } = await supabase.auth.getUser();
      if (error) {
        console.error(error);
        setUser(null);
      } else {
        setUser(u.user);
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  // Fetch teams from Supabase
  const fetchTeams = async () => {
    const { data, error } = await supabase.from("teams").select("*");
    if (error) console.error(error);
    else setTeams(data || []);
  };

  // Handle Punch In / Out
  const handlePunch = async (team) => {
    try {
      const now = new Date().toISOString();
      const updateData =
        team.break_start && !team.break_end
          ? { break_end: now } // Punch Out
          : { break_start: now, break_end: null }; // Punch In

      await supabase
        .from("teams")
        .update(updateData)
        .eq("id", team.id);

      // Immediately update local state
      setTeams((prev) =>
        prev.map((t) =>
          t.id === team.id
            ? { ...t, ...updateData }
            : t
        )
      );
    } catch (error) {
      console.error("Error updating break:", error);
      alert("Error updating break");
    }
  };

  // Live timers
  useEffect(() => {
    const interval = setInterval(() => {
      setTeams((prev) =>
        prev.map((t) => {
          if (t.break_start && !t.break_end) {
            return { ...t, duration: new Date() - new Date(t.break_start) };
          }
          return { ...t, duration: t.break_end && t.break_start ? new Date(t.break_end) - new Date(t.break_start) : 0 };
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Convert milliseconds to HH:MM:SS
  const formatDuration = (ms) => {
    if (!ms) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // Handle Admin Login
  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_SECRET) {
      setAdminMode(true);
      setAdminPassword("");
    } else {
      alert("Wrong password!");
    }
  };

  // Add user
  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email) return alert("Enter name & email");
    const { data, error } = await supabase.from("teams").insert([newUser]);
    if (error) {
      console.error(error);
      alert("Error adding user");
    } else {
      setTeams((prev) => [...prev, data[0]]);
      setNewUser({ name: "", email: "", role: "user" });
    }
  };

  // Export CSV
  const handleExport = (range = "day") => {
    let filtered = [...teams];
    const now = new Date();
    if (range === "day") {
      filtered = filtered.filter((t) => new Date(t.break_start) >= new Date(now.setHours(0, 0, 0, 0)));
    } else if (range === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      filtered = filtered.filter((t) => new Date(t.break_start) >= weekAgo);
    } else if (range === "month") {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      filtered = filtered.filter((t) => new Date(t.break_start) >= monthAgo);
    }

    const headers = ["Name", "Email", "Break Start", "Break End", "Duration"];
    const rows = filtered.map((t) => [
      t.name,
      t.email,
      t.break_start,
      t.break_end,
      formatDuration(t.duration),
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "break_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div>Loading user...</div>;

  return (
    <div className="p-4">
      {!adminMode && (
        <div className="p-4 border rounded bg-gray-100 mb-4">
          <h2 className="font-bold mb-2">Admin Login</h2>
          <input
            type="password"
            placeholder="Enter admin password"
            className="border px-2 py-1 mr-2"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
          <button
            className="bg-blue-500 text-white px-3 py-1 rounded"
            onClick={handleAdminLogin}
          >
            Login
          </button>
        </div>
      )}

      {adminMode && (
        <div className="mb-4">
          <h2 className="font-bold mb-2">Admin Actions</h2>
          <div className="mb-2">
            <button className="bg-green-500 text-white px-3 py-1 rounded mr-2" onClick={() => handleExport("day")}>Export Day</button>
            <button className="bg-green-500 text-white px-3 py-1 rounded mr-2" onClick={() => handleExport("week")}>Export Week</button>
            <button className="bg-green-500 text-white px-3 py-1 rounded mr-2" onClick={() => handleExport("month")}>Export Month</button>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <input
              type="text"
              placeholder="Name"
              className="border px-2 py-1"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            />
            <input
              type="email"
              placeholder="Email"
              className="border px-2 py-1"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
            <select
              className="border px-2 py-1"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
            </select>
            <button
              className="bg-blue-500 text-white px-3 py-1 rounded"
              onClick={handleAddUser}
            >
              Add User
            </button>
          </div>
        </div>
      )}

      <h2 className="font-bold mb-2">Team Break Dashboard</h2>
      <table className="table-auto border-collapse border border-gray-300 w-full">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Email</th>
            <th className="border px-2 py-1">On Break</th>
            <th className="border px-2 py-1">Break Duration</th>
            <th className="border px-2 py-1">Action</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => {
            const onBreak = team.break_start && !team.break_end;
            const longBreak = onBreak && team.duration > 15 * 60 * 1000; // >15 mins
            return (
              <tr key={team.id} className={longBreak ? "bg-red-100" : ""}>
                <td className="border px-2 py-1">{team.name}</td>
                <td className="border px-2 py-1">{team.email}</td>
                <td className="border px-2 py-1">{onBreak ? "Yes" : "No"}</td>
                <td className="border px-2 py-1">{formatDuration(team.duration)}</td>
                <td className="border px-2 py-1">
                  <button
                    className={`px-2 py-1 rounded ${
                      onBreak ? "bg-red-500 text-white" : "bg-green-500 text-white"
                    }`}
                    onClick={() => handlePunch(team)}
                  >
                    {onBreak ? "Punch Out" : "Punch In"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
