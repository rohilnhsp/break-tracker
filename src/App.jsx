import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient'; // your supabase client
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
dayjs.extend(duration);

const LONG_BREAK_MINUTES = 30; // highlight users on break longer than this

export default function App() {
  const [teams, setTeams] = useState([]);

  // Fetch initial team data
  useEffect(() => {
    const fetchTeams = async () => {
      const { data, error } = await supabase.from('teams').select('*');
      if (!error) setTeams(data);
    };
    fetchTeams();
  }, []);

  // Realtime subscription using Supabase v2 syntax
  useEffect(() => {
    const channel = supabase
      .channel('public:teams')
      .on(
        'postgres_changes',
        {
          event: '*', // listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'teams',
        },
        (payload) => {
          setTeams((prev) => {
            const index = prev.findIndex((t) => t.id === payload.new?.id);
            if (payload.eventType === 'DELETE') {
              return prev.filter((t) => t.id !== payload.old.id);
            }
            if (index === -1) return [...prev, payload.new];
            const updated = [...prev];
            updated[index] = payload.new;
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel); // cleanup
    };
  }, []);

  // Handle punch in/out
  const toggleBreak = async (team) => {
    const isOnBreak = !!team.break_start;
    const now = new Date().toISOString();

    const updates = isOnBreak
      ? { break_start: null, break_end: now } // punch out
      : { break_start: now, break_end: null }; // punch in

    await supabase.from('teams').update(updates).eq('id', team.id);
  };

  // Live HH:MM:SS timer
  const getBreakDuration = (team) => {
    if (!team.break_start) return '00:00:00';
    const start = dayjs(team.break_start);
    const end = team.break_end ? dayjs(team.break_end) : dayjs();
    const diff = dayjs.duration(end.diff(start));
    const hours = String(diff.hours()).padStart(2, '0');
    const minutes = String(diff.minutes()).padStart(2, '0');
    const seconds = String(diff.seconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Force update every second for live timers
  useEffect(() => {
    const interval = setInterval(() => {
      setTeams((prev) => [...prev]); // trigger re-render
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Team Break Dashboard</h1>
      <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
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
            const isLongBreak =
              team.break_start &&
              dayjs().diff(dayjs(team.break_start), 'minute') >= LONG_BREAK_MINUTES;
            return (
              <tr
                key={team.id}
                className={`border-b ${
                  isLongBreak ? 'bg-red-100 font-semibold' : ''
                }`}
              >
                <td className="px-4 py-2">{team.name}</td>
                <td className="px-4 py-2">{team.email}</td>
                <td className="px-4 py-2">
                  {team.break_start ? (
                    <span className="bg-green-200 text-green-800 px-2 py-1 rounded-full text-sm">
                      Yes
                    </span>
                  ) : (
                    <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded-full text-sm">
                      No
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {team.break_start ? (
                    <span className="text-blue-600 font-mono">
                      {getBreakDuration(team)}
                    </span>
                  ) : (
                    '00:00:00'
                  )}
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggleBreak(team)}
                    className={`px-3 py-1 rounded ${
                      team.break_start
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    {team.break_start ? 'Punch Out' : 'Punch In'}
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
