import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import { saveAs } from "file-saver";

dayjs.extend(duration);
dayjs.extend(relativeTime);

const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk";

const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // fallback user for testing or until auth is set up
  const [currentUser, setCurrentUser] = useState({ role: "admin" });

  const timersRef = useRef({}); // keep interval refs per user

  useEffect(() => {
    // Fetch initial teams
    const fetchTeams = async () => {
      const { data, error } = await supabase.from("teams").select("*");
      if (error) {
        console.error("Error fetching teams:", error);
      } else {
        setTeams(data);
      }
      setLoading(false);
    };

    fetchTeams();

    // Subscribe to realtime updates
    const subscription = supabase
      .channel("public:teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          console.log("Realtime update:", payload);
          setTeams((prev) => {
            const updated = [...prev];
            const idx = updated.findIndex((t) => t.id === payload.new.id);
            if (idx >= 0) {
              updated[idx] = payload.new;
            } else {
              updated.push(payload.new);
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  const punchIn = async (team) => {
    const now = new Date().toISOString();
    try {
      const { data, error } = await supabase
        .from("teams")
        .update({ break_start: now, break_end: null })
        .eq("id", team.id)
        .select()
        .single();
      if (error) throw error;
      console.log("Punch In updated:", data);
    } catch (err) {
      console.error("Error updating break:", err);
    }
  };

  const punchOut = async (team) => {
    const now = new Date().toISOString();
    try {
      const { data, error } = await supabase
        .from("teams")
        .update({ break_end: now })
        .eq("id", team.id)
        .select()
        .single();
      if (error) throw error;
      console.log("Punch Out updated:", data);
    } catch (err) {
      console.error("Error updating break:", err);
    }
  };

  const formatDuration = (start, end) => {
    if (!start) return "--:--:--";
    const endTime = end ? dayjs(end) : dayjs();
    const diff = dayjs.duration(endTime.diff(dayjs(start)));
    return `${String(diff.hours()).padStart(2, "0")}:${String(
      diff.minutes()
    ).padStart(2, "0")}:${String(diff.seconds()).padStart(2, "0")}`;
  };

  const handleExport = (type) => {
    if (!["day", "week", "month"].includes(type)) return;
    // filter data for export
    const now = dayjs();
    const filtered = teams.filter((t) => {
      const start = t.break_start ? dayjs(t.break_start) : null;
      if (!start) return false;
      if (type === "day") return start.isSame(now, "day");
      if (type === "week") return start.isSame(now, "week");
      if (type === "month") return start.isSame(now, "month");
      return true;
    });

    const csv = [
      ["Name", "Email", "Break Start", "Break End", "Duration"].join(","),
      ...filtered.map((t) =>
        [
          t.name,
          t.email,
          t.break_start || "",
          t.break_end || "",
          formatDuration(t.break_start, t.break_end),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `breaks-${type}.csv`);
  };

  if (loading) return <div className="p-4">Loading teams...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Team Break Dashboard</h1>

      {currentUser.role === "admin" && (
        <div className="mb-4 flex gap-2">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => handleExport("day")}
          >
            Export Day
          </button>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            onClick={() => handleExport("week")}
          >
            Export Week
          </button>
          <button
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            onClick={() => handleExport("month")}
          >
            Export Month
          </button>
        </div>
      )}

      <table className="min-w-full bg-white border">
        <thead>
          <tr>
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Email</th>
            <th className="border px-2 py-1">On Break</th>
            <th className="border px-2 py-1">Break Duration</th>
            <th className="border px-2 py-1">Action</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => {
            const onBreak = team.break_start && !team.break_end;
            const durationStr = formatDuration(team.break_start, team.break_end);
            const highlightLongBreak = onBreak && dayjs().diff(dayjs(team.break_start), "minute") >= 5; // change X mins here
            return (
              <tr
                key={team.id}
                className={highlightLongBreak ? "bg-red-100" : ""}
              >
                <td className="border px-2 py-1">{team.name}</td>
                <td className="border px-2 py-1">{team.email}</td>
                <td className="border px-2 py-1">
                  {onBreak ? (
                    <span className="px-2 py-1 bg-yellow-200 rounded">Yes</span>
                  ) : (
                    <span className="px-2 py-1 bg-green-200 rounded">No</span>
                  )}
                </td>
                <td className="border px-2 py-1">{durationStr}</td>
                <td className="border px-2 py-1 flex gap-1">
                  {!onBreak ? (
                    <button
                      className="px-2 py-1 bg-blue-500 text-white rounded"
                      onClick={() => punchIn(team)}
                    >
                      Punch In
                    </button>
                  ) : (
                    <button
                      className="px-2 py-1 bg-red-500 text-white rounded"
                      onClick={() => punchOut(team)}
                    >
                      Punch Out
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
