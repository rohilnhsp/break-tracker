import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Client ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";
const supabase = createClient(supabaseUrl, anonKey);

const BREAK_TYPES = [
  { label: "Tea ☕", value: "tea" },
  { label: "Lunch 🍴", value: "lunch" },
  { label: "Dinner 🍽️", value: "dinner" },
  { label: "Bio 🛁", value: "bio" },
];

export default function App() {
  const [teams, setTeams] = useState([]);
  const [adminLogged, setAdminLogged] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({
    username: "",
    password: "",
  });
  const [newUserName, setNewUserName] = useState("");
  const [selectedBreaks, setSelectedBreaks] = useState({});

  // Format seconds to HH:MM:SS
  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((sec % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // Fetch users safely
  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase.from("teams").select("*");
      if (error && error.code !== "PGRST404") console.error(error);
      else setTeams(data || []);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => {
    fetchTeams();
    const interval = setInterval(fetchTeams, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  // Punch In/Out
  const punch = async (user) => {
    const breakType = selectedBreaks[user.id] || null;
    const now = new Date().toISOString();

    const updated = {};
    if ("last_punch" in user) updated.last_punch = now;
    if ("break_type" in user) updated.break_type = breakType;
    if ("daily_break_seconds" in user)
      updated.daily_break_seconds = (user.daily_break_seconds || 0) + 300; // example +5min
    if ("last_break_date" in user) updated.last_break_date = now;

    try {
      const { error } = await supabase
        .from("teams")
        .update(updated)
        .eq("id", user.id);
      if (error) console.error("Error punching in/out:", error);
      else fetchTeams();
    } catch (err) {
      console.error("Unexpected punch error:", err);
    }
  };

  // Admin login
  const handleAdminLogin = () => {
    if (
      adminCredentials.username === "admin" &&
      adminCredentials.password === "password"
    )
      setAdminLogged(true);
    else alert("Invalid credentials");
  };

  // Add user
  const addUser = async () => {
    if (!newUserName) return;
    try {
      const { data, error } = await supabase
        .from("teams")
        .insert([{ name: newUserName }]);
      if (error) console.error("Error adding user:", error);
      else {
        setTeams((prev) => [...prev, ...(data || [])]);
        setNewUserName("");
      }
    } catch (err) {
      console.error("Unexpected add user error:", err);
    }
  };

  // Remove user
  const removeUser = async (id) => {
    try {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) console.error("Error removing user:", error);
      else setTeams((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error("Unexpected remove user error:", err);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>🕒 Break Tracker Dashboard</h1>

      {/* Admin toggle */}
      <button
        onClick={() => setAdminLogged((prev) => !prev)}
        style={{ marginBottom: "10px" }}
      >
        {adminLogged ? "Logout Admin" : "Login Admin"}
      </button>

      {adminLogged && (
        <div style={{ marginBottom: "20px" }}>
          <input
            placeholder="New user name"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
          />
          <button onClick={addUser}>➕ Add User</button>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "650px",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "#f2f2f2",
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}
            >
              <th style={{ padding: "10px" }}>Name</th>
              <th>Last Punch</th>
              <th>Break Type</th>
              <th>Daily Break</th>
              {adminLogged && <th>Actions</th>}
              <th>Punch</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((user, idx) => {
              const isLongBreak = (user.daily_break_seconds || 0) >= 3600;
              return (
                <tr
                  key={user.id}
                  style={{
                    backgroundColor: idx % 2 === 0 ? "#fff" : "#f9f9f9",
                    fontWeight: isLongBreak ? "bold" : "normal",
                  }}
                >
                  <td style={{ padding: "8px" }}>{user.name}</td>
                  <td>{user.last_punch || "-"}</td>
                  <td>{user.break_type || "-"}</td>
                  <td>{formatTime(user.daily_break_seconds || 0)}</td>
                  {adminLogged && (
                    <td>
                      <button onClick={() => removeUser(user.id)}>❌ Remove</button>
                    </td>
                  )}
                  <td>
                    <select
                      value={selectedBreaks[user.id] || ""}
                      onChange={(e) =>
                        setSelectedBreaks({
                          ...selectedBreaks,
                          [user.id]: e.target.value,
                        })
                      }
                    >
                      <option value="" disabled>
                        Select Break
                      </option>
                      {BREAK_TYPES.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                    <button
                      style={{ marginLeft: "5px" }}
                      onClick={() => punch(user)}
                    >
                      ⏱ Punch
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
