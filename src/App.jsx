import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Setup ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---- User Dashboard ----
function UserDashboard() {
  const [punchStatus, setPunchStatus] = useState("Out");
  const [timer, setTimer] = useState(0);
  const [intervalId, setIntervalId] = useState(null);

  const handlePunch = () => {
    if (punchStatus === "Out") {
      setPunchStatus("In");
      const id = setInterval(() => setTimer((t) => t + 1), 1000);
      setIntervalId(id);
    } else {
      setPunchStatus("Out");
      if (intervalId) clearInterval(intervalId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">User Dashboard</h1>
        <p className="mb-4 text-gray-600">Welcome! Track your work hours below.</p>

        <button
          onClick={handlePunch}
          className={`px-6 py-2 rounded text-white font-semibold ${
            punchStatus === "Out" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {punchStatus === "Out" ? "Punch In" : "Punch Out"}
        </button>

        <div className="mt-4 text-lg font-mono">
          ⏱ Timer: {Math.floor(timer / 60)}m {timer % 60}s
        </div>

        <div className="mt-8">
          <Link
            to="/admin"
            className="text-blue-600 underline hover:text-blue-800 text-sm"
          >
            Admin Login
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---- Admin Login Page ----
function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = () => {
    if (email === "admin@supabase.com" && password === "secure123") {
      localStorage.setItem("isAdmin", "true");
      navigate("/admin/dashboard");
    } else {
      alert("Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 text-center">
          Admin Login
        </h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded p-2 mb-3"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded p-2 mb-4"
        />
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded p-2"
        >
          Login
        </button>
        <div className="mt-4 text-center">
          <Link to="/" className="text-blue-600 underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---- Admin Dashboard ----
function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = localStorage.getItem("isAdmin");
    if (!checkAdmin) navigate("/admin");
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase.from("teams").select("*");
    if (!error) setUsers(data || []);
  };

  const handleAddUser = async () => {
    if (!newUser.trim()) return;
    const { error } = await supabase.from("teams").insert([{ name: newUser }]);
    if (error) alert("Error adding user");
    else {
      setNewUser("");
      fetchUsers();
    }
  };

  const handleExport = () => {
    const csv = [
      ["Name", "Status", "Time"],
      ...users.map((u) => [u.name, u.status || "-", u.time || "-"]),
    ]
      .map((r) => r.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "team_export.csv";
    a.click();
  };

  const handleLogout = () => {
    localStorage.removeItem("isAdmin");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <div className="bg-white shadow-lg rounded-lg w-full max-w-3xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
          >
            Logout
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <input
            placeholder="Enter new user name"
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
            className="flex-1 border rounded p-2"
          />
          <button
            onClick={handleAddUser}
            className="bg-green-600 hover:bg-green-700 text-white px-4 rounded"
          >
            Add User
          </button>
          <button
            onClick={handleExport}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 rounded"
          >
            Export CSV
          </button>
        </div>

        <div className="grid gap-3">
          {users.map((u) => (
            <div
              key={u.id}
              className={`bg-white border rounded-lg p-3 shadow ${
                (u.time || 0) > 3600 ? "border-l-4 border-yellow-400" : ""
              }`}
            >
              <p className="font-semibold text-gray-800">{u.name}</p>
              <p className="text-sm text-gray-600">Status: {u.status || "Idle"}</p>
              <p className="text-sm text-gray-600">
                Time:{" "}
                {u.time ? `${Math.floor(u.time / 60)}m ${u.time % 60}s` : "N/A"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Root App ----
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UserDashboard />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}
