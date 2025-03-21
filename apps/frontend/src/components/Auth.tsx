import { useState } from 'react'
import { useAuth } from '@/utils/auth'
import { TRPCClientError } from '@trpc/client'

import ClassSelector from './ClassSelector'
import TextInput from './TextInput'

type AuthState = 'login' | 'register'

const Auth = () => {
  const { login, register } = useAuth()
  const [password, setPassword] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [username, setUserName] = useState<string>('')
  const [classId, setClassId] = useState<string>('')
  const [error, setError] = useState<string>('')

  const [authState, setAuthState] = useState<AuthState>('login')
  const stateText = authState === 'login' ? 'Bejelentkezés' : 'Regisztráció'

  const onLogin = async () => {
    setError('')
    try {
      await login({ email, password })
    } catch (err: unknown) {
      if (err instanceof TRPCClientError) {
        setError(err.message)
      } else {
        console.error(err)
      }
    }
  }

  const onRegister = async () => {
    setError('')
    try {
      await register({
        email,
        password,
        username,
        classId
      })
    } catch (err: unknown) {
      if (err instanceof TRPCClientError) {
        setError(err.message)
      } else {
        console.error(err)
      }
    }
  }

  return (
    <div className="mx-auto flex h-screen w-[30%] flex-col items-center justify-center gap-5 self-center text-2xl">
      <h2 className="mb-3 text-6xl">{stateText}</h2>
      {error && (
        <div className="mb-3 w-full rounded-md bg-red-100 p-4 text-red-700">
          {error}
        </div>
      )}
      {authState === 'register' && (
        <>
          <ClassSelector onChange={setClassId} />
          <TextInput
            value={username}
            onChange={setUserName}
            placeholder="Felhasználónév"
          />
        </>
      )}
      <TextInput value={email} onChange={setEmail} placeholder="Email" />
      <TextInput
        value={password}
        onChange={setPassword}
        placeholder="Jelszó"
        password
      />
      <div className="flex gap-4 text-center">
        <span>
          {authState === 'login' ? 'Még nincs fiókod?' : 'Már regisztráltál?'}
        </span>
        <span
          className="cursor-pointer select-none text-blue-500 underline hover:text-blue-700"
          onClick={() =>
            setAuthState((prev) => (prev === 'login' ? 'register' : 'login'))
          }
        >
          {authState === 'login' ? 'Regisztálj' : 'Jelentkezz be'}
        </span>
      </div>
      <button
        onClick={authState === 'login' ? onLogin : onRegister}
        className="mt-3 flex w-full cursor-pointer justify-center rounded-md border border-transparent bg-blue-600 py-4 text-xl font-medium text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {stateText}
      </button>
    </div>
  )
}

export default Auth
