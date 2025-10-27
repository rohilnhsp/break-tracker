import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";
const supabase = createClient(supabaseUrl, supabaseKey);

const App = () => {
  const [users, setUsers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [breakType, setBreakType] = useState("Tea Break");
  const [loading, setLoading] = useState(false);

  // ✅ Fetch users (gracefully handles 404/400)
  const fetchUsers = async () => {
    try {
      const { data, error, status } = await supabase.from("teams").select("*");
      if (error && status !== 406) throw error;
      setUsers(data || []);
    } catch (error) {
      console.warn("Fetch error:", error.message);
      setUsers([]);
    }
  };

  // ✅ Punch In/Out toggle
  const handlePunch = async (user) => {
    try {
      setLoading(true);
      const active = !user.end_time; // if end_time missing = on break
      if (active) {
        // Punch out
        const { error } = await supabase
          .from("teams")
          .update({
            end_time: new Date().toISOString(),
            break_type: breakType,
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
            break_type: breakType,
          })
          .eq("id", user.id);
        if (error) throw error;
      }
      fetchUsers();
    } catch (error) {
      console.error("Error punching in/out:", error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Add User (Admin only)
  const addUser = async () => {
    const name = prompt("Enter user name:");
    if (!name) return;
    try {
      const { error } = await supabase.from("teams").insert([{ name }]);
      if (error) throw error;
      fetchUsers();
    } catch (error) {
      console.error("Error adding user:", error.message);
    }
  };

  // ✅ Remove User (Admin only)
  const removeUser = async (id) => {
    if (!window.confirm("Remove this user?")) return;
    try {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
      fetchUsers();
    } catch (error) {
      console.error("Error removing user:", error.message);
    }
  };

  // ✅ Export CSV (Admin)
  const exportCSV = () => {
    const csvRows = [
      ["Name", "Break Type", "Start Time", "End Time", "Duration"],
      ...users.map((u) => [
        u.name,
        u.break_type || "-",
        u.start_time ? new Date(u.start_time).toLocaleTimeString() : "-",
        u.end_time ? new Date(u.end_time).toLocaleTimeString() : "-",
        getDuration(u.start_time, u.end_time),
      ]),
    ];
    const blob = new Blob([csvRows.map((r) => r.join(",")).join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "break_data.csv";
    a.click();
  };

  // ✅ Calculate duration (HH:MM:SS)
  const getDuration = (start, end) => {
    if (!start) return "-";
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const diff = Math.floor((endTime - startTime) / 1000);
    const hrs = String(Math.floor(diff / 3600)).padStart(2, "0");
    const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
    const secs = String(diff % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  // ✅ Admin login
  const handleAdminLogin = () => {
    const pass = prompt("Enter admin password:");
    if (pass === "admin123") setIsAdmin(true);
    else alert("Incorrect password!");
  };

  // Live refresh
  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 5000);
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
              <th className="p-3">Name</th>
              <th className="p-3">Break Type</th>
              <th className="p-3">Start</th>
              <th className="p-3">End</th>
              <th className="p-3">Duration</th>
              <th className="p-3">Action</th>
              {isAdmin && <th className="p-3">Remove</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const onBreak = u.start_time && !u.end_time;
              return (
                <tr
                  key={u.id}
                  className={`border-t ${
                    onBreak ? "bg-yellow-100" : "bg-white"
                  }`}
                >
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3">
                    <select
                      value={u.break_type || breakType}
                      onChange={(e) => setBreakType(e.target.value)}
                      className="border rounded-md p-1"
                    >
                      <option>☕ Tea Break</option>
                      <option>🍽️ Lunch</option>
                      <option>🍔 Dinner</option>
                      <option>🚻 Bio Break</option>
                    </select>
                  </td>
                  <td className="p-3">
                    {u.start_time
                      ? new Date(u.start_time).toLocaleTimeString()
                      : "-"}
                  </td>
                  <td className="p-3">
                    {u.end_time
                      ? new Date(u.end_time).toLocaleTimeString()
                      : "-"}
                  </td>
                  <td className="p-3 font-mono">
                    {getDuration(u.start_time, u.end_time)}
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
