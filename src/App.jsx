import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

dayjs.extend(utc);
dayjs.extend(timezone);

function Dashboard() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('id, name, email, is_admin, attendance:punch_in,attendance:punch_out')
      .order('name');

    if (error) {
      console.error(error);
    } else {
      const membersData = data.map(member => {
        const punchIn = member.attendance?.punch_in;
        const punchOut = member.attendance?.punch_out;
        const onBreak = punchIn && !punchOut;
        const breakDuration = onBreak
          ? dayjs().tz('Europe/London').diff(dayjs(punchIn).tz('Europe/London'), 'minute')
          : punchIn && punchOut
          ? dayjs(punchOut).tz('Europe/London').diff(dayjs(punchIn).tz('Europe/London'), 'minute')
          : 0;
        return { ...member, onBreak, breakDuration };
      });
      setMembers(membersData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
    const interval = setInterval(fetchMembers, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  const handlePunch = async (email) => {
    try {
      await supabase.rpc('punch_action', { member_email: email });
      setMembers(prev =>
        prev.map(m => m.email === email ? { ...m, onBreak: !m.onBreak, breakDuration: 0 } : m)
      );
    } catch (err) {
      console.error('Error punching:', err.message);
    }
  };

  const exportData = () => {
    if (!members.length) return alert('No data to export');
    const rows = members.map(m => ({
      Name: m.name,
      Email: m.email,
      'On Break': m.onBreak ? 'Yes' : 'No',
      'Break Duration (mins)': m.breakDuration
    }));
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'break_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container">
      <h1>Team Break Dashboard</h1>
      <button onClick={exportData}>Export Data</button>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>On Break</th>
            <th>Break Duration (mins)</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {members.map(member => (
            <tr key={member.id}>
              <td>{member.name}</td>
              <td>{member.email}</td>
              <td>{member.onBreak ? 'Yes' : 'No'}</td>
              <td>{member.breakDuration}</td>
              <td>
                <button onClick={() => handlePunch(member.email)}>
                  {member.onBreak ? 'Punch Out' : 'Punch In'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Admin() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [members, setMembers] = useState([]);

  const fetchMembers = async () => {
    const { data } = await supabase.from('team_members').select('*');
    setMembers(data || []);
  };

  useEffect(() => { fetchMembers(); }, []);

  const addMember = async () => {
    try {
      await supabase.from('team_members').insert([{ name, email, is_admin: false }]);
      setName(''); setEmail('');
      fetchMembers();
    } catch (err) { console.error(err); }
  };

  const removeMember = async (id) => {
    try {
      await supabase.from('team_members').delete().eq('id', id);
      fetchMembers();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="container">
      <h1>Admin Panel</h1>
      <div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        <button onClick={addMember}>Add Member</button>
      </div>
      <h2>Team Members</h2>
      <ul>
        {members.map(m => (
          <li key={m.id}>
            {m.name} ({m.email}) <button onClick={() => removeMember(m.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
