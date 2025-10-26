import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Client ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk"; // replace with your anon key
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
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminLogin, setAdminLogin] = useState({ username: "", password: "" });
  const intervalRef = useRef(null);

  // Fetch teams safely
  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, break_start, break_end, daily_break_seconds");
      if (error) console.error("Error fetching teams:", error);
      else {
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
        updates = { break_start: new Date().toISOString(), break_end: null };
      } else {
        const now = new Date();
        const breakSec = Math.floor((now - new Date(team.break_start)) / 1000);
        updates = {
          break_end: now.toISOString(),
          daily_break_seconds: (team.daily_break_seconds || 0) + breakSec,
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
    if (adminLogin.username === "admin" && adminLogin.password === "admin123") {
      setAdminLogged(true);
      setShowAdminLogin(false);
      setAdminLogin({ username: "", password: "" });
    } else alert("Wrong credentials");
  };

  const handleAddUser = async (name) => {
    if (!adminLogged) return;
    try {
      const { data, error } = await supabase.from("teams").insert([{ name }]);
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
    <div className="min-h-screen bg-gray-50 font-sans p-6 flex flex-col items-center">
      <header className="w-full flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Team Break Dashboard</h1>
        <button
          className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
          onClick={() => setShowAdminLogin(!showAdminLogin)}
        >
          Admin
        </button>
      </header>

      {showAdminLogin && !adminLogged && (
        <div className="mb-4 flex flex-col items-start bg-white p-4 rounded shadow w-full max-w-md">
          <input
            type="text"
            placeholder="Username"
            value={adminLogin.username}
            onChange={(e) =>
              setAdminLogin({ ...adminLogin, username: e.target.value })
            }
            className="border p-2 rounded w-full mb-2"
          />
          <input
            type="password"
            placeholder="Password"
            value={adminLogin.password}
            onChange={(e) =>
              setAdminLogin({ ...adminLogin, password: e.target.value })
            }
            className="border p-2 rounded w-full mb-2"
          />
          <button
            onClick={handleAdminLogin}
            className="bg-gray-800 text-white px-4 py-2 rounded w-full hover:bg-gray-700 transition"
          >
            Login
          </button>
        </div>
      )}

      {adminLogged && (
        <div className="mb-4 flex flex-wrap justify-start w-full max-w-md gap-2">
          <input
            type="text"
            placeholder="New User Name"
            id="newUserName"
            className="border p-2 rounded flex-1"
          />
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
            onClick={() =>
              handleAddUser(document.getElementById("newUserName").value)
            }
          >
            Add User
          </button>
          <button
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
            onClick={() => handleExportCSV("daily")}
          >
            Export CSV
          </button>
        </div>
      )}

      <div className="overflow-x-auto w-full max-w-5xl">
        <table className="w-full border-collapse bg-white shadow rounded overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Current Break</th>
              <th className="text-left px-4 py-2">Today's Total Break</th>
              <th className="text-left px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => {
              const longBreak = (t.daily_break_seconds || 0) / 60 > 15;
              return (
                <tr
                  key={t.id}
                  className={`border-t ${longBreak ? "bg-red-100" : ""}`}
                >
                  <td className="px-4 py-2">{t.name}</td>
                  <td className="px-4 py-2">
                    {formatHHMMSS(t.currentBreakSeconds || 0)}
                  </td>
                  <td className="px-4 py-2">
                    {formatHHMMSS(t.daily_break_seconds || 0)}
                  </td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      onClick={() => handlePunch(t.id)}
                      className="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700 transition"
                    >
                      {t.break_start && !t.break_end ? "Punch Out" : "Punch In"}
                    </button>
                    {adminLogged && (
                      <button
                        onClick={() => handleRemoveUser(t.id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
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
    </div>
  );
}
