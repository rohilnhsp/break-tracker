import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  FaCoffee,
  FaHamburger,
  FaToilet,
  FaMoon,
  FaUserShield,
} from "react-icons/fa";
import { FiLogIn } from "react-icons/fi";

const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";
const supabase = createClient(supabaseUrl, supabaseKey);

const breakOptions = [
  { label: "Tea Break", icon: <FaCoffee /> },
  { label: "Lunch Break", icon: <FaHamburger /> },
  { label: "Bio Break", icon: <FaToilet /> },
  { label: "Dinner Break", icon: <FaMoon /> },
];

export default function App() {
  const [users, setUsers] = useState([]);
  const [admin, setAdmin] = useState(false);
  const [selectedBreak, setSelectedBreak] = useState("");
  const [punching, setPunching] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // ⏱ Live clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // 🧭 Fetch users
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("teams").select("*");
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.warn("Fetch users failed:", err.message);
    }
  };

  // ⚡ Realtime updates
  useEffect(() => {
    fetchUsers();
    const sub = supabase
      .channel("realtime:teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        fetchUsers
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  // 🧠 Convert seconds to HH:MM:SS
  const formatDuration = (sec) => {
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

  // 🟢 Punch logic
  const handlePunch = async (user) => {
    setPunching(true);
    try {
      const now = new Date();
      const isOnBreak = user.state === "Break";
      let updates = {};

      if (isOnBreak) {
        // Punch Out of Break
        const diff =
          (now.getTime() - new Date(user.break_start_time).getTime()) / 1000;
        const total = (user.daily_break_seconds || 0) + diff;
        updates = {
          state: "Available",
          break_type: null,
          break_start_time: null,
          daily_break_seconds: total,
        };
      } else {
        // Punch Into Break
        if (!selectedBreak) return alert("Select a break type first!");
        updates = {
          state: "Break",
          break_type: selectedBreak,
          break_start_time: now.toISOString(),
        };
      }

      const { error } = await supabase
        .from("teams")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;
      fetchUsers();
      setSelectedBreak("");
    } catch (err) {
      console.error("Error punching in/out:", err.message);
    }
    setPunching(false);
  };

  // 🛡 Admin login
  const handleAdminLogin = () => {
    const pass = prompt("Enter Admin Password:");
    if (pass === "admin123") setAdmin(true);
    else alert("Invalid password");
  };

  // ➕ Add User
  const handleAddUser = async () => {
    const name = prompt("Enter new user name:");
    if (!name) return;
    try {
      await supabase.from("teams").insert([{ name }]);
      fetchUsers();
    } catch (err) {
      console.error("Error adding user:", err.message);
    }
  };

  // ❌ Remove User
  const handleRemoveUser = async (id) => {
    if (!window.confirm("Remove this user?")) return;
    try {
      await supabase.from("teams").delete().eq("id", id);
      fetchUsers();
    } catch (err) {
      console.error("Error removing user:", err.message);
    }
  };

  // ⏰ Auto daily reset
  useEffect(() => {
    users.forEach(async (user) => {
      const last = user.last_break_date
        ? new Date(user.last_break_date).toDateString()
        : null;
      const today = new Date().toDateString();
      if (last !== today) {
        await supabase
          .from("teams")
          .update({
            daily_break_seconds: 0,
            last_break_date: new Date().toISOString(),
          })
          .eq("id", user.id);
      }
    });
  }, [users]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-6 font-sans">
      {/* Admin login icon */}
      <div className="flex justify-end mb-2">
        <button
          onClick={handleAdminLogin}
          className="p-2 text-gray-600 hover:text-black"
          title="Admin Login"
        >
          <FaUserShield size={20} />
        </button>
      </div>

      <h1 className="text-2xl font-semibold text-gray-800 mb-4">
        Team Dashboard
      </h1>

      <div className="overflow-x-auto bg-white rounded-xl shadow-md">
        <table className="min-w-full border-collapse text-sm text-gray-700">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left">NAME</th>
              <th className="px-4 py-3 text-center">STATE</th>
              <th className="px-4 py-3 text-center">CURRENT BREAK</th>
              <th className="px-4 py-3 text-center">DAY DURATION</th>
              {admin && <th className="px-4 py-3 text-center">ACTION</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u, idx) => {
              const bg = idx % 2 === 0 ? "bg-white" : "bg-gray-50";
              const isBreak = u.state === "Break";
              const since = u.break_start_time
                ? (currentTime - new Date(u.break_start_time)) / 1000
                : 0;
              const currentBreakDuration = isBreak ? since : 0;
              const totalDayBreak =
                (u.daily_break_seconds || 0) + (isBreak ? since : 0);

              return (
                <tr key={u.id} className={`${bg} border-b`}>
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2 text-center">
                    {isBreak ? (
                      <span className="text-orange-600 font-medium">
                        {u.break_type} 🕒
                      </span>
                    ) : (
                      <span className="text-green-600 font-medium">
                        Available ●
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center font-mono">
                    {formatDuration(currentBreakDuration)}
                  </td>
                  <td className="px-4 py-2 text-center font-mono">
                    {formatDuration(totalDayBreak)}
                  </td>
                  {admin && (
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleRemoveUser(u.id)}
                        className="text-red-500 hover:text-red-700"
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
      </div>

      {/* Bottom control bar */}
      <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <select
            value={selectedBreak}
            onChange={(e) => setSelectedBreak(e.target.value)}
            className="border rounded-md px-3 py-2"
          >
            <option value="">Select Break Type</option>
            {breakOptions.map((b) => (
              <option key={b.label} value={b.label}>
                {b.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => handlePunch(users[0])}
            disabled={punching}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-md shadow"
          >
            {users[0]?.state === "Break" ? "Punch Out" : "Punch In"}
          </button>
        </div>

        {admin && (
          <button
            onClick={handleAddUser}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
          >
            Add User
          </button>
        )}
      </div>
    </div>
  );
}
