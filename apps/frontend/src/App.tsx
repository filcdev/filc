import Auth from './components/Auth'
import { useAuth } from './lib/auth'

const Index = () => {
  const { user, logout, token } = useAuth()

  if (!user) return <Auth />

  return (
    <div>
      {JSON.stringify(user)}
      {token}
      {<p>Logged in as {user.email}</p>}
      {<p>Logged in as {user.username}</p>}
      <button onClick={logout}>Logout</button>
    </div>
  )
}

export default Index
