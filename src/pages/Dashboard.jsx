import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Dashboard() {
  const [members, setMembers] = useState([])

  const fetchMembers = async () => {
    const { data, error } = await supabase.from('team_members').select('*').order('name', { ascending: true })
    if (!error) setMembers(data)
  }

  useEffect(() => {
    fetchMembers()
    const interval = setInterval(fetchMembers, 5000)
    return () => clearInterval(interval)
  }, [])

  const handlePunch = async (email) => {
    await supabase.rpc('punch_action', { member_email: email })
    fetchMembers()
  }

  const getDuration = (breakStart) => {
    if (!breakStart) return ''
    const diff = (new Date() - new Date(breakStart)) / 1000
    const m = Math.floor(diff / 60)
    const s = Math.floor(diff % 60)
    return `${m}m ${s}s`
  }

  return (
    <div className="p-6 max-w-4xl mx-auto text-center">
      <h1 className="text-3xl font-bold mb-6">Team Break Tracker</h1>
      <table className="w-full border-collapse border rounded-xl shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">Name</th>
            <th className="border p-2">Status</th>
            <th className="border p-2">Break Duration</th>
            <th className="border p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.id}>
              <td className="border p-2">{m.name}</td>
              <td className="border p-2">{m.on_break ? '🟠 On Break' : '🟢 Available'}</td>
              <td className="border p-2">{m.on_break ? getDuration(m.break_start) : '-'}</td>
              <td className="border p-2">
                <button
                  onClick={() => handlePunch(m.email)}
                  className={`px-3 py-1 rounded text-white ${m.on_break ? 'bg-red-500' : 'bg-green-600'}`}
                >
                  {m.on_break ? 'Punch Out' : 'Punch In'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4">
        <a href="/admin" className="text-blue-500 underline">Admin Login</a>
      </div>
    </div>
  )
}
