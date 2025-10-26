import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";

const supabase = createClient(supabaseUrl, supabaseKey);

// Long break threshold in seconds (e.g., 15 mins = 900s)
const LONG_BREAK_THRESHOLD = 15 * 60;

export default function App() {
  const [teams, setTeams] = useState([]);

  // Fetch initial data
  const fetchTeams = async () => {
    const { data, error } = await supabase.from("teams").select("*");
    if (error) {
      console.error("Error fetching teams:", error);
    } else {
      setTeams(data);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  // Realtime subscription
  useEffect(() => {
    const subscription = supabase
      .channel("public:teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          setTeams((prev) =>
            prev.map((t) =>
              t.id === payload.new.id ? { ...t, ...payload.new } : t
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Handle Punch In / Punch Out
  const handlePunch = async (team) => {
    try {
      const isOnBreak = team.break_start && !team.break_end;
      const updates = isOnBreak
        ? { break_end: new Date().toISOString() } // Punch Out
        : { break_start: new Date().toISOString(), break_end: null }; // Punch In

      const { data, error } = await supabase
        .from("teams")
        .update(updates)
        .eq("id", team.id)
        .select();

      if (error) throw error;

      // Update local state immediately
      setTeams((prev) =>
        prev.map((t) => (t.id === team.id ? { ...t, ...data[0] } : t))
      );
    } catch (err) {
      console.error("Error updating break:", err);
    }
  };

  // Timer state
  const [timer, setTimer] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Helper to calculate live break duration in seconds
  const getBreakDuration = (team) => {
    if (!team.break_start) return 0;
    const end = team.break_end ? new Date(team.break_end) : new Date();
    const start = new Date(team.break_start);
    return Math.floor((end - start) / 1000);
  };

  // Helper to format seconds to HH:MM:SS
  const formatDuration = (secs) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, "0");
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // Export table as CSV
  const exportCSV = () => {
    const header = ["Name", "Email", "On Break", "Break Duration"];
    const rows = teams.map((team) => {
      const duration = formatDuration(getBreakDuration(team));
      const isOnBreak = team.break_start && !team.break_end;
      return [team.name, team.email, isOnBreak ? "Yes" : "No", duration];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [header.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `team_breaks_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 font-sans">
      <h1 className="text-2xl font-bold mb-4 flex items-center justify-between">
        Team Break Dashboard
        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Export Data
        </button>
      </h1>
      <table className="min-w-full border border-gray-200">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Name</th>
            <th className="p-2 border">Email</th>
            <th className="p-2 border">On Break</th>
            <th className="p-2 border">Break Duration</th>
            <th className="p-2 border">Action</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => {
            const duration = getBreakDuration(team);
            const isLongBreak = duration >= LONG_BREAK_THRESHOLD;
            const isOnBreak = team.break_start && !team.break_end;
            return (
              <tr
                key={team.id}
                className={isLongBreak ? "bg-red-100" : ""}
              >
                <td className="p-2 border">{team.name}</td>
                <td className="p-2 border">{team.email}</td>
                <td className="p-2 border">
                  {isOnBreak ? (
                    <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                      Yes
                    </span>
                  ) : (
                    <span className="bg-green-200 text-green-800 px-2 py-1 rounded">
                      No
                    </span>
                  )}
                </td>
                <td className="p-2 border">
                  {isOnBreak ? formatDuration(duration) : "-"}
                </td>
                <td className="p-2 border">
                  <button
                    onClick={() => handlePunch(team)}
                    className={`px-4 py-2 rounded text-white ${
                      isOnBreak
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-blue-500 hover:bg-blue-600"
                    }`}
                  >
                    {isOnBreak ? "Punch Out" : "Punch In"}
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
