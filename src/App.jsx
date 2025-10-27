import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css"; // optional for extra styles

// ---- Supabase Client ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";
const supabase = createClient(supabaseUrl, anonKey);

// ---- Utility: convert seconds to HH:MM:SS ----
function secondsToHHMMSS(totalSeconds) {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

// ---- Break types with emojis ----
const BREAK_TYPES = [
  { label: "Tea ☕", value: "tea" },
  { label: "Lunch 🍴", value: "lunch" },
  { label: "Dinner 🍽️", value: "dinner" },
  { label: "Bio Break 🚻", value: "bio" },
];

export default function App() {
  const [users, setUsers] = useState([]);
  const [adminLogged, setAdminLogged] = useState(false);
  const [adminLogin, setAdminLogin] = useState({ username: "", password: "" });
  const [currentUser, setCurrentUser] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [inBreak, setInBreak] = useState(false);
  const [selectedBreak, setSelectedBreak] = useState(BREAK_TYPES[0].value);
  const [currentBreakSeconds, setCurrentBreakSeconds] = useState(0);
  const [dailyBreakSeconds, setDailyBreakSeconds] = useState(0);

  // Fetch all users
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("teams").select("*");
      if (error) console.log("Error fetching users:", error);
      else setUsers(data || []);
    } catch (err) {
      console.log("Supabase fetch error:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Timer for current break
  useEffect(() => {
    let timer;
    if (inBreak) {
      timer = setInterval(() => {
        setCurrentBreakSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setCurrentBreakSeconds(0);
    }
    return () => clearInterval(timer);
  }, [inBreak]);

  // ---- Punch In / Out function ----
  const handlePunch = async () => {
    if (!currentUser) return alert("Select a logged-in user first!");
    try {
      let updatedUser = { ...currentUser };
      if (!inBreak) {
        // Start break
        updatedUser.in_break = true;
        updatedUser.break_type = selectedBreak;
      } else {
        // End break, add current break to daily
        updatedUser.in_break = false;
        updatedUser.daily_break_seconds = (updatedUser.daily_break_seconds || 0) + currentBreakSeconds;
        updatedUser.break_type = null;
      }
      setInBreak(updatedUser.in_break);
      setDailyBreakSeconds(updatedUser.daily_break_seconds || 0);
      setCurrentUser(updatedUser);

      const { error } = await supabase
        .from("teams")
        .update({
          in_break: updatedUser.in_break,
          break_type: updatedUser.break_type,
          daily_break_seconds: updatedUser.daily_break_seconds,
        })
        .eq("id", updatedUser.id);
      if (error) console.log("Error punching in/out:", error);
    } catch (err) {
      console.log("Punch error:", err);
    }
  };

  // ---- Admin login ----
  const handleAdminLogin = () => {
    if (adminLogin.username === "admin" && adminLogin.password === "1234") {
      setAdminLogged(true);
      alert("Admin logged in!");
    } else {
      alert("Wrong credentials!");
    }
  };

  // ---- Add user ----
  const handleAddUser = async () => {
    const name = prompt("Enter user name:");
    if (!name) return;
    try {
      const { data, error } = await supabase
        .from("teams")
        .insert([{ name, daily_break_seconds: 0, in_break: false }]);
      if (error) console.log("Error adding user:", error);
      else fetchUsers();
    } catch (err) {
      console.log("Add user error:", err);
    }
  };

  // ---- Remove user ----
  const handleRemoveUser = async (id) => {
    if (!confirm("Are you sure to remove this user?")) return;
    try {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) console.log("Error removing user:", error);
      else fetchUsers();
    } catch (err) {
      console.log("Remove user error:", err);
    }
  };

  return (
    <div className="p-6 font-sans bg-gray-50 min-h-screen">
      {/* Admin login button */}
      {!adminLogged && (
        <div className="mb-4 flex items-center gap-2">
          <input
            className="border px-2 py-1 rounded"
            placeholder="Admin username"
            value={adminLogin.username}
            onChange={(e) => setAdminLogin({ ...adminLogin, username: e.target.value })}
          />
          <input
            type="password"
            className="border px-2 py-1 rounded"
            placeholder="Admin password"
            value={adminLogin.password}
            onChange={(e) => setAdminLogin({ ...adminLogin, password: e.target.value })}
          />
          <button onClick={handleAdminLogin} className="bg-blue-500 text-white px-3 py-1 rounded">
            Admin Login
          </button>
        </div>
      )}

      {/* User selection */}
      <div className="mb-4 flex items-center gap-2">
        <select
          className="border px-2 py-1 rounded"
          value={currentUser?.id || ""}
          onChange={(e) => {
            const user = users.find((u) => u.id === e.target.value);
            setCurrentUser(user);
            setInBreak(user?.in_break || false);
            setDailyBreakSeconds(user?.daily_break_seconds || 0);
          }}
        >
          <option value="">Select user</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <button
          className={`px-3 py-1 rounded ${
            loggedIn ? "bg-red-500 text-white" : "bg-green-500 text-white"
          }`}
          onClick={() => setLoggedIn(!loggedIn)}
        >
          {loggedIn ? "Logout" : "Login"}
        </button>
      </div>

      {currentUser && loggedIn && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <select
              className="border px-2 py-1 rounded"
              disabled={inBreak}
              value={selectedBreak}
              onChange={(e) => setSelectedBreak(e.target.value)}
            >
              {BREAK_TYPES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            <button
              className="bg-blue-500 text-white px-3 py-1 rounded"
              onClick={handlePunch}
            >
              {inBreak ? "Punch Out" : "Punch In"}
            </button>
          </div>
          <p>
            Status:{" "}
            {inBreak
              ? `In Break (${BREAK_TYPES.find((b) => b.value === selectedBreak)?.label})`
              : "Available"}
          </p>
          <p>Current Break Duration: {secondsToHHMMSS(currentBreakSeconds)}</p>
          <p>Today's Total Break: {secondsToHHMMSS(dailyBreakSeconds)}</p>
        </div>
      )}

      {/* Users table */}
      <div className="overflow-x-auto rounded shadow bg-white">
        <table className="w-full text-center border-collapse">
          <thead className="bg-gray-200 sticky top-0">
            <tr>
              <th className="py-2 border">Name</th>
              <th className="py-2 border">Status</th>
              <th className="py-2 border">Current Break</th>
              <th className="py-2 border">Daily Break</th>
              {adminLogged && <th className="py-2 border">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u, idx) => (
              <tr
                key={u.id}
                className={`${idx % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
              >
                <td className="py-2 border">{u.name}</td>
                <td className="py-2 border">
                  {u.in_break ? "In Break" : u.loggedIn ? "Available" : "Logged Out"}
                </td>
                <td className="py-2 border">{u.in_break ? secondsToHHMMSS(currentBreakSeconds) : ""}</td>
                <td className="py-2 border">{secondsToHHMMSS(u.daily_break_seconds || 0)}</td>
                {adminLogged && (
                  <td className="py-2 border">
                    <button
                      className="bg-red-500 text-white px-2 py-1 rounded"
                      onClick={() => handleRemoveUser(u.id)}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Admin export buttons */}
      {adminLogged && (
        <div className="mt-4 flex gap-2">
          <button
            className="bg-green-500 text-white px-3 py-1 rounded"
            onClick={() => alert("Daily export (mock)")}
          >
            Export Daily
          </button>
          <button
            className="bg-blue-500 text-white px-3 py-1 rounded"
            onClick={() => alert("Weekly export (mock)")}
          >
            Export Weekly
          </button>
          <button
            className="bg-purple-500 text-white px-3 py-1 rounded"
            onClick={() => alert("Monthly export (mock)")}
          >
            Export Monthly
          </button>
        </div>
      )}
    </div>
  );
}
