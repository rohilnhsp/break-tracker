import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";
const supabase = createClient(supabaseUrl, supabaseKey);

const App = () => {
  const [users, setUsers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ Fetch all users
  const fetchUsers = async () => {
    try {
      const { data, error, status } = await supabase.from("teams").select("*");
      if (error && status !== 406) throw error;
      setUsers(data || []);
    } catch (err) {
      console.warn("Fetch error:", err.message);
      setUsers([]);
    }
  };

  // ✅ Add User (Admin)
  const addUser = async () => {
    const name = prompt("Enter user name:");
    if (!name) return;
    try {
      const { error } = await supabase.from("teams").insert([{ name }]);
      if (error) throw error;
      fetchUsers();
    } catch (err) {
      console.error("Add user error:", err.message);
    }
  };

  // ✅ Remove User (Admin)
  const removeUser = async (id) => {
    if (!window.confirm("Remove this user?")) return;
    try {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
      fetchUsers();
    } catch (err) {
      console.error("Remove error:", err.message);
    }
  };

  // ✅ Punch In/Out
  const handlePunch = async (user) => {
    try {
      setLoading(true);
      const onBreak = user.start_time && !user.end_time;

      if (onBreak) {
        // Punch out
        const { error } = await supabase
          .from("teams")
          .update({
            end_time: new Date().toISOString(),
          })
          .eq("id", user.id);
        if (error) throw error;
      } else {
        // Punch in
        const { error } = await supabase
          .from("teams")
          .update({
            start_time: new Date().toISOString(),
            end_time: null,
          })
          .eq("id", user.id);
        if (error) throw error;
      }

      fetchUsers();
    } catch (err) {
      console.error("Punch error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Update Break Type (only when not active)
  const handleBreakTypeChange = async (user, newType) => {
    if (user.start_time && !user.end_time) return; // prevent mid-break change
    try {
      const { error } = await supabase
        .from("teams")
        .update({ break_type: newType })
        .eq("id", user.id);
      if (error) throw error;
      fetchUsers();
    } catch (err) {
      console.error("Break type update error:", err.message);
    }
  };

  // ✅ Calculate duration (HH:MM:SS)
  const getDuration = (start, end) => {
    if (!start) return 0;
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    return Math.floor((endTime - startTime) / 1000);
  };

  // ✅ Format duration to HH:MM:SS
  const formatDuration = (seconds) => {
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // ✅ Get today's total duration (all completed breaks)
  const getTodayDuration = (user) => {
    if (!user.start_time) return 0;
    const start = new Date(user.start_time);
    const end = user.end_time ? new Date(user.end_time) : new Date();
    const sameDay =
      new Date().toDateString() === new Date(start).toDateString();
    return sameDay ? getDuration(user.start_time, user.end_time) : 0;
  };

  // ✅ Export CSV
  const exportCSV = () => {
    const csvRows = [
      ["Name", "Break Type", "Current Break", "Daily Total"],
      ...users.map((u) => [
        u.name,
        u.break_type || "-",
        formatDuration(getDuration(u.start_time, u.end_time)),
        formatDuration(getTodayDuration(u)),
      ]),
    ];
    const blob = new Blob([csvRows.map((r) => r.join(",")).join("\n")], {
      type: "text/csv",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "break_tracker.csv";
    a.click();
  };

  // ✅ Admin Login
  const handleAdminLogin = () => {
    const pass = prompt("Enter admin password:");
    if (pass === "admin123") setIsAdmin(true);
    else alert("Incorrect password!");
  };

  // ⏱️ Live refresh
  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">☕ Break Tracker</h1>

      <div className="flex justify-center gap-4 mb-6">
        {!isAdmin && (
          <button
            onClick={handleAdminLogin}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Admin Login
          </button>
        )}
        {isAdmin && (
          <>
            <button
              onClick={addUser}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
            >
              ➕ Add User
            </button>
            <button
              onClick={exportCSV}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600"
            >
              ⬇️ Export CSV
            </button>
          </>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-md text-center">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3">👤 Name</th>
              <th className="p-3">🕒 Current Break</th>
              <th className="p-3">📅 Daily Total</th>
              <th className="p-3">🧾 Type</th>
              <th className="p-3">⚡ Action</th>
              {isAdmin && <th className="p-3">❌ Remove</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const onBreak = u.start_time && !u.end_time;
              const currDuration = formatDuration(
                getDuration(u.start_time, u.end_time)
              );
              const totalDuration = formatDuration(getTodayDuration(u));

              return (
                <tr
                  key={u.id}
                  className={`border-t ${
                    onBreak ? "bg-yellow-100" : "bg-white"
                  }`}
                >
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3 font-mono">{currDuration}</td>
                  <td className="p-3 font-mono">{totalDuration}</td>
                  <td className="p-3">
                    <select
                      value={u.break_type || "☕ Tea Break"}
                      disabled={onBreak}
                      onChange={(e) =>
                        handleBreakTypeChange(u, e.target.value)
                      }
                      className="border rounded-md p-1"
                    >
                      <option>☕ Tea Break</option>
                      <option>🍽️ Lunch</option>
                      <option>🍔 Dinner</option>
                      <option>🚻 Bio Break</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handlePunch(u)}
                      disabled={loading}
                      className={`px-4 py-2 rounded-lg ${
                        onBreak
                          ? "bg-red-500 hover:bg-red-600"
                          : "bg-green-500 hover:bg-green-600"
                      } text-white`}
                    >
                      {onBreak ? "Punch Out" : "Punch In"}
                    </button>
                  </td>
                  {isAdmin && (
                    <td className="p-3">
                      <button
                        onClick={() => removeUser(u.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ❌
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
};

export default App;
