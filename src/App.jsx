import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";

const SUPABASE_URL = "https://ulgagdsllwkqxluakifk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [teams, setTeams] = useState([]);
  const intervalRef = useRef(null);
  const LONG_BREAK_MINUTES = 10; // highlight after 10 minutes

  // Fetch teams initially
  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("name", { ascending: true });

    if (error) console.error("Error fetching teams:", error);
    else setTeams(data);
  };

  useEffect(() => {
    fetchTeams();

    // Subscribe to realtime updates
    const subscription = supabase
      .channel("public:teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          const updatedTeam = payload.new;
          setTeams((prev) =>
            prev.map((t) => (t.id === updatedTeam.id ? updatedTeam : t))
          );
        }
      )
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  // Live timers
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTeams((prev) => [...prev]); // trigger re-render for timers
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, []);

  const handlePunch = async (team) => {
    const now = new Date().toISOString();
    const updates = team.break_start
      ? { break_start: null, break_end: now }
      : { break_start: now, break_end: null };

    console.log("Updating team:", team.id, updates);

    const { data, error } = await supabase
      .from("teams")
      .update(updates)
      .eq("id", team.id);

    if (error) {
      console.error("Error updating break:", error);
    } else {
      // Optimistic UI update
      setTeams((prev) =>
        prev.map((t) => (t.id === team.id ? { ...t, ...updates } : t))
      );
    }
  };

  const formatDuration = (start) => {
    if (!start) return "00:00:00";
    const diff = dayjs().diff(dayjs(start), "second");
    const hours = String(Math.floor(diff / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
    const seconds = String(diff % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Team Break Dashboard</h1>
      <table className="w-full bg-white shadow rounded-lg overflow-hidden">
        <thead className="bg-gray-200">
          <tr>
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-4 py-2 text-left">Email</th>
            <th className="px-4 py-2 text-left">On Break</th>
            <th className="px-4 py-2 text-left">Break Duration</th>
            <th className="px-4 py-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => {
            const onBreak = !!team.break_start;
            const duration = onBreak ? formatDuration(team.break_start) : "00:00:00";
            const longBreak =
              onBreak &&
              dayjs().diff(dayjs(team.break_start), "minute") >= LONG_BREAK_MINUTES;

            return (
              <tr
                key={team.id}
                className={`${longBreak ? "bg-red-100" : ""} border-b`}
              >
                <td className="px-4 py-2">{team.name}</td>
                <td className="px-4 py-2">{team.email}</td>
                <td className="px-4 py-2">
                  {onBreak ? (
                    <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-sm">
                      Yes
                    </span>
                  ) : (
                    <span className="bg-green-200 text-green-800 px-2 py-1 rounded-full text-sm">
                      No
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 font-mono">{duration}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handlePunch(team)}
                    className={`px-3 py-1 rounded ${
                      onBreak ? "bg-red-500 text-white" : "bg-green-500 text-white"
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
