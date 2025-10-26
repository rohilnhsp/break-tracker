import { useEffect, useState, useRef } from "react";
import { supabase } from "./supabaseClient"; // make sure supabaseClient is properly configured
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

export default function App() {
  const [teams, setTeams] = useState([]);
  const longBreakThreshold = 15 * 60; // highlight if break > 15 minutes
  const timerRef = useRef();

  // Fetch teams
  const fetchTeams = async () => {
    const { data, error } = await supabase.from("teams").select("*");
    if (error) {
      console.error("Error fetching teams:", error);
    } else {
      setTeams(data);
    }
  };

  // Punch In / Punch Out
  const handlePunch = async (team) => {
    const now = new Date().toISOString();
    const updates = team.break_start
      ? { break_start: null, break_end: now }
      : { break_start: now, break_end: null };

    console.log("Updating team:", team.id, updates);

    const { error } = await supabase
      .from("teams")
      .update(updates)
      .eq("id", team.id)
      .select(); // select() to return updated row

    if (error) {
      console.error("Error updating break:", error);
    } else {
      // Optimistically update UI
      setTeams((prev) =>
        prev.map((t) => (t.id === team.id ? { ...t, ...updates } : t))
      );
    }
  };

  // Realtime subscription
  useEffect(() => {
    fetchTeams();

    const subscription = supabase
      .channel("public:teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          console.log("Realtime update:", payload);
          fetchTeams(); // refresh data
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Timer for live HH:MM:SS updates
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTeams((prev) => [...prev]); // trigger re-render every second
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, []);

  const formatDuration = (breakStart) => {
    if (!breakStart) return "00:00:00";
    const diff = Math.floor((new Date() - new Date(breakStart)) / 1000);
    const dur = dayjs.duration(diff, "seconds");
    return `${String(dur.hours()).padStart(2, "0")}:${String(
      dur.minutes()
    ).padStart(2, "0")}:${String(dur.seconds()).padStart(2, "0")}`;
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Team Break Dashboard</h1>
        <table className="w-full table-auto border-collapse bg-white shadow rounded">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">On Break</th>
              <th className="p-3 text-left">Break Duration</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const isOnBreak = !!team.break_start;
              const breakSeconds = team.break_start
                ? Math.floor((new Date() - new Date(team.break_start)) / 1000)
                : 0;
              const longBreak = breakSeconds >= longBreakThreshold;

              return (
                <tr
                  key={team.id}
                  className={`border-b ${
                    longBreak ? "bg-red-100" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="p-3">{team.name}</td>
                  <td className="p-3">{team.email}</td>
                  <td className="p-3">
                    {isOnBreak ? (
                      <span className="px-2 py-1 bg-yellow-200 rounded-full text-sm font-semibold">
                        Yes
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-200 rounded-full text-sm font-semibold">
                        No
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono">
                    {formatDuration(team.break_start)}
                  </td>
                  <td className="p-3">
                    <button
                      className={`px-4 py-2 rounded font-semibold ${
                        isOnBreak
                          ? "bg-red-500 text-white hover:bg-red-600"
                          : "bg-green-500 text-white hover:bg-green-600"
                      }`}
                      onClick={() => handlePunch(team)}
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
    </div>
  );
}
