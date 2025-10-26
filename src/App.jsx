import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

// Initialize Supabase Client (only once)
const supabaseUrl = "https://ulgagdsllwkqxluakifk.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ2FnZHNsbHdrcXhsdWFraWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNjIzNzgsImV4cCI6MjA3NTczODM3OH0.VzHCWzFaVnYdNBrGMag9rYQBon6cERpUaZCPZH_Nurk"; // keep anon key only on client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState("");
  const [timer, setTimer] = useState(0);
  const [punchStatus, setPunchStatus] = useState("Out");
  const [intervalId, setIntervalId] = useState(null);

  // Fetch all users (Admin view)
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("teams").select("*");
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  // Timer system
  useEffect(() => {
    if (punchStatus === "In") {
      const id = setInterval(() => setTimer((t) => t + 1), 1000);
      setIntervalId(id);
      return () => clearInterval(id);
    } else {
      if (intervalId) clearInterval(intervalId);
    }
  }, [punchStatus]);

  // Punch in/out handler
  const handlePunch = () => {
    if (punchStatus === "Out") {
      setPunchStatus("In");
      setTimer(0);
    } else {
      setPunchStatus("Out");
    }
  };

  // Add new user (Admin)
  const handleAddUser = async () => {
    if (!newUser.trim()) return;
    try {
      const { error } = await supabase.from("teams").insert([{ name: newUser }]);
      if (error) throw error;
      setNewUser("");
      fetchUsers();
    } catch (err) {
      console.error("Error adding user:", err);
    }
  };

  // Export CSV
  const handleExport = () => {
    const csv = [
      ["Name", "Status", "Time"],
      ...users.map((u) => [u.name, u.status || "-", u.time || "-"]),
    ]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users_export.csv";
    a.click();
  };

  // Admin login (Generic)
  const handleAdminLogin = async (email, password) => {
    if (email === "admin@supabase.com" && password === "secure123") {
      setAdmin(true);
      await fetchUsers();
    } else {
      alert("Invalid admin credentials");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  if (loading) return <p className="text-center mt-10">Loading...</p>;

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-center">Team Work Tracker</h1>

      {!admin ? (
        <Card className="p-4">
          <CardContent className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Admin Login</h2>
            <Input
              placeholder="Email"
              id="adminEmail"
              defaultValue="admin@supabase.com"
            />
            <Input
              placeholder="Password"
              id="adminPassword"
              type="password"
              defaultValue="secure123"
            />
            <Button
              onClick={() =>
                handleAdminLogin(
                  document.getElementById("adminEmail").value,
                  document.getElementById("adminPassword").value
                )
              }
            >
              Login
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <Button onClick={handlePunch}>
              {punchStatus === "Out" ? "Punch In" : "Punch Out"}
            </Button>
            <p>
              Status:{" "}
              <span
                className={`font-semibold ${
                  punchStatus === "In" ? "text-green-600" : "text-red-600"
                }`}
              >
                {punchStatus}
              </span>
            </p>
            <p className="font-mono">
              Timer: {Math.floor(timer / 60)}m {timer % 60}s
            </p>
          </div>

          <Card className="p-4">
            <CardContent className="flex gap-2">
              <Input
                placeholder="Add user name"
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
              />
              <Button onClick={handleAddUser}>Add</Button>
              <Button variant="secondary" onClick={handleExport}>
                Export CSV
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {users.map((u) => (
              <Card
                key={u.id}
                className={`p-3 ${
                  u.time > 3600 ? "bg-yellow-100" : "bg-white"
                }`}
              >
                <CardContent>
                  <p className="font-semibold">{u.name}</p>
                  <p>Status: {u.status || "Idle"}</p>
                  <p>
                    Time:{" "}
                    {u.time
                      ? `${Math.floor(u.time / 60)}m ${u.time % 60}s`
                      : "N/A"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
