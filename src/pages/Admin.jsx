import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Admin() {
  const [members, setMembers] = useState([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)

  const handleLogin = () => {
    if (password === 'admin123') setLoggedIn(true)
    else alert('Incorrect password')
  }

  const fetchMembers = async () => {
    const { data } = await supabase.from('team_members').select('*')
    setMembers(data)
  }

  const addMember = async () => {
    await supabase.from('team_members').insert([{ name, email }])
    setEmail('')
    setName('')
    fetchMembers()
  }

  const removeMember = async (id) => {
    await supabase.from('team_members').delete().eq('id', id)
    fetchMembers()
  }

  const exportData = async () => {
    const { data } = await supabase.from('attendance').select(`timestamp, action, team_members(name, email)`)
    if (!data || data.length === 0) return alert('No data to export')
    const csv = [
      ['Name', 'Email', 'Action', 'Timestamp'],
      ...data.map(d => [d.team_members.name, d.team_members.email, d.action, new Date(d.timestamp).toLocaleString('en-GB', { timeZone: 'Europe/London' })])
    ].map(r => r.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `break_data_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  useEffect(() => { if (loggedIn) fetchMembers() }, [loggedIn])

  if (!loggedIn) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl mb-4 font-semibold">Admin Login</h1>
        <input
          type="password"
          placeholder="Enter admin password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="border px-3 py-2 rounded"
        />
        <button onClick={handleLogin} className="ml-2 bg-blue-500 text-white px-4 py-2 rounded">Login</button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto text-center">
      <h1 className="text-2xl mb-4 font-semibold">Admin Panel</h1>
      <div className="mb-4">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name"
          className="border px-3 py-1 rounded mr-2"
        />
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          className="border px-3 py-1 rounded mr-2"
        />
        <button onClick={addMember} className="bg-green-600 text-white px-4 py-1 rounded">Add Member</button>
      </div>
      <table className="w-full border-collapse border rounded-xl shadow">
        <thead className="bg-gray-100">
          <tr><th>Name</th><th>Email</th><th>Action</th></tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.id}>
              <td className="border p-2">{m.name}</td>
              <td className="border p-2">{m.email}</td>
              <td className="border p-2">
                <button onClick={() => removeMember(m.id)} className="bg-red-500 text-white px-3 py-1 rounded">Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={exportData} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">Export CSV</button>
    </div>
  )
}
