import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

const LONG_BREAK_MINUTES = 30; // Highlight users on break longer than 30 mins

function App() {
  const [teams, setTeams] = useState([]);

  // Fetch initial data
  useEffect(() => {
    const fetchTeams = async () => {
      const { data, error } = await supabase.from("teams").select("*");
      if (error) console.error(error);
      else setTeams(data);
    };
    fetchTeams();

    // Realtime subscription for changes in teams table
    const subscription = supabase
      .from("teams")
      .on("*", (payload) => {
        setTeams((prev) => {
          const index = prev.findIndex((t) => t.id === payload.new.id);
          if (index === -1) return [...prev, payload.new];
          const updated = [...prev];
          updated[index] = payload.new;
          return updated;
        });
      })
      .subscribe();

    return () => supabase.removeSubscription(subscription);
  }, []);

  // Live timer update every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTeams((prev) => [...prev]); // trigger re-render
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleBreak = async (team) => {
    const now = new Date().toISOString();
    const on_break = !team.on_break;

    const { data, error } = await supabase
      .from("teams")
      .update({ on_break, break_start: on_break ? now : null })
      .eq("id", team.id)
      .select(); // return updated row

    if (error) {
      console.error("Error updating break:", error.message);
      return;
    }

    if (data && data.length > 0) {
      setTeams((prev) =>
        prev.map((t) => (t.id === team.id ? data[0] : t))
      );
    }
  };

  const formatDuration = (start) => {
    if (!start) return "00:00:00";
    const diff = dayjs().diff(dayjs(start));
    const dur = dayjs.duration(diff);
    return dur.format("HH:mm:ss");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">Team Break Dashboard</h1>
      <table className="min-w-full bg-white shadow rounded-lg overflow-hidden">
        <thead className="bg-gray-200">
          <tr>
            <th className="py-2 px-4 text-left">Name</th>
            <th className="py-2 px-4 text-left">Email</th>
            <th className="py-2 px-4 text-left">On Break</th>
            <th className="py-2 px-4 text-left">Break Duration</th>
            <th className="py-2 px-4 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => {
            const breakDuration = formatDuration(team.break_start);
            const breakMinutes = team.break_start
              ? dayjs().diff(dayjs(team.break_start), "minute")
              : 0;
            const isLongBreak = breakMinutes >= LONG_BREAK_MINUTES;

            return (
              <tr
                key={team.id}
                className={`border-b ${
                  isLongBreak ? "bg-red-100" : "bg-white"
                }`}
              >
                <td className="py-2 px-4">{team.name}</td>
                <td className="py-2 px-4">{team.email}</td>
                <td className="py-2 px-4">
                  {team.on_break ? (
                    <span className="bg-yellow-200 text-yellow-800 py-1 px-2 rounded-full">
                      Yes
                    </span>
                  ) : (
                    <span className="bg-green-200 text-green-800 py-1 px-2 rounded-full">
                      No
                    </span>
                  )}
                </td>
                <td className="py-2 px-4 font-mono">{breakDuration}</td>
                <td className="py-2 px-4">
                  <button
                    className={`py-1 px-3 rounded text-white ${
                      team.on_break ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
                    }`}
                    onClick={() => toggleBreak(team)}
                  >
                    {team.on_break ? "Punch Out" : "Punch In"}
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

export default App;
