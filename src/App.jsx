import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";

const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";

const supabase = createClient(supabaseUrl, supabaseKey);

const LONG_BREAK_MINUTES = 15; // Highlight breaks longer than this

export default function App() {
  const [teams, setTeams] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [exportRange, setExportRange] = useState("day"); // day, week, month

  // Load current user
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUser(data.user || null);
    };
    getUser();
  }, []);

  // Load teams and subscribe to real-time updates
  useEffect(() => {
    fetchTeams();

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

  const fetchTeams = async () => {
    const { data, error } = await supabase.from("teams").select("*");
    if (!error) setTeams(data);
  };

  const updateBreak = async (teamId, onBreak) => {
    try {
      const updateData = onBreak
        ? { break_start: new Date().toISOString(), break_end: null }
        : { break_end: new Date().toISOString() };

      console.log("Updating team:", teamId, updateData);

      const { error } = await supabase
        .from("teams")
        .update(updateData)
        .eq("id", teamId);

      if (error) console.error("Error updating break:", error);
      else fetchTeams();
    } catch (err) {
      console.error("Unexpected error updating break:", err);
    }
  };

  const formatDuration = (start, end) => {
    if (!start) return "00:00:00";
    const diff = dayjs(end || new Date()).diff(dayjs(start));
    const duration = dayjs.duration(diff);
    return [
      String(duration.hours()).padStart(2, "0"),
      String(duration.minutes()).padStart(2, "0"),
      String(duration.seconds()).padStart(2, "0"),
    ].join(":");
  };

  const exportData = () => {
    // Simple CSV export
    const rows = teams.map((t) => [
      t.name,
      t.email,
      t.break_start,
      t.break_end,
      t.break_start
        ? formatDuration(t.break_start, t.break_end || new Date())
        : "00:00:00",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [["Name", "Email", "Break Start", "Break End", "Break Duration"].join(",")]
        .concat(rows.map((r) => r.join(",")))
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `break_data_${exportRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Force re-render every second for live timers
  useEffect(() => {
    const interval = setInterval(() => setTeams((prev) => [...prev]), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!currentUser) return <div className="p-4">Loading user...</div>;

  return (
    <div className="p-4 font-sans">
      <h1 className="text-2xl font-bold mb-4">Team Break Dashboard</h1>

      {(currentUser?.role === "manager" || currentUser?.role === "admin") && (
        <div className="mb-4 flex items-center space-x-4">
          <select
            className="border rounded px-2 py-1"
            value={exportRange}
            onChange={(e) => setExportRange(e.target.value)}
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={exportData}
          >
            Export Data
          </button>
        </div>
      )}

      <table className="min-w-full border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Email</th>
            <th className="border px-2 py-1">On Break</th>
            <th className="border px-2 py-1">Break Duration</th>
            <th className="border px-2 py-1">Action</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => {
            const onBreak = !!team.break_start && !team.break_end;
            const duration = formatDuration(team.break_start, team.break_end || new Date());
            const durationMinutes = team.break_start
              ? dayjs().diff(dayjs(team.break_start), "minute")
              : 0;
            const highlight = onBreak && durationMinutes >= LONG_BREAK_MINUTES;

            return (
              <tr
                key={team.id}
                className={highlight ? "bg-red-100" : ""}
              >
                <td className="border px-2 py-1">{team.name}</td>
                <td className="border px-2 py-1">{team.email}</td>
                <td className="border px-2 py-1">
                  {onBreak ? (
                    <span className="bg-yellow-300 px-2 py-1 rounded">Yes</span>
                  ) : (
                    <span className="bg-green-300 px-2 py-1 rounded">No</span>
                  )}
                </td>
                <td className="border px-2 py-1 font-mono">{duration}</td>
                <td className="border px-2 py-1">
                  <button
                    className={`px-2 py-1 rounded ${
                      onBreak ? "bg-red-500 text-white" : "bg-green-500 text-white"
                    }`}
                    onClick={() => updateBreak(team.id, !onBreak)}
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
