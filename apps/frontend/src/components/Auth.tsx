import { useState } from 'react'
import { useAuth } from '@/utils/auth'

import ClassSelector from './ClassSelector'
import TextInput from './TextInput'

type AuthState = 'login' | 'register'

const Auth = () => {
  const { login, register } = useAuth()
  const [password, setPassword] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [username, setUserName] = useState<string>('')
  const [classId, setClassId] = useState<string>('')

  const [authState, setAuthState] = useState<AuthState>('login')
  const stateText = authState === 'login' ? 'Bejelentkezés' : 'Regisztráció'

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
        username,
        classId
      })
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="mx-auto flex h-screen w-[30%] flex-col items-center justify-center gap-5 self-center text-2xl">
      <h2 className="mb-3 text-6xl">{stateText}</h2>
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
        className="mt-3 w-full flex justify-center py-4 border border-transparent rounded-md shadow-sm text-xl font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 cursor-pointer"
      >
        {stateText}
      </button>
    </div>
  )
}

export default Auth