import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";

const supabase = createClient(supabaseUrl, supabaseKey);

function formatDuration(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function App() {
  const [teams, setTeams] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "user" });

  const intervalRef = useRef();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) console.error(error);
      else setUser(user);
      setLoading(false);
    };
    getUser();
  }, []);

  useEffect(() => {
    const fetchTeams = async () => {
      const { data, error } = await supabase.from("teams").select("*");
      if (error) console.error(error);
      else setTeams(data);
    };
    fetchTeams();

    const subscription = supabase
      .channel("public:teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          setTeams((prev) =>
            prev.map((t) => (t.id === payload.new.id ? payload.new : t))
          );
        }
      )
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTeams((prev) =>
        prev.map((t) => {
          if (t.break_start && !t.break_end) {
            const start = new Date(t.break_start);
            const seconds = Math.floor((Date.now() - start) / 1000);
            return { ...t, liveDuration: seconds };
          }
          return { ...t, liveDuration: 0 };
        })
      );
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, []);

  const handlePunch = async (team) => {
    try {
      const now = new Date().toISOString();
      const updates =
        !team.break_start || team.break_end
          ? { break_start: now, break_end: null }
          : { break_end: now };

      const { data, error } = await supabase
        .from("teams")
        .update(updates)
        .eq("id", team.id)
        .select();

      if (error) throw error;

      setTeams((prev) =>
        prev.map((t) => (t.id === team.id ? { ...t, ...data[0] } : t))
      );
    } catch (err) {
      console.error("Error updating break:", err);
      alert("Failed to update break");
    }
  };

  const exportCSV = (filter = "all") => {
    let filteredTeams = teams;

    const now = new Date();
    if (filter === "daily") {
      filteredTeams = teams.filter(
        (t) =>
          t.break_start &&
          new Date(t.break_start).toDateString() === now.toDateString()
      );
    } else if (filter === "weekly") {
      const weekStart = new Date();
      weekStart.setDate(now.getDate() - now.getDay());
      filteredTeams = teams.filter(
        (t) =>
          t.break_start &&
          new Date(t.break_start) >= weekStart
      );
    } else if (filter === "monthly") {
      filteredTeams = teams.filter(
        (t) =>
          t.break_start &&
          new Date(t.break_start).getMonth() === now.getMonth() &&
          new Date(t.break_start).getFullYear() === now.getFullYear()
      );
    }

    const csvContent = [
      ["Name", "Email", "Break Start", "Break End", "Duration (HH:MM:SS)"],
      ...filteredTeams.map((t) => [
        t.name,
        t.email,
        t.break_start || "",
        t.break_end || "",
        t.liveDuration ? formatDuration(t.liveDuration) : ""
      ])
    ]
      .map((e) => e.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "breaks_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fetch all users (admin only)
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user?.role) return;
      const { data, error } = await supabase.from("users").select("*");
      if (error) console.error(error);
      else setUsers(data);
    };
    fetchUsers();
  }, [user]);

  const addUser = async () => {
    try {
      const { data, error } = await supabase.from("users").insert([newUser]).select();
      if (error) throw error;
      setUsers((prev) => [...prev, ...data]);
      setNewUser({ name: "", email: "", role: "user" });
    } catch (err) {
      console.error(err);
      alert("Failed to add user");
    }
  };

  if (loading) return <div className="p-6">Loading user...</div>;

  const isAdmin = user?.role === "admin" || user?.role === "manager";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Team Break Dashboard</h1>

      {isAdmin && (
        <>
          <div className="mb-4 flex gap-2">
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded"
              onClick={() => exportCSV("daily")}
            >
              Export Daily
            </button>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded"
              onClick={() => exportCSV("weekly")}
            >
              Export Weekly
            </button>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded"
              onClick={() => exportCSV("monthly")}
            >
              Export Monthly
            </button>
          </div>

          {/* Add User Form */}
          <div className="mb-6 p-4 border rounded bg-gray-50">
            <h2 className="font-bold mb-2">Add / Assign User</h2>
            <input
              className="border px-2 py-1 mr-2"
              placeholder="Name"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            />
            <input
              className="border px-2 py-1 mr-2"
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
            <select
              className="border px-2 py-1 mr-2"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <button
              className="bg-green-500 text-white px-3 py-1 rounded"
              onClick={addUser}
            >
              Add User
            </button>
          </div>

          {/* Existing users list */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">Users</h3>
            <table className="min-w-full border border-gray-300">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border px-2 py-1">Name</th>
                  <th className="border px-2 py-1">Email</th>
                  <th className="border px-2 py-1">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="border px-2 py-1">{u.name}</td>
                    <td className="border px-2 py-1">{u.email}</td>
                    <td className="border px-2 py-1">{u.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-200">
          <tr>
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
            const duration = team.liveDuration || 0;
            const longBreak = duration > 30 * 60;

            return (
              <tr
                key={team.id}
                className={longBreak ? "bg-red-100" : ""}
              >
                <td className="border px-2 py-1">{team.name}</td>
                <td className="border px-2 py-1">{team.email}</td>
                <td className="border px-2 py-1">
                  {onBreak ? (
                    <span className="bg-yellow-200 px-2 py-1 rounded">Yes</span>
                  ) : (
                    <span className="bg-green-200 px-2 py-1 rounded">No</span>
                  )}
                </td>
                <td className="border px-2 py-1">{formatDuration(duration)}</td>
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

export default App;
