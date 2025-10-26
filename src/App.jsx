import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient"; // Make sure this points to your client file
import dayjs from "dayjs";

export default function App() {
  const [teamData, setTeamData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch teams from Supabase
  const fetchTeams = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("teams").select("*");

    if (error) {
      setError(error.message);
    } else {
      setTeamData(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  // Handle punch in / punch out
  const handlePunch = async (id, isOnBreak) => {
    const now = dayjs().format("YYYY-MM-DD HH:mm:ss");
    let updates = {};

    if (!isOnBreak) {
      // Punch In
      updates = { on_break: true, break_start: now };
    } else {
      // Punch Out
      const member = teamData.find((m) => m.id === id);
      const start = member.break_start;
      const duration = start ? dayjs(now).diff(dayjs(start), "minute") : 0;
      updates = {
        on_break: false,
        break_start: null,
        break_duration: (member.break_duration || 0) + duration,
      };
    }

    const { error } = await supabase.from("teams").update(updates).eq("id", id);
    if (error) {
      alert("Error updating break: " + error.message);
    } else {
      fetchTeams(); // Refresh table
    }
  };

  if (loading) return <p className="p-4">Loading team data...</p>;
  if (error) return <p className="p-4 text-red-600">Error: {error}</p>;

  return (
    <div className="p-6 max-w-5xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-4">Team Break Dashboard</h1>
      <button
        onClick={() => exportData(teamData)}
        className="mb-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Export Data
      </button>
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 rounded shadow-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 border-b">Name</th>
              <th className="py-2 px-4 border-b">Email</th>
              <th className="py-2 px-4 border-b">On Break</th>
              <th className="py-2 px-4 border-b">Break Duration (mins)</th>
              <th className="py-2 px-4 border-b">Action</th>
            </tr>
          </thead>
          <tbody>
            {teamData.map((member, index) => (
              <tr
                key={member.id}
                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="py-2 px-4 border-b">{member.name}</td>
                <td className="py-2 px-4 border-b">{member.email}</td>
                <td className="py-2 px-4 border-b">
                  {member.on_break ? "Yes" : "No"}
                </td>
                <td className="py-2 px-4 border-b">
                  {member.break_duration || 0}
                </td>
                <td className="py-2 px-4 border-b">
                  <button
                    onClick={() => handlePunch(member.id, member.on_break)}
                    className={`px-3 py-1 rounded text-white ${
                      member.on_break ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                    }`}
                  >
                    {member.on_break ? "Punch Out" : "Punch In"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Optional: Export team data to CSV
function exportData(data) {
  const csvContent =
    "data:text/csv;charset=utf-8," +
    ["Name,Email,On Break,Break Duration"]
      .concat(data.map((m) => `${m.name},${m.email},${m.on_break},${m.break_duration || 0}`))
      .join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "team_break_data.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
