// src/App.jsx
import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

/*
  Replace these with your Supabase project values
  (you already ran the SQL to create/alter the `teams` table).
*/
const SUPABASE_URL = "https://ulgagdsllwkqxluakifk.supabase.co"; // <- your url
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk"; // <- replace

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Break options shown in dropdown */
const BREAK_TYPES = [
  { label: "Tea ☕", value: "tea" },
  { label: "Lunch 🍴", value: "lunch" },
  { label: "Dinner 🍽️", value: "dinner" },
  { label: "Bio 🚻", value: "bio" },
];

function secondsToHHMMSS(totalSeconds) {
  totalSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function App() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // admin UI state
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminLogged, setAdminLogged] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // local selections & live timers
  const [selectedBreakType, setSelectedBreakType] = useState({});
  const [nowTick, setNowTick] = useState(Date.now());
  const realtimeChannelRef = useRef(null);

  // Admin credentials (generic). Change if you like
  const GENERIC_ADMIN = { username: "admin", password: "admin123" };

  // fetch users initial
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("teams").select("*");
      if (error) {
        console.warn("Fetch users error:", error);
        setUsers([]);
      } else {
        setUsers(data || []);
      }
    } catch (err) {
      console.error("Unexpected fetch error:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // realtime subscription: listens to INSERT/UPDATE/DELETE on teams
  useEffect(() => {
    fetchUsers();

    // subscribe
    const channel = supabase
      .channel("public:teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          // payload contains { eventType, new, old }
          // quick approach: re-fetch (safe, simple)
          fetchUsers();
        }
      )
      .subscribe((status) => {
        // optionally handle status
      });

    realtimeChannelRef.current = channel;

    // tick every second for live timers
    const timer = setInterval(() => setNowTick(Date.now()), 1000);

    return () => {
      clearInterval(timer);
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Utility: safe update fields (only attempts update, errors logged)
  const safeUpdate = async (id, updates) => {
    try {
      const { error } = await supabase.from("teams").update(updates).eq("id", id);
      if (error) console.error("Update error:", error);
    } catch (err) {
      console.error("Unexpected update error:", err);
    }
  };

  // Punch toggle logic:
  // If user.is_on_break === false -> punch in: set is_on_break true, last_punch_in now, break_type selected
  // If user.is_on_break === true  -> punch out: compute delta = now - last_punch_in, add to daily_break_seconds, set is_on_break false, last_punch_out now, break_type null
  const handlePunch = async (user) => {
    // find selected break type for this user
    const type = selectedBreakType[user.id] || user.break_type || BREAK_TYPES[0].value;
    const now = new Date();
    if (!user?.is_on_break) {
      // Punch in
      const updates = {
        is_on_break: true,
        break_type: type,
        last_punch_in: now.toISOString(),
        last_punch_out: null,
      };
      await safeUpdate(user.id, updates);
      // optimistic local update
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updates } : u)));
    } else {
      // Punch out
      if (!user.last_punch_in) {
        // defensive: if no start timestamp, just set not on break
        await safeUpdate(user.id, { is_on_break: false, break_type: null, last_punch_out: now.toISOString() });
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_on_break: false, break_type: null, last_punch_out: now.toISOString() } : u)));
        return;
      }
      const lastIn = new Date(user.last_punch_in);
      const deltaSec = Math.max(0, Math.floor((now.getTime() - lastIn.getTime()) / 1000));

      const updates = {
        is_on_break: false,
        break_type: null,
        last_punch_out: now.toISOString(),
        // add to daily_break_seconds (or create if missing)
        daily_break_seconds: (user.daily_break_seconds || 0) + deltaSec,
        last_break_date: new Date().toISOString().slice(0, 10),
      };
      await safeUpdate(user.id, updates);
      // optimistic local update
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updates } : u)));
    }
  };

  // Toggle logged-in state for user (this can be admin-only or open)
  const toggleLogin = async (user) => {
    const updates = { is_logged_in: !user.is_logged_in };
    await safeUpdate(user.id, updates);
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updates } : u)));
  };

  // Add new user (admin only)
  const addUser = async (name, teamName = "") => {
    if (!name || !name.trim()) return;
    try {
      const { data, error } = await supabase
        .from("teams")
        .insert([
          {
            name: name.trim(),
            team: teamName || null,
            is_on_break: false,
            break_type: null,
            last_punch_in: null,
            last_punch_out: null,
            current_break_seconds: 0,
            daily_break_seconds: 0,
            last_break_date: new Date().toISOString().slice(0, 10),
            is_logged_in: true,
          },
        ])
        .select();
      if (error) {
        console.error("Add user error:", error);
        return;
      }
      // server will emit realtime update, but we can optimistic add
      setUsers((prev) => [...prev, ...(data || [])]);
    } catch (err) {
      console.error("Unexpected add user error:", err);
    }
  };

  // Remove user (admin only)
  const removeUser = async (id) => {
    if (!confirm("Confirm remove user?")) return;
    try {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) {
        console.error("Remove user error:", error);
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== id));
      }
    } catch (err) {
      console.error("Unexpected remove user error:", err);
    }
  };

  // Export CSV helper
  const exportCSV = (rangeTag = "daily") => {
    const headers = ["Name", "State", "CurrentBreak", "Team", "SessionTime"];
    const rows = users.map((u) => {
      const onBreak = !!u.is_on_break;
      const currentBreakSec = onBreak && u.last_punch_in ? Math.floor((Date.now() - new Date(u.last_punch_in).getTime()) / 1000) : 0;
      const dayTotal = u.daily_break_seconds || 0;
      const state = u.is_logged_in ? (onBreak ? "In Break" : "Available") : "Logged Out";
      return [
        u.name || "",
        state,
        secondsToHHMMSS(currentBreakSec),
        u.team || "",
        secondsToHHMMSS(dayTotal),
      ];
    });

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const b = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = url;
    a.download = `breaks_${rangeTag}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Admin login action - called when modal form is submitted
  const handleAdminLogin = (e) => {
    e?.preventDefault?.();
    if (adminUsername === GENERIC_ADMIN.username && adminPassword === GENERIC_ADMIN.password) {
      setAdminLogged(true);
      setIsAdminOpen(false);
      setAdminPassword("");
      setAdminUsername("");
      return;
    }
    alert("Invalid admin credentials");
  };

  // Helper: compute current break seconds for display
  const computeCurrentBreakSec = (u) => {
    if (!u || !u.is_on_break) return 0;
    if (!u.last_punch_in) return 0;
    const started = new Date(u.last_punch_in).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - started) / 1000));
  };

  // Display portion
  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      {/* Topbar with hidden admin icon (top-right) */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm text-gray-600">Last updated: {new Date(nowTick).toLocaleTimeString()}</div>
          <h1 className="text-2xl font-semibold mt-1">Team Break Dashboard</h1>
        </div>

        {/* hidden admin gear icon top-right */}
        <div className="flex items-center gap-2">
          <button
            title="Admin"
            onClick={() => setIsAdminOpen(true)}
            className="p-2 rounded hover:bg-gray-100"
            aria-label="Open admin"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0a1.724 1.724 0 002.053 1.05c.97-.35 1.944.552 1.636 1.538a1.724 1.724 0 001.238 2.273c.946.32.946 1.728 0 2.048a1.724 1.724 0 00-1.238 2.273c.308.986-.666 1.888-1.636 1.538a1.724 1.724 0 00-2.053 1.05c-.299.921-1.602.921-1.901 0a1.724 1.724 0 00-2.053-1.05c-.97.35-1.944-.552-1.636-1.538a1.724 1.724 0 00-1.238-2.273c-.946-.32-.946-1.728 0-2.048a1.724 1.724 0 001.238-2.273c-.308-.986.666-1.888 1.636-1.538.79.286 1.718-.155 2.053-1.05z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Admin modal */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-lg font-semibold mb-2">Admin Login</h2>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700">Username</label>
                <input value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block text-sm text-gray-700">Password</label>
                <input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} type="password" className="w-full border p-2 rounded" />
              </div>
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500">Generic admin: admin / admin123</div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsAdminOpen(false)} className="px-3 py-1 rounded border">Cancel</button>
                  <button type="submit" className="px-3 py-1 rounded bg-blue-600 text-white">Login</button>
                </div>
              </div>
            </form>

            {/* quick admin controls when logged in */}
            {adminLogged && (
              <div className="mt-4 border-t pt-4">
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => {
                    const name = prompt("New user name:");
                    if (name) addUser(name);
                  }}>Add user</button>
                  <button className="px-3 py-1 bg-yellow-600 text-white rounded" onClick={() => exportCSV("daily")}>Export Daily</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main table */}
      <div className="mt-6 rounded-lg overflow-hidden shadow-sm bg-white">
        <table className="min-w-full text-center">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-3 text-sm font-medium text-gray-700">AGENT NAME</th>
              <th className="py-3 text-sm font-medium text-gray-700">STATE</th>
              <th className="py-3 text-sm font-medium text-gray-700">TIME</th>
              <th className="py-3 text-sm font-medium text-gray-700">TEAM</th>
              <th className="py-3 text-sm font-medium text-gray-700">SESSION TIME</th>
              {adminLogged && <th className="py-3 text-sm font-medium text-gray-700">ACTIONS</th>}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan={adminLogged ? 6 : 5} className="py-8">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={adminLogged ? 6 : 5} className="py-8">No users</td></tr>
            ) : (
              users.map((u, idx) => {
                const onBreak = !!u.is_on_break;
                const loggedIn = !!u.is_logged_in;
                const currentBreakSec = computeCurrentBreakSec(u);
                const dayTotal = u.daily_break_seconds || 0;
                const sessionTime = secondsToHHMMSS(dayTotal + (onBreak ? currentBreakSec : 0));
                const stateText = loggedIn ? (onBreak ? "In Break" : "Available") : "Logged Out";

                const highlight = onBreak ? "bg-yellow-50" : (idx % 2 === 0 ? "" : "bg-gray-50");

                return (
                  <tr key={u.id} className={`${highlight} border-b`}>
                    <td className="py-3 text-sm font-medium text-gray-800">{u.name}</td>

                    <td className="py-3 text-sm text-gray-700 flex items-center justify-center gap-2">
                      {/* status dot */}
                      <span className={`inline-block w-2 h-2 rounded-full ${loggedIn ? (onBreak ? "bg-yellow-500" : "bg-green-500") : "bg-gray-400"}`}></span>
                      <span>{stateText}</span>
                    </td>

                    <td className="py-3 text-sm text-gray-700">
                      {/* Current break duration in HH:MM:SS (live) */}
                      {onBreak ? secondsToHHMMSS(currentBreakSec) : u.current_break_seconds ? secondsToHHMMSS(u.current_break_seconds) : "00:00:00"}
                    </td>

                    <td className="py-3 text-sm text-gray-700">{u.team || "—"}</td>

                    <td className="py-3 text-sm text-gray-700">{sessionTime}</td>

                    {adminLogged && (
                      <td className="py-3 text-sm text-gray-700">
                        <div className="flex items-center justify-center gap-2">
                          {/* break type selector (disabled when active) */}
                          <select
                            className="border px-2 py-1 rounded text-sm"
                            value={selectedBreakType[u.id] ?? (u.break_type ?? BREAK_TYPES[0].value)}
                            onChange={(e) => setSelectedBreakType((s) => ({ ...s, [u.id]: e.target.value }))}
                            disabled={!!u.is_on_break}
                          >
                            {BREAK_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                          </select>

                          {/* Punch toggle */}
                          <button
                            className={`px-3 py-1 rounded text-white ${onBreak ? "bg-red-500 hover:bg-red-600" : "bg-green-600 hover:bg-green-700"}`}
                            onClick={() => handlePunch(u)}
                          >
                            {onBreak ? "Punch Out" : "Punch In"}
                          </button>

                          {/* mark login/logout (admin action) */}
                          <button
                            className="px-2 py-1 rounded border"
                            onClick={() => toggleLogin(u)}
                            title={u.is_logged_in ? "Mark logged out" : "Mark logged in"}
                          >
                            {u.is_logged_in ? "Log Out" : "Log In"}
                          </button>

                          {/* remove */}
                          <button className="px-2 py-1 text-red-600" onClick={() => removeUser(u.id)}>🗑</button>
                        </div>
                      </td>
                    )}

                    {!adminLogged && (
                      <td style={{ display: "none" }} /> // keep table columns stable
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* bottom controls when admin logged */}
      {adminLogged && (
        <div className="mt-4 flex gap-2">
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => {
            const name = prompt("Enter name for new user:");
            if (name) addUser(name);
          }}>➕ Add user</button>

          <button className="px-3 py-1 bg-yellow-500 text-white rounded" onClick={() => exportCSV("daily")}>Export Daily</button>
          <button className="px-3 py-1 bg-yellow-600 text-white rounded" onClick={() => exportCSV("weekly")}>Export Weekly</button>
          <button className="px-3 py-1 bg-yellow-700 text-white rounded" onClick={() => exportCSV("monthly")}>Export Monthly</button>
        </div>
      )}
    </div>
  );
}
