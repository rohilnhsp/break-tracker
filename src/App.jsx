import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Clients ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey = "YOUR_ANON_KEY"; // user client
const serviceKey = "YOUR_SERVICE_KEY"; // admin client

const supabase = createClient(supabaseUrl, anonKey);
const adminSupabase = createClient(supabaseUrl, serviceKey);

function formatDuration(start) {
  if (!start) return "00:00:00";
  const diff = new Date() - new Date(start);
  const hrs = String(Math.floor(diff / 3600000)).padStart(2, "0");
  const mins = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
  const secs = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [timers, setTimers] = useState({});
  const [adminMode, setAdminMode] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "user" });
  const [exportRange, setExportRange] = useState("daily");

  // Fetch logged-in user
  useEffect(() => {
    async function fetchUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error) return console.error(error);
      setUser(data.user);
    }
    fetchUser();
  }, []);

  // Fetch all users
  async function fetchUsers() {
    const { data, error } = await adminSupabase.from("teams").select("*");
    if (error) return console.error(error);
    setUsers(data);
  }

  useEffect(() => {
    if (adminMode) fetchUsers();
  }, [adminMode]);

  // Live timers
  useEffect(() => {
    const interval = setInterval(() => {
      const updatedTimers = {};
      users.forEach(u => {
        if (u.break_start && !u.break_end) updatedTimers[u.id] = formatDuration(u.break_start);
      });
      setTimers(updatedTimers);
    }, 1000);
    return () => clearInterval(interval);
  }, [users]);

  // Punch In / Out
  async function toggleBreak(userId) {
    const userItem = users.find(u => u.id === userId);
    const now = new Date().toISOString();
    const payload = userItem.break_start ? { break_end: now } : { break_start: now, break_end: null };

    try {
      const { data, error } = await adminSupabase
        .from("teams")
        .update(payload)
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setUsers(users.map(u => (u.id === userId ? data : u)));
    } catch (err) {
      console.error("Error updating break:", err);
      alert("Failed to update break");
    }
  }

  // Add user / assign admin
  async function handleAddUser(e) {
    e.preventDefault();
    try {
      const { data, error } = await adminSupabase.from("teams").insert([newUser]).select().single();
      if (error) throw error;
      setUsers([...users, data]);
      setNewUser({ name: "", email: "", role: "user" });
    } catch (err) {
      console.error("Error adding user:", err);
      alert("Error adding user");
    }
  }

  // Export CSV
  function exportCSV() {
    let filtered = [...users];
    const now = new Date();
    if (exportRange === "daily") {
      filtered = filtered.filter(u => u.break_start && new Date(u.break_start).toDateString() === now.toDateString());
    } else if (exportRange === "weekly") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 3600000);
      filtered = filtered.filter(u => u.break_start && new Date(u.break_start) >= weekAgo);
    } else if (exportRange === "monthly") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 3600000);
      filtered = filtered.filter(u => u.break_start && new Date(u.break_start) >= monthAgo);
    }
    // CSV creation
    const header = ["Name", "Email", "On Break", "Break Duration"];
    const rows = filtered.map(u => [
      u.name,
      u.email,
      u.break_start && !u.break_end ? "Yes" : "No",
      timers[u.id] || "00:00:00"
    ]);
    const csvContent = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "break_data.csv";
    link.click();
  }

  if (!user) return <div className="p-8 text-center">Loading user...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Break Dashboard</h1>

      {user.email === "admin@example.com" && (
        <button
          className="mb-4 px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => setAdminMode(!adminMode)}
        >
          {adminMode ? "Switch to User View" : "Switch to Admin View"}
        </button>
      )}

      {adminMode ? (
        <div>
          <h2 className="text-xl font-semibold mb-2">Admin Panel</h2>
          <form onSubmit={handleAddUser} className="mb-4">
            <input
              type="text"
              placeholder="Name"
              value={newUser.name}
              onChange={e => setNewUser({ ...newUser, name: e.target.value })}
              className="border px-2 py-1 mr-2"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={newUser.email}
              onChange={e => setNewUser({ ...newUser, email: e.target.value })}
              className="border px-2 py-1 mr-2"
              required
            />
            <select
              value={newUser.role}
              onChange={e => setNewUser({ ...newUser, role: e.target.value })}
              className="border px-2 py-1 mr-2"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">
              Add User
            </button>
          </form>

          <div className="mb-4">
            <select
              value={exportRange}
              onChange={e => setExportRange(e.target.value)}
              className="border px-2 py-1 mr-2"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <button
              onClick={exportCSV}
              className="px-4 py-2 bg-purple-600 text-white rounded"
            >
              Export CSV
            </button>
          </div>

          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr>
                <th className="border px-2 py-1">Name</th>
                <th className="border px-2 py-1">Email</th>
                <th className="border px-2 py-1">Role</th>
                <th className="border px-2 py-1">Break</th>
                <th className="border px-2 py-1">Timer</th>
                <th className="border px-2 py-1">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const onBreak = u.break_start && !u.break_end;
                const duration = timers[u.id] || "00:00:00";
                const highlight = onBreak && duration.split(":")[1] >= 30; // e.g., >30 mins
                return (
                  <tr key={u.id} className={highlight ? "bg-red-200" : ""}>
                    <td className="border px-2 py-1">{u.name}</td>
                    <td className="border px-2 py-1">{u.email}</td>
                    <td className="border px-2 py-1">{u.role}</td>
                    <td className="border px-2 py-1">{onBreak ? "Yes" : "No"}</td>
                    <td className="border px-2 py-1">{duration}</td>
                    <td className="border px-2 py-1">
                      <button
                        onClick={() => toggleBreak(u.id)}
                        className="px-2 py-1 bg-blue-500 text-white rounded"
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
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-2">User Dashboard</h2>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr>
                <th className="border px-2 py-1">Name</th>
                <th className="border px-2 py-1">Break</th>
                <th className="border px-2 py-1">Timer</th>
                <th className="border px-2 py-1">Action</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter(u => u.role === "user")
                .map(u => {
                  const onBreak = u.break_start && !u.break_end;
                  const duration = timers[u.id] || "00:00:00";
                  const highlight = onBreak && duration.split(":")[1] >= 30;
                  return (
                    <tr key={u.id} className={highlight ? "bg-red-200" : ""}>
                      <td className="border px-2 py-1">{u.name}</td>
                      <td className="border px-2 py-1">{onBreak ? "Yes" : "No"}</td>
                      <td className="border px-2 py-1">{duration}</td>
                      <td className="border px-2 py-1">
                        <button
                          onClick={() => toggleBreak(u.id)}
                          className="px-2 py-1 bg-blue-500 text-white rounded"
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
      )}
    </div>
  );
}
