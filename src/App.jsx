// src/App.jsx
import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Client ----
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";

const supabase = createClient(supabaseUrl, anonKey);

export default function App() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");

  // ---- Auth Session ----
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user || null);
      setIsAdmin(data.session?.user?.email === "admin@example.com"); // generic admin email
    };
    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user || null);
      setIsAdmin(newSession?.user?.email === "admin@example.com");
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // ---- Login ----
  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email: username,
      password,
    });
    if (error) alert(error.message);
  };

  // ---- Fetch Teams ----
  useEffect(() => {
    if (!session) return;
    const fetchTeams = async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name", { ascending: true });
      if (error) console.error(error);
      else setTeams(data);
      setLoading(false);
    };
    fetchTeams();

    // Realtime subscription
    const subscription = supabase
      .channel("public:teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          setTeams((prev) => {
            const index = prev.findIndex((t) => t.id === payload.new.id);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = payload.new;
              return updated;
            } else {
              return [...prev, payload.new];
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [session]);

  // ---- Punch In / Punch Out ----
  const handlePunch = async (team) => {
    if (!session) return alert("Not logged in!");
    const breakActive = !!team.break_start && !team.break_end;
    const updates = breakActive
      ? { break_end: new Date().toISOString() }
      : { break_start: new Date().toISOString(), break_end: null };

    const { error } = await supabase
      .from("teams")
      .update(updates)
      .eq("id", team.id);

    if (error) console.error("Error updating break:", error);
  };

  // ---- Add User (Admin only) ----
  const handleAddUser = async () => {
    if (!isAdmin) return alert("Admin only");
    if (!newUserEmail) return alert("Enter user email");
    const { error } = await supabase.auth.admin.createUser({
      email: newUserEmail,
      password: "defaultPassword123",
      email_confirm: true,
    });
    if (error) alert("Error adding user: " + error.message);
    else alert("User added!");
    setNewUserEmail("");
  };

  // ---- Export Data (Admin only) ----
  const handleExport = (period = "daily") => {
    if (!isAdmin) return alert("Admin only");
    const rows = teams.map((t) => ({
      Name: t.name,
      BreakStart: t.break_start,
      BreakEnd: t.break_end,
    }));

    let filename = "export.csv";
    if (period === "weekly") filename = "export_weekly.csv";
    else if (period === "monthly") filename = "export_monthly.csv";

    const csv = [
      Object.keys(rows[0]).join(","),
      ...rows.map((r) => Object.values(r).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  // ---- Format HH:MM:SS ----
  const formatDuration = (start, end = new Date()) => {
    if (!start) return "00:00:00";
    const diff = new Date(end) - new Date(start);
    const hours = String(Math.floor(diff / 3600000)).padStart(2, "0");
    const minutes = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
    const seconds = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  if (!session)
    return (
      <div className="flex justify-center items-center h-screen">
        <form onSubmit={handleLogin} className="flex flex-col gap-2">
          <input
            placeholder="Email"
            className="border p-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            placeholder="Password"
            type="password"
            className="border p-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="bg-blue-500 text-white p-2">
            Login
          </button>
        </form>
      </div>
    );

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Team Break Dashboard</h1>

      {isAdmin && (
        <div className="mb-4 flex gap-2">
          <input
            placeholder="New user email"
            className="border p-2"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
          />
          <button
            onClick={handleAddUser}
            className="bg-green-500 text-white p-2"
          >
            Add User
          </button>
          <button
            onClick={() => handleExport("daily")}
            className="bg-blue-500 text-white p-2"
          >
            Export Daily
          </button>
          <button
            onClick={() => handleExport("weekly")}
            className="bg-blue-700 text-white p-2"
          >
            Export Weekly
          </button>
          <button
            onClick={() => handleExport("monthly")}
            className="bg-blue-900 text-white p-2"
          >
            Export Monthly
          </button>
        </div>
      )}

      {loading ? (
        <p>Loading teams...</p>
      ) : (
        <table className="w-full border">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">On Break</th>
              <th className="p-2 text-left">Break Duration</th>
              <th className="p-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const onBreak = !!team.break_start && !team.break_end;
              const duration = formatDuration(team.break_start, onBreak ? new Date() : team.break_end);
              const highlight = onBreak && new Date() - new Date(team.break_start) > 15 * 60 * 1000; // 15 mins
              return (
                <tr key={team.id} className="border-b">
                  <td className="p-2">{team.name}</td>
                  <td className="p-2">
                    {onBreak ? (
                      <span className="bg-yellow-300 px-2 py-1 rounded">Yes</span>
                    ) : (
                      <span className="bg-green-300 px-2 py-1 rounded">No</span>
                    )}
                  </td>
                  <td className={`p-2 ${highlight ? "bg-red-200 font-bold" : ""}`}>
                    {duration}
                  </td>
                  <td className="p-2">
                    <button
                      className="bg-blue-500 text-white px-2 py-1"
                      onClick={() => handlePunch(team)}
                    >
                      {onBreak ? "Punch Out" : "Punch In"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
