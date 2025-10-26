import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ---- Supabase Clients ----
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

// public user client
const supabase = createClient(supabaseUrl, anonKey);

// secure admin client (server-side power)
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

const App = () => {
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [error, setError] = useState("");

  // ---- Admin password (you can customize this easily) ----
  const ADMIN_SECRET = "nhsp-admin-2025"; // simple generic admin login

  // ---- Load team members ----
  const fetchTeam = async () => {
    const { data, error } = await supabase.from("team").select("*");
    if (error) console.error(error);
    else setTeam(data || []);
  };

  // ---- Handle Punch In ----
  const handlePunchIn = async (id) => {
    const { error } = await supabase
      .from("team")
      .update({ status: "Working", break_start: null, break_end: null })
      .eq("id", id);
    if (error) console.error(error);
    fetchTeam();
  };

  // ---- Handle Punch Out ----
  const handlePunchOut = async (id) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("team")
      .update({ status: "On Break", break_start: now })
      .eq("id", id);
    if (error) console.error(error);
    fetchTeam();
  };

  // ---- Add User ----
  const handleAddUser = async () => {
    if (!newUserName.trim()) {
      setError("Enter a name first!");
      return;
    }

    const { error } = await supabaseAdmin
      .from("team")
      .insert([{ name: newUserName.trim(), role: newUserRole, status: "Available" }]);

    if (error) {
      console.error(error);
      setError("Error adding user");
    } else {
      setError("");
      setNewUserName("");
      fetchTeam();
    }
  };

  // ---- Export to CSV ----
  const handleExport = (range = "all") => {
    if (!team.length) return alert("No data to export");
    const now = new Date();
    let filtered = team;

    if (range === "day") {
      const today = now.toISOString().split("T")[0];
      filtered = team.filter(
        (m) => (m.break_start || "").startsWith(today) || (m.break_end || "").startsWith(today)
      );
    } else if (range === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      filtered = team.filter(
        (m) => new Date(m.break_start || now) >= weekAgo || new Date(m.break_end || now) >= weekAgo
      );
    } else if (range === "month") {
      const monthAgo = new Date();
      monthAgo.setDate(now.getDate() - 30);
      filtered = team.filter(
        (m) => new Date(m.break_start || now) >= monthAgo || new Date(m.break_end || now) >= monthAgo
      );
    }

    const csv =
      "Name,Role,Status,Break Start,Break End\n" +
      filtered
        .map(
          (m) =>
            `${m.name},${m.role},${m.status || ""},${m.break_start || ""},${m.break_end || ""}`
        )
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `break_data_${range}_${now.toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // ---- Timer for "On Break" highlight ----
  useEffect(() => {
    const interval = setInterval(fetchTeam, 30000); // refresh every 30s
    fetchTeam();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTeam((t) => [...t]), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => setLoading(false), []);

  // ---- UI: Login as Admin ----
  if (!user && !isAdmin && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-80">
          <h1 className="text-xl font-semibold text-center mb-4">Admin / User Access</h1>
          <input
            type="password"
            placeholder="Enter admin password"
            className="w-full mb-3 p-2 rounded bg-gray-700 text-white"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
          <button
            className="w-full bg-blue-600 py-2 rounded hover:bg-blue-700"
            onClick={() => {
              if (adminPassword === ADMIN_SECRET) setIsAdmin(true);
              else alert("Incorrect password — showing user dashboard instead.");
              setUser({ name: "Generic User" });
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ---- Helper for long breaks ----
  const isLongBreak = (member) => {
    if (member.status !== "On Break" || !member.break_start) return false;
    const diff = (Date.now() - new Date(member.break_start)) / 60000; // mins
    return diff > 30;
  };

  // ---- Dashboard ----
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">
        {isAdmin ? "Admin Dashboard" : "User Dashboard"}
      </h1>

      {isAdmin && (
        <div className="bg-gray-800 p-4 rounded-xl mb-6">
          <h2 className="text-lg font-semibold mb-2">Add New User</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 p-2 rounded bg-gray-700"
              placeholder="User name"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
            />
            <select
              className="p-2 rounded bg-gray-700"
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={handleAddUser}
              className="bg-green-600 px-4 py-2 rounded hover:bg-green-700"
            >
              Add
            </button>
          </div>
          {error && <p className="text-red-400 mt-2">{error}</p>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border border-gray-700 rounded-xl">
          <thead className="bg-gray-800">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Role</th>
              <th className="p-2">Status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {team.map((member) => (
              <tr
                key={member.id}
                className={`text-center ${
                  isLongBreak(member)
                    ? "bg-red-800"
                    : member.status === "On Break"
                    ? "bg-yellow-700"
                    : "bg-gray-700"
                }`}
              >
                <td className="p-2">{member.name}</td>
                <td className="p-2 capitalize">{member.role}</td>
                <td className="p-2">{member.status}</td>
                <td className="p-2">
                  {member.status === "On Break" ? (
                    <button
                      onClick={() => handlePunchIn(member.id)}
                      className="bg-blue-600 px-3 py-1 rounded hover:bg-blue-700"
                    >
                      Punch In
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePunchOut(member.id)}
                      className="bg-yellow-600 px-3 py-1 rounded hover:bg-yellow-700"
                    >
                      Punch Out
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div className="flex flex-wrap gap-3 justify-center mt-6">
          <button
            onClick={() => handleExport("day")}
            className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-700"
          >
            Export Day
          </button>
          <button
            onClick={() => handleExport("week")}
            className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-700"
          >
            Export Week
          </button>
          <button
            onClick={() => handleExport("month")}
            className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-700"
          >
            Export Month
          </button>
          <button
            onClick={() => handleExport("all")}
            className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-700"
          >
            Export All
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
