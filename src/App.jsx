import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Client ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey = "YOUR_ANON_KEY"; // replace
const supabase = createClient(supabaseUrl, anonKey);

const breakOptions = [
  { label: "☕ Tea Break", value: "tea" },
  { label: "🍽️ Lunch Break", value: "lunch" },
  { label: "🍴 Dinner Break", value: "dinner" },
  { label: "🚻 Bio Break", value: "bio" },
];

function App() {
  const [teams, setTeams] = useState([]);
  const [adminLogged, setAdminLogged] = useState(false);
  const [adminLogin, setAdminLogin] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, []);

  // Fetch teams/users with 404 safety
  const fetchTeams = async () => {
    try {
      const { data, error, status } = await supabase.from("teams").select("*");
      if (error && status === 404) {
        console.warn("Teams table not found. Returning empty array.");
        setTeams([]);
        setLoading(false);
        return;
      } else if (error) {
        console.error("Error fetching teams:", error);
        setLoading(false);
        return;
      }
      setTeams(data || []);
      setLoading(false);
    } catch (err) {
      console.error("Unexpected fetch error:", err);
      setTeams([]);
      setLoading(false);
    }
  };

  // Punch In/Out with daily break logic
  const handlePunch = async (teamId, action, breakType = null) => {
    try {
      const team = teams.find((t) => t.id === teamId);
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      // Reset daily break if date changed
      let dailyBreak = team.daily_break_seconds || 0;
      if (team.last_break_date !== today) dailyBreak = 0;

      const updateData = {};
      if (action === "in") updateData.punch_in = new Date().toISOString();
      else if (action === "out") {
        updateData.punch_out = new Date().toISOString();
        updateData.break_type = breakType;
        const lastPunch = new Date(team.punch_in || new Date());
        const durationSec = Math.floor(
          (new Date().getTime() - lastPunch.getTime()) / 1000
        );
        updateData.daily_break_seconds = dailyBreak + durationSec;
        updateData.last_break_date = today;
      }

      const { data, error, status } = await supabase
        .from("teams")
        .update(updateData)
        .eq("id", teamId);

      if (error && status === 404) {
        console.warn("Teams table not found. Punch ignored.");
        return;
      } else if (error) {
        console.error("Error punching in/out:", error);
        return;
      }

      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, ...updateData } : t))
      );
    } catch (err) {
      console.error("Unexpected error punching in/out:", err);
    }
  };

  // Add User
  const addUser = async (user) => {
    try {
      const { data, error, status } = await supabase.from("teams").insert([user]);
      if (error && status === 404) {
        console.warn("Teams table not found. Cannot add user.");
        return;
      } else if (error) {
        console.error("Error adding user:", error);
        return;
      }
      setTeams((prev) => [...prev, ...data]);
    } catch (err) {
      console.error("Unexpected error adding user:", err);
    }
  };

  // Remove User
  const removeUser = async (teamId) => {
    try {
      const { data, error, status } = await supabase.from("teams").delete().eq("id", teamId);
      if (error && status === 404) {
        console.warn("Teams table not found. Cannot remove user.");
        return;
      } else if (error) {
        console.error("Error removing user:", error);
        return;
      }
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
    } catch (err) {
      console.error("Unexpected error removing user:", err);
    }
  };

  // Admin login handler (generic)
  const handleAdminLogin = () => {
    if (adminLogin.username === "admin" && adminLogin.password === "admin") {
      setAdminLogged(true);
    } else {
      alert("Wrong credentials!");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>Team Break Tracker</h1>

      {!adminLogged && (
        <button
          style={{ position: "absolute", top: 20, right: 20 }}
          onClick={() => {
            const username = prompt("Admin Username");
            const password = prompt("Admin Password");
            setAdminLogin({ username, password });
            handleAdminLogin();
          }}
        >
          🔑 Admin Login
        </button>
      )}

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: "40px",
          tableLayout: "fixed",
        }}
      >
        <thead style={{ position: "sticky", top: 0, background: "#f0f0f0" }}>
          <tr>
            <th>Name</th>
            <th>Punch In</th>
            <th>Punch Out</th>
            <th>Break Type</th>
            <th>Today's Break ⏳</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, idx) => (
            <tr
              key={team.id}
              style={{
                background: idx % 2 === 0 ? "#fff" : "#f9f9f9",
                textAlign: "center",
              }}
            >
              <td>{team.name}</td>
              <td>{team.punch_in ? new Date(team.punch_in).toLocaleTimeString() : "-"}</td>
              <td>{team.punch_out ? new Date(team.punch_out).toLocaleTimeString() : "-"}</td>
              <td>{team.break_type || "—"}</td>
              <td>{team.daily_break_seconds || 0} sec</td>
              <td>
                <button onClick={() => handlePunch(team.id, "in")}>⏱️ Punch In</button>
                <button
                  onClick={() => {
                    const type = prompt(
                      "Enter break type: tea, lunch, dinner, bio"
                    );
                    handlePunch(team.id, "out", type);
                  }}
                >
                  ⏹️ Punch Out
                </button>
                {adminLogged && (
                  <button onClick={() => removeUser(team.id)}>🗑️ Remove</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {adminLogged && (
        <div style={{ marginTop: "20px" }}>
          <button
            onClick={() => {
              const name = prompt("Enter user name");
              if (name) addUser({ name });
            }}
          >
            ➕ Add User
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
