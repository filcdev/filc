import { useState } from 'react'
import { useAuth } from '@/utils/auth'

import TextInput from './TextInput'

type AuthState = 'login' | 'register'

const Auth = () => {
  const { login, register } = useAuth()
  const [password, setPassword] = useState<string>('')
  const [email, setEmail] = useState<string>('')

  const [authState, setAuthState] = useState<AuthState>('login')
  const stateText = authState.at(0)?.toUpperCase() + authState.slice(1)

  const onLogin = async () => {
    try {
      await login({ email, password })
    } catch (err) {
      console.error(err)
    }
  }

  const onRegister = async () => {
    try {
      await register({
        email,
        password,
        classId: 'cm8hioyk60000oy8fd53yf6ci',
        username: 'vince'
      })
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="flex h-screen w-[30%] self-center mx-auto flex-col items-center justify-center gap-5 text-2xl">
      <h2 className="text-6xl">{stateText}</h2>
      <TextInput value={email} onChange={setEmail} placeholder="Email" />
      <TextInput
        value={password}
        onChange={setPassword}
        placeholder="Password"
        password
      />
      <div className="flex gap-4 text-center">
        <span>
          {authState === 'login'
            ? "Don't have an account?"
            : 'Already have an account?'}
        </span>
        <span
          className="cursor-pointer text-blue-500 underline hover:text-blue-700"
          onClick={() =>
            setAuthState((prev) => (prev === 'login' ? 'register' : 'login'))
          }
        >
          {authState === 'login' ? 'Register' : 'Login'}
        </span>
      </div>
      <button
        onClick={authState === 'login' ? onLogin : onRegister}
        className="rounded-lg bg-blue-500 px-15 py-5 text-3xl text-white mt-3"
      >
        {stateText}
      </button>
    </div>
  )
}

export default Auth
