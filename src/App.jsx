import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

// Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const LONG_BREAK_MINUTES = 10; // highlight threshold in minutes

export default function App() {
  const [teams, setTeams] = useState([]);
  const timersRef = useRef({});

  // Fetch teams from Supabase
  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      console.error("Error fetching teams:", error);
      return;
    }
    setTeams(data);
  };

  // Handle Punch In / Punch Out
  const handlePunch = async (team) => {
    try {
      const updates = {};
      const now = new Date().toISOString();

      if (!("break_start" in team) || !("break_end" in team)) {
        alert("Team table missing required columns!");
        return;
      }

      if (team.break_start && !team.break_end) {
        // Punch Out
        updates.break_end = now;
      } else {
        // Punch In
        updates.break_start = now;
        updates.break_end = null;
      }

      console.log("Updating team:", team.id, updates);

      const { error } = await supabase
        .from("teams")
        .update(updates)
        .eq("id", team.id);

      if (error) {
        console.error("Error updating break:", error);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  // Setup real-time subscription
  useEffect(() => {
    fetchTeams();

    const channel = supabase
      .channel("public:teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          console.log("Realtime payload:", payload);
          fetchTeams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Live timers for on-break users
  useEffect(() => {
    const interval = setInterval(() => {
      setTeams((prevTeams) => [...prevTeams]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (start) => {
    if (!start) return "00:00:00";
    const diff = dayjs().diff(dayjs(start), "second");
    const hours = String(Math.floor(diff / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
    const seconds = String(diff % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-4">Team Break Dashboard</h1>
      <button
        onClick={fetchTeams}
        className="mb-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Refresh
      </button>
      <table className="min-w-full bg-white shadow rounded overflow-hidden">
        <thead className="bg-gray-200">
          <tr>
            <th className="py-2 px-4">Name</th>
            <th className="py-2 px-4">Email</th>
            <th className="py-2 px-4">On Break</th>
            <th className="py-2 px-4">Break Duration</th>
            <th className="py-2 px-4">Action</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => {
            const onBreak = team.break_start && !team.break_end;
            const duration = onBreak ? formatDuration(team.break_start) : "00:00:00";
            const durationMinutes = onBreak
              ? dayjs().diff(dayjs(team.break_start), "minute")
              : 0;
            return (
              <tr
                key={team.id}
                className={
                  onBreak && durationMinutes >= LONG_BREAK_MINUTES
                    ? "bg-red-100"
                    : ""
                }
              >
                <td className="border px-4 py-2">{team.name}</td>
                <td className="border px-4 py-2">{team.email}</td>
                <td className="border px-4 py-2">
                  {onBreak ? (
                    <span className="bg-yellow-300 text-yellow-800 px-2 py-1 rounded">
                      Yes
                    </span>
                  ) : (
                    <span className="bg-green-300 text-green-800 px-2 py-1 rounded">
                      No
                    </span>
                  )}
                </td>
                <td className="border px-4 py-2 font-mono">{duration}</td>
                <td className="border px-4 py-2">
                  <button
                    onClick={() => handlePunch(team)}
                    className={`px-3 py-1 rounded text-white ${
                      onBreak ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                    }`}
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
