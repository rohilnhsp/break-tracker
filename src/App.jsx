import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";

const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";

const supabase = createClient(supabaseUrl, supabaseKey);

const BREAK_THRESHOLD_MINUTES = 30; // Highlight users on break > 30 mins

export default function App() {
  const [teams, setTeams] = useState([]);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoadingUser(false);
    };
    fetchUser();
  }, []);

  // Fetch team data
  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("name", { ascending: true });

    if (!error) setTeams(data);
    else console.error("Error fetching teams:", error);
  };

  useEffect(() => {
    fetchTeams();

    // Subscribe to realtime updates
    const subscription = supabase
      .channel("public:teams")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, payload => {
        fetchTeams();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Punch In / Punch Out
  const toggleBreak = async (team) => {
    const isOnBreak = !!team.break_start && !team.break_end;
    const update = isOnBreak
      ? { break_end: new Date().toISOString() }
      : { break_start: new Date().toISOString(), break_end: null };

    try {
      await supabase
        .from("teams")
        .update(update)
        .eq("id", team.id);
    } catch (err) {
      console.error("Error updating break:", err);
    }
  };

  // Live timer in HH:MM:SS
  const getBreakDuration = (start, end) => {
    if (!start) return "00:00:00";
    const startTime = dayjs(start);
    const endTime = end ? dayjs(end) : dayjs();
    const diffSeconds = endTime.diff(startTime, "second");

    const hours = String(Math.floor(diffSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((diffSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(diffSeconds % 60).padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
  };

  // Auto update timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTeams(t => [...t]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // CSV download (pure JS)
  const downloadCSV = (period) => {
    let filteredTeams = [...teams];

    const now = dayjs();
    filteredTeams = filteredTeams.filter(team => {
      if (!team.break_start) return false;
      const breakStart = dayjs(team.break_start);
      if (period === "day") return breakStart.isSame(now, "day");
      if (period === "week") return breakStart.isSame(now, "week");
      if (period === "month") return breakStart.isSame(now, "month");
      return true;
    });

    const headers = ["Name", "Email", "On Break", "Break Duration"];
    const rows = filteredTeams.map(t => [
      t.name,
      t.email,
      !!t.break_start && !t.break_end ? "Yes" : "No",
      getBreakDuration(t.break_start, t.break_end),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `breaks_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loadingUser) return <div className="p-4">Loading user...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Team Break Dashboard</h1>

      {user?.role === "admin" || user?.role === "manager" ? (
        <div className="mb-4">
          <span className="mr-2 font-semibold">Export:</span>
          <button
            onClick={() => downloadCSV("day")}
            className="bg-blue-500 text-white px-3 py-1 rounded mr-2"
          >
            Day
          </button>
          <button
            onClick={() => downloadCSV("week")}
            className="bg-green-500 text-white px-3 py-1 rounded mr-2"
          >
            Week
          </button>
          <button
            onClick={() => downloadCSV("month")}
            className="bg-purple-500 text-white px-3 py-1 rounded"
          >
            Month
          </button>
        </div>
      ) : null}

      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border p-2">Name</th>
            <th className="border p-2">Email</th>
            <th className="border p-2">On Break</th>
            <th className="border p-2">Break Duration</th>
            <th className="border p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {teams.map(team => {
            const duration = getBreakDuration(team.break_start, team.break_end);
            const onBreak = !!team.break_start && !team.break_end;
            const highlight = onBreak && dayjs().diff(dayjs(team.break_start), "minute") >= BREAK_THRESHOLD_MINUTES;

            return (
              <tr key={team.id} className={highlight ? "bg-red-100" : ""}>
                <td className="border p-2">{team.name}</td>
                <td className="border p-2">{team.email}</td>
                <td className="border p-2">{onBreak ? "Yes" : "No"}</td>
                <td className="border p-2 font-mono">{duration}</td>
                <td className="border p-2">
                  <button
                    onClick={() => toggleBreak(team)}
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
