import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Setup ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiOiJ1bGdhZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";
const supabase = createClient(supabaseUrl, anonKey);

// ---- Main Component ----
export default function App() {
  const [view, setView] = useState("user"); // "user" or "admin"
  const [userName, setUserName] = useState("");
  const [users, setUsers] = useState([]);
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [punchInTime, setPunchInTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [exportType, setExportType] = useState("daily");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // ---- Live Clock ----
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ---- Fetch Users ----
  const fetchUsers = async () => {
    const { data, error } = await supabase.from("users").select("*");
    if (!error) setUsers(data);
  };

  // ---- Fetch Attendance ----
  const fetchAttendance = async () => {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setAttendance(data);
  };

  useEffect(() => {
    if (view === "admin" && isAdminLoggedIn) {
      fetchUsers();
      fetchAttendance();
    }
  }, [view, isAdminLoggedIn]);

  // ---- User Punch In/Out ----
  const handlePunchIn = async () => {
    if (!userName) return alert("Enter your name first!");
    const { error } = await supabase
      .from("attendance")
      .insert([{ name: userName, punch_in: new Date().toISOString() }]);
    if (!error) {
      alert("Punched In!");
      setPunchInTime(new Date());
      fetchAttendance();
    }
  };

  const handlePunchOut = async () => {
    if (!userName) return alert("Enter your name first!");
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("name", userName)
      .is("punch_out", null)
      .limit(1)
      .maybeSingle();

    if (error || !data) return alert("No active session found.");

    const { error: updateErr } = await supabase
      .from("attendance")
      .update({ punch_out: new Date().toISOString() })
      .eq("id", data.id);

    if (!updateErr) {
      alert("Punched Out!");
      setPunchInTime(null);
      fetchAttendance();
    }
  };

  // ---- Admin Actions ----
  const handleAdminLogin = () => {
    if (adminPassword === "admin123") {
      setIsAdminLoggedIn(true);
      fetchUsers();
      fetchAttendance();
    } else {
      alert("Incorrect password!");
    }
  };

  const handleAddUser = async () => {
    const name = prompt("Enter new user's name:");
    if (!name) return;
    const { error } = await supabase.from("users").insert([{ name }]);
    if (!error) {
      alert("User added!");
      fetchUsers();
    } else {
      alert("Error adding user");
    }
  };

  const handleRemoveUser = async (id) => {
    if (!window.confirm("Remove this user?")) return;
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (!error) {
      alert("User removed");
      fetchUsers();
    }
  };

  // ---- Export Attendance ----
  const handleExport = () => {
    let filtered = [...attendance];
    const now = new Date();

    if (exportType === "daily") {
      filtered = filtered.filter(
        (a) => new Date(a.created_at).toDateString() === now.toDateString()
      );
    } else if (exportType === "weekly") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      filtered = filtered.filter(
        (a) => new Date(a.created_at) >= weekAgo && new Date(a.created_at) <= now
      );
    } else if (exportType === "monthly") {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      filtered = filtered.filter(
        (a) => new Date(a.created_at) >= monthAgo && new Date(a.created_at) <= now
      );
    } else if (exportType === "custom") {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      filtered = filtered.filter(
        (a) => new Date(a.created_at) >= start && new Date(a.created_at) <= end
      );
    }

    const csv = filtered
      .map(
        (a) =>
          `${a.name},${a.punch_in || ""},${a.punch_out || ""},${a.created_at}`
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${exportType}.csv`;
    a.click();
  };

  // ---- Render ----
  if (view === "admin" && isAdminLoggedIn) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>
        <button
          onClick={() => setView("user")}
          className="bg-gray-300 px-3 py-1 rounded mb-3"
        >
          Go to User Dashboard
        </button>
        <div className="mb-4 flex justify-between">
          <button onClick={handleAddUser} className="bg-green-500 text-white px-3 py-1 rounded">
            Add User
          </button>
          <div>
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              className="border px-2 py-1 rounded"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </select>
            {exportType === "custom" && (
              <>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="ml-2 border px-2 py-1 rounded"
                />
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="ml-2 border px-2 py-1 rounded"
                />
              </>
            )}
            <button
              onClick={handleExport}
              className="ml-2 bg-blue-500 text-white px-3 py-1 rounded"
            >
              Export CSV
            </button>
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-2">Users</h2>
        <ul>
          {users.map((u) => (
            <li key={u.id} className="flex justify-between border-b py-1">
              {u.name}
              <button
                onClick={() => handleRemoveUser(u.id)}
                className="text-red-500"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (view === "admin" && !isAdminLoggedIn) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-4">Admin Login</h1>
        <input
          type="password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          placeholder="Enter admin password"
          className="border px-3 py-2 rounded w-full mb-2"
        />
        <button
          onClick={handleAdminLogin}
          className="bg-blue-500 text-white w-full py-2 rounded"
        >
          Login
        </button>
      </div>
    );
  }

  // ---- User Dashboard ----
  return (
    <div className="p-6 max-w-md mx-auto text-center">
      <h1 className="text-2xl font-bold mb-3">User Dashboard</h1>
      <div className="text-sm text-gray-600 mb-3">
        {currentTime.toLocaleTimeString()}
      </div>

      <input
        type="text"
        placeholder="Enter your name"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        className="border px-3 py-2 rounded w-full mb-3"
      />

      <button
        onClick={handlePunchIn}
        className="bg-green-500 text-white w-full py-2 rounded mb-2"
      >
        Punch In
      </button>
      <button
        onClick={handlePunchOut}
        className="bg-red-500 text-white w-full py-2 rounded"
      >
        Punch Out
      </button>

      <button
        onClick={() => setView("admin")}
        className="mt-4 underline text-blue-600 text-sm"
      >
        Admin Login
      </button>
    </div>
  );
}
