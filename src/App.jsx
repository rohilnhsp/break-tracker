import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

function App() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch teams from Supabase
  const fetchTeams = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("name", { ascending: true });

    if (error) console.error("Error fetching teams:", error.message);
    else setTeams(data);

    setLoading(false);
  };

  // Toggle break status
  const toggleBreak = async (team) => {
    const now = new Date().toISOString();
    const on_break = !team.on_break;

    const { error } = await supabase
      .from("teams")
      .update({ on_break, break_start: on_break ? now : null })
      .eq("id", team.id);

    if (error) console.error("Error updating break:", error.message);
  };

  // Format duration to HH:MM:SS
  const formatDuration = (breakStart) => {
    if (!breakStart) return "00:00:00";
    const start = new Date(breakStart);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000); // seconds

    const hours = String(Math.floor(diff / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
    const seconds = String(diff % 60).padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
  };

  // Initial fetch & Realtime subscription
  useEffect(() => {
    fetchTeams();

    const subscription = supabase
      .channel("public:teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          setTeams((prev) => {
            const updatedTeam = payload.new;
            const index = prev.findIndex((t) => t.id === updatedTeam.id);

            if (index !== -1) {
              const newTeams = [...prev];
              newTeams[index] = updatedTeam;
              return newTeams;
            } else if (payload.eventType === "INSERT") {
              return [...prev, updatedTeam];
            } else if (payload.eventType === "DELETE") {
              return prev.filter((t) => t.id !== payload.old.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  // Live timer update every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTeams((prev) =>
        prev.map((team) => {
          if (team.on_break && team.break_start) {
            return { ...team }; // triggers re-render for live timer
          }
          return team;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (loading) return <p className="p-4">Loading teams...</p>;

  return (
    <div className="p-6 font-sans bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Team Break Dashboard
      </h1>

      <table className="min-w-full border border-gray-300 shadow-sm rounded-lg overflow-hidden">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 border-b">Name</th>
            <th className="px-4 py-2 border-b">Email</th>
            <th className="px-4 py-2 border-b">On Break</th>
            <th className="px-4 py-2 border-b">Break Duration</th>
            <th className="px-4 py-2 border-b">Action</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">{team.name}</td>
              <td className="border px-4 py-2">{team.email}</td>
              <td className="border px-4 py-2">
                {team.on_break ? (
                  <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                    On Break
                  </span>
                ) : (
                  <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                    Working
                  </span>
                )}
              </td>
              <td className="border px-4 py-2 font-mono">
                {formatDuration(team.break_start)}
              </td>
              <td className="border px-4 py-2">
                <button
                  onClick={() => toggleBreak(team)}
                  className={`px-4 py-2 rounded font-semibold ${
                    team.on_break
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  {team.on_break ? "Punch Out" : "Punch In"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
