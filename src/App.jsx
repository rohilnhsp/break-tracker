import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Clients ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk"; // replace
const supabase = createClient(supabaseUrl, anonKey);

function formatHHMMSS(seconds) {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function App() {
  const [teams, setTeams] = useState([]);
  const [adminLogged, setAdminLogged] = useState(false);
  const [adminLogin, setAdminLogin] = useState({ username: "", password: "" });
  const intervalRef = useRef(null);

  // Fetch teams safely
  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select(
          "id, name, break_start, break_end, daily_break_seconds"
        );
      if (error) console.error("Error fetching teams:", error);
      else {
        // Ensure all fields exist
        const safeData = data.map((team) => ({
          ...team,
          break_start: team.break_start || null,
          break_end: team.break_end || null,
          daily_break_seconds: team.daily_break_seconds || 0,
        }));
        setTeams(safeData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTeams();

    // Live timers update every second
    intervalRef.current = setInterval(() => {
      setTeams((prev) =>
        prev.map((team) => {
          if (team.break_start && !team.break_end) {
            const currentBreakSec =
              Math.floor((new Date() - new Date(team.break_start)) / 1000) || 0;
            return { ...team, currentBreakSeconds: currentBreakSec };
          }
          return { ...team, currentBreakSeconds: 0 };
        })
      );
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, []);

  const handlePunch = async (teamId) => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;

    try {
      let updates = {};
      if (!team.break_start || team.break_end) {
        // Punch in
        updates = { break_start: new Date().toISOString(), break_end: null };
      } else {
        // Punch out
        const now = new Date();
        const breakSec = Math.floor(
          (now - new Date(team.break_start)) / 1000
        );
        updates = {
          break_end: now.toISOString(),
          daily_break_seconds:
            (team.daily_break_seconds || 0) + breakSec,
        };
      }

      const { data, error } = await supabase
        .from("teams")
        .update(updates)
        .eq("id", teamId);

      if (error) console.error("Error punching:", error);
      else fetchTeams();
    } catch (err) {
      console.error(err);
    }
  };

  // Admin login
  const handleAdminLogin = () => {
    if (
      adminLogin.username === "admin" &&
      adminLogin.password === "admin123"
    ) {
      setAdminLogged(true);
      setAdminLogin({ username: "", password: "" });
    } else alert("Wrong credentials");
  };

  const handleAddUser = async (name) => {
    if (!adminLogged) return;
    try {
      const { data, error } = await supabase
        .from("teams")
        .insert([{ name }]);
      if (error) console.error("Error adding user:", error);
      else fetchTeams();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveUser = async (id) => {
    if (!adminLogged) return;
    try {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) console.error("Error removing user:", error);
      else fetchTeams();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCSV = (range = "daily") => {
    // Filter teams and export CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Name,Daily Break,Current Break\n";
    teams.forEach((t) => {
      const daily = formatHHMMSS(t.daily_break_seconds || 0);
      const current = formatHHMMSS(t.currentBreakSeconds || 0);
      csvContent += `${t.name},${daily},${current}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `break_data_${range}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 font-sans">
      <h1 className="text-2xl mb-4">Team Break Dashboard</h1>

      {adminLogged ? (
        <div className="mb-4">
          <input
            type="text"
            placeholder="New User Name"
            id="newUserName"
            className="border p-1 mr-2"
          />
          <button
            className="bg-blue-500 text-white px-3 py-1 rounded"
            onClick={() => handleAddUser(document.getElementById("newUserName").value)}
          >
            Add User
          </button>
          <button
            className="bg-green-500 text-white px-3 py-1 rounded ml-2"
            onClick={() => handleExportCSV("daily")}
          >
            Export CSV
          </button>
        </div>
      ) : (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Admin Username"
            value={adminLogin.username}
            onChange={(e) =>
              setAdminLogin({ ...adminLogin, username: e.target.value })
            }
            className="border p-1 mr-2"
          />
          <input
            type="password"
            placeholder="Password"
            value={adminLogin.password}
            onChange={(e) =>
              setAdminLogin({ ...adminLogin, password: e.target.value })
            }
            className="border p-1 mr-2"
          />
          <button
            onClick={handleAdminLogin}
            className="bg-gray-700 text-white px-3 py-1 rounded"
          >
            Admin Login
          </button>
        </div>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Current Break</th>
            <th className="border px-2 py-1">Today's Total Break</th>
            <th className="border px-2 py-1">Action</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => {
            const longBreak = (t.daily_break_seconds || 0) / 60 > 15; // highlight if > 15 min
            return (
              <tr
                key={t.id}
                className={longBreak ? "bg-red-200" : ""}
              >
                <td className="border px-2 py-1">{t.name}</td>
                <td className="border px-2 py-1">
                  {formatHHMMSS(t.currentBreakSeconds || 0)}
                </td>
                <td className="border px-2 py-1">
                  {formatHHMMSS(t.daily_break_seconds || 0)}
                </td>
                <td className="border px-2 py-1">
                  <button
                    className="bg-blue-500 text-white px-2 py-1 rounded"
                    onClick={() => handlePunch(t.id)}
                  >
                    {t.break_start && !t.break_end ? "Punch Out" : "Punch In"}
                  </button>
                  {adminLogged && (
                    <button
                      className="bg-red-500 text-white px-2 py-1 rounded ml-2"
                      onClick={() => handleRemoveUser(t.id)}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
