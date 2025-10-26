import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

function App() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // for live updates

  // Fetch teams from Supabase
  const fetchTeams = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching teams:", error.message);
    } else {
      setTeams(data);
    }
    setLoading(false);
  };

  // Update break status
  const toggleBreak = async (team) => {
    const now = new Date().toISOString();
    const on_break = !team.on_break;

    const { data, error } = await supabase
      .from("teams")
      .update({
        on_break,
        break_start: on_break ? now : null,
      })
      .eq("id", team.id);

    if (error) {
      console.error("Error updating break:", error.message);
    } else {
      fetchTeams(); // refresh list
    }
  };

  // Compute live break duration in minutes
  const computeDuration = (team) => {
    if (!team.on_break || !team.break_start) return 0;
    const start = new Date(team.break_start);
    const now = new Date();
    return Math.floor((now - start) / 1000 / 60);
  };

  // Initial fetch
  useEffect(() => {
    fetchTeams();
  }, []);

  // Auto-refresh every minute
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p className="p-4">Loading teams...</p>;

  return (
    <div className="p-6 font-sans">
      <h1 className="text-2xl font-bold mb-4">Team Break Dashboard</h1>

      <table className="min-w-full border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2">Name</th>
            <th className="border px-4 py-2">Email</th>
            <th className="border px-4 py-2">On Break</th>
            <th className="border px-4 py-2">Break Duration (mins)</th>
            <th className="border px-4 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.id}>
              <td className="border px-4 py-2">{team.name}</td>
              <td className="border px-4 py-2">{team.email}</td>
              <td className="border px-4 py-2">{team.on_break ? "Yes" : "No"}</td>
              <td className="border px-4 py-2">{computeDuration(team)}</td>
              <td className="border px-4 py-2">
                <button
                  onClick={() => toggleBreak(team)}
                  className={`px-3 py-1 rounded ${
                    team.on_break ? "bg-red-500 text-white" : "bg-green-500 text-white"
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
