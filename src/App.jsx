import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Setup ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk"; // 🔹 Replace with your real key
const supabase = createClient(supabaseUrl, anonKey);

const BREAK_TYPES = [
  { label: "☕ Tea Break", value: "tea" },
  { label: "🍴 Lunch Break", value: "lunch" },
  { label: "🍽️ Dinner Break", value: "dinner" },
  { label: "🚻 Bio Break", value: "bio" },
];

export default function App() {
  const [teams, setTeams] = useState([]);
  const [adminLogged, setAdminLogged] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [selectedBreaks, setSelectedBreaks] = useState({});

  // ✅ Utility: Convert seconds → HH:MM:SS
  const formatTime = (sec) => {
    if (!sec || sec < 0) sec = 0;
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

  // ✅ Fetch all users safely
  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase.from("teams").select("*");
      if (error) {
        if (error.code === "PGRST404") console.warn("Table not found yet.");
        else console.error("Fetch error:", error);
        return;
      }

      // Reset daily breaks automatically if the date changed
      const today = new Date().toISOString().slice(0, 10);
      const updatedData = await Promise.all(
        data.map(async (user) => {
          if (user.last_break_date && !user.last_break_date.startsWith(today)) {
            const resetFields = {
              daily_break_seconds: 0,
              last_break_date: new Date().toISOString(),
            };
            await supabase.from("teams").update(resetFields).eq("id", user.id);
            return { ...user, ...resetFields };
          }
          return user;
        })
      );

      setTeams(updatedData);
    } catch (err) {
      console.error("Unexpected fetch error:", err);
    }
  };

  useEffect(() => {
    fetchTeams();
    const interval = setInterval(fetchTeams, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  // ✅ Punch In/Out logic (safe updates)
  const punch = async (user) => {
    const breakType = selectedBreaks[user.id];
    if (!breakType) return alert("Please select a break type first!");

    const now = new Date().toISOString();

    const updatedFields = {};
    if ("last_punch" in user) updatedFields.last_punch = now;
    if ("break_type" in user) updatedFields.break_type = breakType;
    if ("daily_break_seconds" in user)
      updatedFields.daily_break_seconds = (user.daily_break_seconds || 0) + 300; // +5 mins example
    if ("last_break_date" in user) updatedFields.last_break_date = now;

    try {
      const { error } = await supabase
        .from("teams")
        .update(updatedFields)
        .eq("id", user.id);

      if (error) {
        if (error.code === "PGRST404")
          console.warn("Endpoint not found, skipping update.");
        else console.error("Error punching:", error);
      } else fetchTeams();
    } catch (err) {
      console.error("Unexpected punch error:", err);
    }
  };

  // ✅ Add User
  const addUser = async () => {
    if (!newUserName.trim()) return alert("Please enter a name.");
    try {
      const { data, error } = await supabase
        .from("teams")
        .insert([{ name: newUserName }]);
      if (error) console.error("Add user error:", error);
      else {
        setTeams((prev) => [...prev, ...(data || [])]);
        setNewUserName("");
      }
    } catch (err) {
      console.error("Unexpected add user error:", err);
    }
  };

  // ✅ Remove User
  const removeUser = async (id) => {
    if (!window.confirm("Remove this user?")) return;
    try {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) console.error("Remove error:", error);
      else setTeams((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error("Unexpected remove error:", err);
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "'Google Sans', Arial, sans-serif",
        background: "#fafafa",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ textAlign: "center", marginBottom: "20px" }}>
        🕒 Team Break Dashboard
      </h1>

      {/* Admin Login Toggle */}
      <div style={{ textAlign: "center", marginBottom: "15px" }}>
        <button
          onClick={() => setAdminLogged((prev) => !prev)}
          style={{
            background: adminLogged ? "#ef5350" : "#4285f4",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "8px 16px",
            cursor: "pointer",
          }}
        >
          {adminLogged ? "Logout Admin" : "Login Admin"}
        </button>
      </div>

      {/* Admin Panel */}
      {adminLogged && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "20px",
            gap: "10px",
          }}
        >
          <input
            placeholder="New User Name"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />
          <button
            onClick={addUser}
            style={{
              background: "#34a853",
              color: "#fff",
              border: "none",
              padding: "8px 14px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            ➕ Add User
          </button>
        </div>
      )}

      {/* Table Section */}
      <div
        style={{
          overflowX: "auto",
          borderRadius: "12px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          background: "#fff",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "700px",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "#f5f5f5",
                textAlign: "left",
                borderBottom: "2px solid #ddd",
              }}
            >
              <th style={{ padding: "12px" }}>👤 Name</th>
              <th>🕓 Last Punch</th>
              <th>🧭 Break Type</th>
              <th>⏳ Daily Break</th>
              {adminLogged && <th>⚙️ Actions</th>}
              <th>🚀 Punch</th>
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
                    fontWeight: isLongBreak ? "600" : "normal",
                  }}
                >
                  <td style={{ padding: "10px" }}>{user.name}</td>
                  <td>{user.last_punch ? user.last_punch.slice(11, 19) : "-"}</td>
                  <td>{user.break_type ? user.break_type : "-"}</td>
                  <td>{formatTime(user.daily_break_seconds || 0)}</td>

                  {adminLogged && (
                    <td>
                      <button
                        onClick={() => removeUser(user.id)}
                        style={{
                          background: "#ef5350",
                          color: "#fff",
                          border: "none",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        ❌ Remove
                      </button>
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
                      style={{
                        padding: "6px",
                        borderRadius: "6px",
                        marginRight: "6px",
                      }}
                    >
                      <option value="">Select</option>
                      {BREAK_TYPES.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => punch(user)}
                      style={{
                        background: "#4285f4",
                        color: "#fff",
                        border: "none",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
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
