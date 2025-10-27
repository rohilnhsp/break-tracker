import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { FaUserShield } from "react-icons/fa";

const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";

const supabase = createClient(supabaseUrl, supabaseKey);


const BREAK_OPTIONS = ["Lunch", "Tea", "Short", "Long"];

export default function App() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedBreak, setSelectedBreak] = useState("");
  const [currentUser, setCurrentUser] = useState("");
  const [error, setError] = useState("");

  // Fetch all users (live)
  useEffect(() => {
    fetchUsers();

    // Real-time listener
    const channel = supabase
      .channel("teams-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, fetchUsers)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchUsers() {
    try {
      const { data, error } = await supabase.from("teams").select("*").order("name", { ascending: true });
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching users:", err.message);
      setError("⚠️ Unable to fetch data. Retrying soon...");
    } finally {
      setLoading(false);
    }
  }

  async function handlePunch() {
    if (!currentUser) {
      alert("Please enter your name before punching in/out!");
      return;
    }

    try {
      const { data: userData } = await supabase.from("teams").select("*").eq("name", currentUser).maybeSingle();

      if (!userData) {
        // create new user record
        await supabase.from("teams").insert([{ name: currentUser, status: "Available" }]);
        await fetchUsers();
        return;
      }

      if (userData.status === "Available") {
        // Punch in
        await supabase
          .from("teams")
          .update({
            status: "On Break",
            break_type: selectedBreak || "Short",
            break_start: new Date().toISOString(),
          })
          .eq("id", userData.id);
      } else {
        // Punch out
        const now = new Date();
        const start = new Date(userData.break_start);
        const breakSeconds = Math.floor((now - start) / 1000);
        const newTotal = (userData.total_break_seconds || 0) + breakSeconds;

        await supabase
          .from("teams")
          .update({
            status: "Available",
            break_type: null,
            break_start: null,
            break_end: now.toISOString(),
            total_break_seconds: newTotal,
          })
          .eq("id", userData.id);
      }
    } catch (err) {
      console.error("Error punching in/out:", err.message);
    }
  }

  async function handleAdminLogin() {
    const pass = prompt("Enter admin password:");
    if (pass === import.meta.env.VITE_ADMIN_PASS) {
      setIsAdmin(true);
    } else {
      alert("Incorrect password.");
    }
  }

  function formatDuration(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  const activeUser = users.find((u) => u.name === currentUser);
  const isOnBreak = activeUser?.status === "On Break";
  const currentDuration =
    isOnBreak && activeUser.break_start
      ? Math.floor((Date.now() - new Date(activeUser.break_start)) / 1000)
      : 0;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col items-center p-6 font-sans">
      {/* Header */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Break Tracker</h1>
        <FaUserShield
          size={26}
          className="text-gray-600 hover:text-gray-900 cursor-pointer"
          onClick={handleAdminLogin}
          title="Admin Login"
        />
      </div>

      {/* User Input */}
      <div className="w-full max-w-md bg-white shadow-md rounded-2xl p-5 mb-8">
        <input
          type="text"
          placeholder="Enter your name"
          value={currentUser}
          onChange={(e) => setCurrentUser(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg mb-3"
        />

        <div className="flex items-center gap-3">
          <select
            disabled={isOnBreak}
            value={selectedBreak}
            onChange={(e) => setSelectedBreak(e.target.value)}
            className="flex-1 p-3 border border-gray-300 rounded-lg"
          >
            <option value="">Select Break</option>
            {BREAK_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <button
            onClick={handlePunch}
            className={`px-5 py-3 rounded-lg text-white font-semibold ${
              isOnBreak ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isOnBreak ? "Punch Out" : "Punch In"}
          </button>
        </div>

        {/* Current Break Info */}
        {isOnBreak && (
          <p className="mt-3 text-sm text-gray-600">
            Currently on <strong>{activeUser.break_type}</strong> break —{" "}
            {formatDuration(currentDuration)}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="w-full max-w-6xl overflow-x-auto">
        {loading ? (
          <p>Loading data...</p>
        ) : (
          <table className="min-w-full bg-white shadow-md rounded-xl overflow-hidden text-center">
            <thead className="bg-gray-100 text-gray-700 uppercase text-sm">
              <tr>
                <th className="py-3 px-6">Name</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">Break Type</th>
                <th className="py-3 px-6">Current Break</th>
                <th className="py-3 px-6">Day's Duration</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const currentBreak =
                  u.status === "On Break" && u.break_start
                    ? formatDuration(Math.floor((Date.now() - new Date(u.break_start)) / 1000))
                    : "-";
                return (
                  <tr
                    key={u.id}
                    className={`border-t ${u.status === "On Break" ? "bg-yellow-50" : "bg-white"}`}
                  >
                    <td className="py-3 px-6">{u.name}</td>
                    <td className="py-3 px-6 font-semibold">{u.status}</td>
                    <td className="py-3 px-6">{u.break_type || "-"}</td>
                    <td className="py-3 px-6">{currentBreak}</td>
                    <td className="py-3 px-6">{formatDuration(u.total_break_seconds || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Error Message */}
      {error && <p className="text-red-500 mt-4">{error}</p>}
    </div>
  );
}
