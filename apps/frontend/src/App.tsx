import { useState } from "react"
import { useAuth } from "./utils/auth"

export default function Index() {
  const { user, login, logout, token } = useAuth()

  const [email, setEmail] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)

  const onLogin = async () => {
    setLoading(true)
    setError("")
    try {
      await login({ email, password })
    } catch (err) {
      console.error(err)
      setError("Invalid email or password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {JSON.stringify(user)}
      <h1>Welcome to your new app!</h1>
      {token}
      <h2>Login</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={onLogin} disabled={loading}>
        {loading ? "Loading..." : "Login"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <p>
        This is a simple template for a new app. You can start building your
        app here.
      </p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}