import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk"; // Only public anon key
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [admin, setAdmin] = useState(false);
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(0);
  const [punchStatus, setPunchStatus] = useState("Out");
  const [intervalId, setIntervalId] = useState(null);

  // Fetch users
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("teams").select("*");
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  // Punch In/Out logic
  const handlePunch = () => {
    if (punchStatus === "Out") {
      setPunchStatus("In");
      setTimer(0);
      const id = setInterval(() => setTimer((t) => t + 1), 1000);
      setIntervalId(id);
    } else {
      setPunchStatus("Out");
      if (intervalId) clearInterval(intervalId);
    }
  };

  // Add user
  const handleAddUser = async () => {
    if (!newUser.trim()) return;
    try {
      const { error } = await supabase.from("teams").insert([{ name: newUser }]);
      if (error) throw error;
      setNewUser("");
      fetchUsers();
    } catch (err) {
      console.error("Error adding user:", err);
    }
  };

  // Export CSV
  const handleExport = () => {
    const csv = [
      ["Name", "Status", "Time"],
      ...users.map((u) => [u.name, u.status || "-", u.time || "-"]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "team_export.csv";
    a.click();
  };

  // Admin login (static credentials)
  const handleAdminLogin = () => {
    const email = document.getElementById("adminEmail").value;
    const password = document.getElementById("adminPassword").value;
    if (email === "admin@supabase.com" && password === "secure123") {
      setAdmin(true);
      fetchUsers();
    } else {
      alert("Invalid credentials");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  if (loading) return <p className="text-center mt-10 text-gray-600">Loading...</p>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Team Work Tracker</h1>

      {!admin ? (
        <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Admin Login</h2>
          <input
            id="adminEmail"
            placeholder="Email"
            defaultValue="admin@supabase.com"
            className="w-full border rounded p-2 mb-2"
          />
          <input
            id="adminPassword"
            type="password"
            placeholder="Password"
            defaultValue="secure123"
            className="w-full border rounded p-2 mb-3"
          />
          <button
            onClick={handleAdminLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded p-2"
          >
            Login
          </button>
        </div>
      ) : (
        <div className="w-full max-w-3xl space-y-6">
          {/* Punch Section */}
          <div className="flex justify-between items-center bg-white shadow rounded-lg p-4">
            <button
              onClick={handlePunch}
              className={`px-4 py-2 rounded text-white font-semibold ${
                punchStatus === "Out" ? "bg-green-600" : "bg-red-600"
              }`}
            >
              {punchStatus === "Out" ? "Punch In" : "Punch Out"}
            </button>
            <span
              className={`font-semibold ${
                punchStatus === "In" ? "text-green-600" : "text-red-600"
              }`}
            >
              Status: {punchStatus}
            </span>
            <span className="font-mono">
              Timer: {Math.floor(timer / 60)}m {timer % 60}s
            </span>
          </div>

          {/* Add User / Export */}
          <div className="flex gap-3 bg-white shadow p-4 rounded-lg">
            <input
              placeholder="Enter new user name"
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
              className="flex-1 border rounded p-2"
            />
            <button
              onClick={handleAddUser}
              className="bg-green-600 hover:bg-green-700 text-white rounded px-4"
            >
              Add
            </button>
            <button
              onClick={handleExport}
              className="bg-gray-600 hover:bg-gray-700 text-white rounded px-4"
            >
              Export CSV
            </button>
          </div>

          {/* Users list */}
          <div className="grid gap-3">
            {users.map((u) => (
              <div
                key={u.id}
                className={`bg-white shadow rounded-lg p-3 ${
                  (u.time || 0) > 3600 ? "border-l-4 border-yellow-400" : ""
                }`}
              >
                <p className="font-semibold text-gray-800">{u.name}</p>
                <p className="text-gray-600 text-sm">
                  Status: {u.status || "Idle"}
                </p>
                <p className="text-gray-600 text-sm">
                  Time:{" "}
                  {u.time
                    ? `${Math.floor(u.time / 60)}m ${u.time % 60}s`
                    : "N/A"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
