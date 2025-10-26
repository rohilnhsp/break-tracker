import React, { useEffect, useState } from "react";
import { supabase, adminSupabase } from "./supabase"; // single instances
import "./App.css";

function formatDuration(seconds) {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminView, setAdminView] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");

  // ---- Fetch user once ----
  useEffect(() => {
    async function fetchUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Auth error:", error.message);
      } else {
        setUser(data.user);
      }
    }
    fetchUser();
  }, []);

  // ---- Fetch teams ----
  useEffect(() => {
    if (!user) return;
    async function fetchTeams() {
      const { data, error } = await supabase.from("teams").select("*");
      if (error) console.error("Error fetching teams:", error);
      else setTeams(data);
      setLoading(false);
    }
    fetchTeams();

    // Subscribe to changes
    const subscription = supabase
      .channel("public:teams")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, (payload) => {
        setTeams((prev) => {
          const index = prev.findIndex((t) => t.id === payload.new.id);
          if (index !== -1) prev[index] = payload.new;
          else prev.push(payload.new);
          return [...prev];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  // ---- Live timers ----
  useEffect(() => {
    const interval = setInterval(() => {
      setTeams((prev) =>
        prev.map((t) => {
          if (t.break_start && !t.break_end) {
            const start = new Date(t.break_start);
            const now = new Date();
            t.duration = Math.floor((now - start) / 1000);
          }
          return t;
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ---- Punch In / Punch Out ----
  const toggleBreak = async (team) => {
    const updating = team.break_start && !team.break_end;
    const payload = updating
      ? { break_end: new Date().toISOString() }
      : { break_start: new Date().toISOString(), break_end: null };

    try {
      const { data, error } = await supabase
        .from("teams")
        .update(payload)
        .eq("id", team.id)
        .select();
      if (error) throw error;
      setTeams((prev) =>
        prev.map((t) => (t.id === team.id ? { ...t, ...data[0] } : t))
      );
    } catch (err) {
      console.error("Error updating break:", err);
    }
  };

  // ---- Add User / Assign Admin ----
  const handleAddUser = async () => {
    if (!newUserEmail) return alert("Enter email");
    try {
      const { data, error } = await adminSupabase.auth.admin.createUser({
        email: newUserEmail,
        password: "TempPass123!",
        email_confirm: true,
      });
      if (error) throw error;

      // Add role in teams table
      await adminSupabase.from("teams").insert([
        { name: newUserEmail, role: newUserRole },
      ]);

      alert("User added!");
      setNewUserEmail("");
      setNewUserRole("user");
    } catch (err) {
      console.error("Error adding user", err);
      alert("Error adding user");
    }
  };

  // ---- CSV Export ----
  const exportCSV = (filter) => {
    let filteredTeams = [...teams];
    if (filter === "daily") {
      const today = new Date().toISOString().slice(0, 10);
      filteredTeams = filteredTeams.filter((t) => t.break_start?.startsWith(today));
    } else if (filter === "weekly") {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
      filteredTeams = filteredTeams.filter((t) => t.break_start >= weekAgo);
    } else if (filter === "monthly") {
      const now = new Date();
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString();
      filteredTeams = filteredTeams.filter((t) => t.break_start >= monthAgo);
    }

    const csv = [
      ["Name", "Role", "Break Start", "Break End", "Duration"],
      ...filteredTeams.map((t) => [
        t.name,
        t.role,
        t.break_start,
        t.break_end,
        formatDuration(t.duration || 0),
      ]),
    ]
      .map((e) => e.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "breaks.csv";
    link.click();
  };

  if (!user) return <div>Loading user...</div>;

  return (
    <div className="p-4 font-sans">
      {!adminView ? (
        <>
          <h2 className="text-2xl font-bold mb-4">User Dashboard</h2>
          <table className="w-full border border-gray-300">
            <thead>
              <tr>
                <th className="border p-2">Name</th>
                <th className="border p-2">Break Timer</th>
                <th className="border p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr
                  key={t.id}
                  className={`${
                    t.duration > 15 * 60 ? "bg-red-100" : ""
                  }`}
                >
                  <td className="border p-2">{t.name}</td>
                  <td className="border p-2">{formatDuration(t.duration || 0)}</td>
                  <td className="border p-2">
                    <button
                      className="px-3 py-1 bg-blue-500 text-white rounded"
                      onClick={() => toggleBreak(t)}
                    >
                      {t.break_start && !t.break_end ? "Punch Out" : "Punch In"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="mt-4 px-4 py-2 bg-green-500 text-white rounded"
            onClick={() => setAdminView(true)}
          >
            Go to Admin
          </button>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold mb-4">Admin Dashboard</h2>
          <div className="mb-4">
            <input
              type="email"
              placeholder="User email"
              className="border px-2 py-1 mr-2"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
            />
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
              className="border px-2 py-1 mr-2"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button
              className="px-3 py-1 bg-blue-500 text-white rounded"
              onClick={handleAddUser}
            >
              Add User
            </button>
          </div>
          <div className="mb-4">
            <button
              className="px-3 py-1 bg-green-500 text-white mr-2 rounded"
              onClick={() => exportCSV("daily")}
            >
              Export Daily
            </button>
            <button
              className="px-3 py-1 bg-green-500 text-white mr-2 rounded"
              onClick={() => exportCSV("weekly")}
            >
              Export Weekly
            </button>
            <button
              className="px-3 py-1 bg-green-500 text-white rounded"
              onClick={() => exportCSV("monthly")}
            >
              Export Monthly
            </button>
          </div>
          <button
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded"
            onClick={() => setAdminView(false)}
          >
            Back to User Dashboard
          </button>
        </>
      )}
    </div>
  );
}
  
