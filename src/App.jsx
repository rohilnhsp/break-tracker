import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Client ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";

const supabase = createClient(supabaseUrl, anonKey);

const App = () => {
  const [teams, setTeams] = useState([]);
  const [adminModal, setAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [newUserName, setNewUserName] = useState("");

  const LONG_BREAK_MIN = 10; // Highlight if break exceeds this

  // Fetch teams from Supabase
  const fetchTeams = async () => {
    const { data, error } = await supabase.from("teams").select("*");
    if (!error) setTeams(data);
  };

  useEffect(() => {
    fetchTeams();
    const subscription = supabase
      .channel("public:teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        () => fetchTeams()
      )
      .subscribe();
    return () => supabase.removeChannel(subscription);
  }, []);

  // Punch In/Out
  const handlePunch = async (team) => {
    const now = new Date().toISOString();
    const updates =
      team.break_end === null
        ? { break_end: now } // Punch Out
        : { break_start: now, break_end: null }; // Punch In
    const { error } = await supabase.from("teams").update(updates).eq("id", team.id);
    if (error) console.error("Error updating break:", error);
    else fetchTeams();
  };

  // Admin login
  const handleAdminLogin = () => {
    if (adminPassword === "admin123") {
      setIsAdmin(true);
      setAdminModal(false);
    } else {
      alert("Invalid admin password");
    }
  };

  // Add new user
  const handleAddUser = async () => {
    if (!newUserName) return;
    const { error } = await supabase.from("teams").insert([
      { name: newUserName, break_start: null, break_end: null },
    ]);
    if (error) alert("Error adding user");
    else {
      setNewUserName("");
      fetchTeams();
    }
  };

  // Remove user
  const handleRemoveUser = async (id) => {
    if (!window.confirm("Are you sure you want to remove this user?")) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) alert("Error removing user");
    else fetchTeams();
  };

  // CSV export
  const handleExport = (period) => {
    const now = new Date();
    let filteredTeams = [...teams];

    if (period === "daily") {
      filteredTeams = filteredTeams.filter(
        (t) =>
          t.break_start &&
          new Date(t.break_start).toDateString() === now.toDateString()
      );
    } else if (period === "weekly") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      filteredTeams = filteredTeams.filter(
        (t) => t.break_start && new Date(t.break_start) >= weekAgo
      );
    } else if (period === "monthly") {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      filteredTeams = filteredTeams.filter(
        (t) => t.break_start && new Date(t.break_start) >= monthAgo
      );
    }

    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Name,Break Start,Break End,Duration (sec)"].join(",") +
      "\n" +
      filteredTeams
        .map((t) => {
          const start = t.break_start ? new Date(t.break_start).toLocaleString() : "";
          const end = t.break_end ? new Date(t.break_end).toLocaleString() : "";
          const duration = t.break_start
            ? Math.floor(
                ((t.break_end ? new Date(t.break_end) : new Date()) -
                  new Date(t.break_start)) /
                  1000
              )
            : 0;
          return [t.name, start, end, duration].join(",");
        })
        .join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `export_${period}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Live timers
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds) => {
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
  };

  // Calculate daily total break duration
  const getDailyBreak = (team) => {
    if (!team.break_start) return 0;
    const start = new Date(team.break_start);
    const end = team.break_end ? new Date(team.break_end) : new Date();
    if (start.toDateString() !== new Date().toDateString()) return 0;
    return Math.floor((end - start) / 1000);
  };

  return (
    <div className="p-6 font-sans">
      <h1 className="text-2xl font-bold mb-4">Team Break Dashboard</h1>

      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border">Name</th>
            <th className="p-2 border">On Break</th>
            <th className="p-2 border">Break Duration</th>
            <th className="p-2 border">Today's Total Break</th>
            <th className="p-2 border">Action</th>
            {isAdmin && <th className="p-2 border">Remove</th>}
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => {
            const durationSec = team.break_start
              ? Math.floor(
                  ((team.break_end ? new Date(team.break_end) : new Date()) -
                    new Date(team.break_start)) /
                    1000
                )
              : 0;
            const dailyBreakSec = getDailyBreak(team);
            return (
              <tr
                key={team.id}
                className={team.break_start && durationSec / 60 > LONG_BREAK_MIN ? "bg-red-100" : ""}
              >
                <td className="p-2 border">{team.name}</td>
                <td className="p-2 border">{team.break_start && !team.break_end ? "Yes" : "No"}</td>
                <td className="p-2 border">{formatDuration(durationSec)}</td>
                <td className="p-2 border">{formatDuration(dailyBreakSec)}</td>
                <td className="p-2 border">
                  <button
                    className="px-3 py-1 bg-blue-500 text-white rounded"
                    onClick={() => handlePunch(team)}
                  >
                    {team.break_start && !team.break_end ? "Punch Out" : "Punch In"}
                  </button>
                </td>
                {isAdmin && (
                  <td className="p-2 border">
                    <button
                      className="px-3 py-1 bg-red-500 text-white rounded"
                      onClick={() => handleRemoveUser(team.id)}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-6">
        <button
          className="px-3 py-2 bg-green-500 text-white rounded"
          onClick={() => setAdminModal(true)}
        >
          Admin Login
        </button>
      </div>

      {/* Admin Modal */}
      {adminModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-96">
            {!isAdmin ? (
              <>
                <h2 className="text-xl font-bold mb-2">Admin Login</h2>
                <input
                  type="password"
                  placeholder="Password"
                  className="border p-2 w-full mb-4"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
                <button
                  className="px-3 py-2 bg-blue-500 text-white rounded mr-2"
                  onClick={handleAdminLogin}
                >
                  Login
                </button>
                <button
                  className="px-3 py-2 bg-gray-300 rounded"
                  onClick={() => setAdminModal(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-2">Admin Panel</h2>

                {/* Add User */}
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="New User Name"
                    className="border p-2 mr-2"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                  />
                  <button
                    className="px-3 py-2 bg-green-500 text-white rounded"
                    onClick={handleAddUser}
                  >
                    Add User
                  </button>
                </div>

                {/* Export */}
                <div className="mb-4">
                  <button
                    className="px-3 py-2 bg-purple-500 text-white rounded mr-2"
                    onClick={() => handleExport("daily")}
                  >
                    Export Daily
                  </button>
                  <button
                    className="px-3 py-2 bg-purple-500 text-white rounded mr-2"
                    onClick={() => handleExport("weekly")}
                  >
                    Export Weekly
                  </button>
                  <button
                    className="px-3 py-2 bg-purple-500 text-white rounded"
                    onClick={() => handleExport("monthly")}
                  >
                    Export Monthly
                  </button>
                </div>

                <button
                  className="px-3 py-2 bg-red-500 text-white rounded"
                  onClick={() => {
                    setIsAdmin(false);
                    setAdminModal(false);
                    setAdminPassword("");
                  }}
                >
                  Logout Admin
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
