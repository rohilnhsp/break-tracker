import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Client ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";

const supabase = createClient(supabaseUrl, anonKey);

// Break Types
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
  const [exportRange, setExportRange] = useState("daily");

  // Fetch teams/users safely
  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase.from("teams").select("*");
      if (error && error.code !== "PGRST404") {
        console.error("Error fetching users:", error);
      } else {
        setTeams(data || []);
      }
    } catch (err) {
      console.error("Unexpected fetch error:", err);
    }
  };

  useEffect(() => {
    fetchTeams();
    const interval = setInterval(() => fetchTeams(), 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  // Punch In/Out
  const punch = async (user, breakType) => {
    try {
      const now = new Date().toISOString();
      const updated = {
        last_punch: now,
        break_type: breakType,
        daily_break_seconds: user.daily_break_seconds || 0,
        last_break_date: user.last_break_date || now,
      };

      const { error } = await supabase
        .from("teams")
        .update(updated)
        .eq("id", user.id);

      if (error) {
        console.error("Error punching in/out:", error);
      } else {
        fetchTeams();
      }
    } catch (err) {
      console.error("Unexpected punch error:", err);
    }
  };

  // Admin login
  const handleAdminLogin = () => {
    if (
      adminCredentials.username === "admin" &&
      adminCredentials.password === "password"
    ) {
      setAdminLogged(true);
    } else {
      alert("Invalid credentials");
    }
  };

  // Add user
  const addUser = async () => {
    if (!newUserName) return;
    try {
      const { data, error } = await supabase
        .from("teams")
        .insert([{ name: newUserName }]);
      if (error) {
        console.error("Error adding user:", error);
      } else {
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
      if (error) {
        console.error("Error removing user:", error);
      } else {
        setTeams((prev) => prev.filter((u) => u.id !== id));
      }
    } catch (err) {
      console.error("Unexpected remove user error:", err);
    }
  };

  // Export CSV
  const exportCSV = (range = "daily") => {
    const headers = ["Name", "Last Punch", "Break Type", "Daily Break (s)"];
    const rows = teams.map((u) => [
      u.name,
      u.last_punch,
      u.break_type || "-",
      u.daily_break_seconds || 0,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `breaks_${range}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>🕒 Break Tracker Dashboard</h1>

      {/* Admin Toggle */}
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
      <div
        style={{
          overflowX: "auto",
          maxWidth: "100%",
          border: "1px solid #ddd",
          borderRadius: "5px",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "600px",
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
              <th>Daily Break (s)</th>
              {adminLogged && <th>Actions</th>}
              <th>Punch</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((user, idx) => {
              const isLongBreak = (user.daily_break_seconds || 0) >= 3600; // 1h
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
                  <td>{user.daily_break_seconds || 0}</td>
                  {adminLogged && (
                    <td>
                      <button onClick={() => removeUser(user.id)}>❌ Remove</button>
                    </td>
                  )}
                  <td>
                    <select
                      onChange={(e) => punch(user, e.target.value)}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        ⏱ Punch In/Out
                      </option>
                      {BREAK_TYPES.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Export */}
      {adminLogged && (
        <div style={{ marginTop: "20px" }}>
          <button onClick={() => exportCSV("daily")}>Export Daily</button>
          <button onClick={() => exportCSV("weekly")}>Export Weekly</button>
          <button onClick={() => exportCSV("monthly")}>Export Monthly</button>
        </div>
      )}
    </div>
  );
}
