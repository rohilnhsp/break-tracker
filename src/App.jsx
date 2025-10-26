import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";

const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [teams, setTeams] = useState([]);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [exportType, setExportType] = useState("day");

  const timersRef = useRef({});

  // Fetch logged-in user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.session.user.id)
          .single();
        setUser(userData);
      }
      setLoadingUser(false);
    };
    fetchUser();
  }, []);

  // Fetch teams
  const fetchTeams = async () => {
    const { data, error } = await supabase.from("teams").select("*");
    if (error) console.error("Error fetching teams:", error);
    else setTeams(data || []);
  };

  useEffect(() => {
    fetchTeams();

    // Real-time subscription
    const subscription = supabase
      .channel("public:teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          fetchTeams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Live HH:MM:SS timer for breaks
  useEffect(() => {
    const interval = setInterval(() => {
      setTeams((prevTeams) =>
        prevTeams.map((team) => {
          if (team.break_start && !team.break_end) {
            const start = new Date(team.break_start);
            const diff = Math.floor((Date.now() - start.getTime()) / 1000);
            team.duration = diff; // seconds
          }
          return team;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTimer = (seconds) => {
    if (!seconds) return "00:00:00";
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

  // Punch In / Out
  const handlePunch = async (team) => {
  try {
    const now = new Date().toISOString();
    const updates =
      !team.break_start || team.break_end
        ? { break_start: now, break_end: null }
        : { break_end: now };

    const { data, error } = await supabase
      .from("teams")
      .update(updates)
      .eq("id", team.id)
      .select(); // <--- important

    if (error) throw error;

    // Update local state immediately
    setTeams((prev) =>
      prev.map((t) => (t.id === team.id ? { ...t, ...data[0] } : t))
    );
  } catch (err) {
    console.error("Error updating break:", err);
    alert("Failed to update break");
  }
};

  // Add user
  const handleAddUser = async () => {
    if (!newUserEmail) return alert("Enter email");

    try {
      const { error } = await supabase
        .from("users")
        .insert([{ email: newUserEmail, role: newUserRole }]);

      if (error) throw error;

      alert("User added successfully");
      setNewUserEmail("");
      setNewUserRole("user");
    } catch (err) {
      console.error("Error adding user:", err);
      alert("Failed to add user");
    }
  };

  // CSV Export
  const handleExport = () => {
    const header = ["Name", "Email", "Break Start", "Break End", "Duration"];
    const rows = teams.map((team) => [
      team.name,
      team.email,
      team.break_start || "",
      team.break_end || "",
      formatTimer(team.duration || 0),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [header.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `breaks_${exportType}_${new Date().toISOString()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loadingUser) return <div>Loading user...</div>;

  return (
    <div className="p-6 font-sans">
      <h1 className="text-2xl font-bold mb-4">Team Break Dashboard</h1>

      {user?.role === "admin" && (
        <div className="mb-6 p-4 border rounded">
          <h2 className="font-semibold mb-2">Add User</h2>
          <input
            type="email"
            placeholder="User Email"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            className="border p-2 rounded mr-2"
          />
          <select
            value={newUserRole}
            onChange={(e) => setNewUserRole(e.target.value)}
            className="border p-2 rounded mr-2"
          >
            <option value="user">User</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={handleAddUser}
            className="bg-blue-500 text-white px-3 py-1 rounded"
          >
            Add
          </button>
        </div>
      )}

      {(user?.role === "admin" || user?.role === "manager") && (
        <div className="mb-6 flex items-center space-x-2">
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
          <button
            onClick={handleExport}
            className="bg-green-500 text-white px-3 py-1 rounded"
          >
            Export CSV
          </button>
        </div>
      )}

      <table className="min-w-full border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 border">Name</th>
            <th className="p-2 border">Email</th>
            <th className="p-2 border">On Break</th>
            <th className="p-2 border">Break Duration</th>
            <th className="p-2 border">Action</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => {
            const onBreak = team.break_start && !team.break_end;
            const highlight = team.duration > 15 * 60; // highlight > 15 mins

            return (
              <tr
                key={team.id}
                className={highlight ? "bg-red-100" : ""}
              >
                <td className="p-2 border">{team.name}</td>
                <td className="p-2 border">{team.email}</td>
                <td className="p-2 border">
                  {onBreak ? (
                    <span className="bg-yellow-200 px-2 py-1 rounded">
                      Yes
                    </span>
                  ) : (
                    <span className="bg-green-200 px-2 py-1 rounded">
                      No
                    </span>
                  )}
                </td>
                <td className="p-2 border">
                  {formatTimer(team.duration || 0)}
                </td>
                <td className="p-2 border">
                  <button
                    onClick={() => handlePunch(team)}
                    className="bg-blue-500 text-white px-3 py-1 rounded"
                  >
                    {onBreak ? "Punch Out" : "Punch In"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
