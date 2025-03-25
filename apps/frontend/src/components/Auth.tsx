import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/lib/auth'
import { TRPCClientError } from '@trpc/client'
import { toast } from 'sonner'

import BlobBackground from './ui/blob-background'

type AuthState = 'login' | 'register'

const Auth = () => {
  const { login, register } = useAuth()
  const [isPending, setIsPending] = useState(false)
  const [password, setPassword] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [authState, setAuthState] = useState<AuthState>('login')
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  })

  useEffect(() => {
    if (authState !== 'register') return

    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    }

    setPasswordChecks(checks)

    const passedChecks = Object.values(checks).filter(Boolean).length
    setPasswordStrength((passedChecks / 5) * 100)
  }, [password, authState])

  const getStrengthColor = () => {
    if (passwordStrength <= 20) return 'bg-red-500'
    if (passwordStrength <= 40) return 'bg-orange-500'
    if (passwordStrength <= 60) return 'bg-yellow-500'
    if (passwordStrength <= 80) return 'bg-green-300'
    return 'bg-green-500'
  }

  const getStrengthText = () => {
    if (passwordStrength <= 20) return 'Nagyon gyenge'
    if (passwordStrength <= 40) return 'Gyenge'
    if (passwordStrength <= 60) return 'Közepes'
    if (passwordStrength <= 80) return 'Erős'
    return 'Nagyon erős'
  }

  const onSubmit = async (e: React.FormEvent) => {
    setIsPending(true)
    e.preventDefault()
    try {
      if (authState === 'login') {
        await login({ email, password })
      } else {
        // Check if all requirements are met
        if (Object.values(passwordChecks).some((check) => !check)) {
          toast.error('A jelszó nem felel meg az összes követelménynek')
          setIsPending(false)
          return
        }

        await register({ email, password })
        toast.success(
          'Regisztráció sikeres! Ellenőrizd az email fiókod a megerősítő linkért.'
        )
      }
    } catch (err) {
      if (err instanceof TRPCClientError) {
        // try parsing it as JSON
        try {
          const parsedError = JSON.parse(err.message) as Zod.ZodError[]
          if (parsedError.length > 0) {
            toast.error(parsedError[0]?.message)
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_err) {
          // guess it wasn't JSON
          toast.error(err.message)
        }
      } else {
        toast.error('Hiba történt a bejelentkezés során')
      }
    } finally {
      setIsPending(false)
    }
  }

  return (
    <main className="flex grow items-center justify-center">
      <BlobBackground />
      <Card className="min-w-md z-3 bg-background/80">
        <CardHeader>
          <CardTitle>
            {authState === 'login' ? 'Bejelentkezés' : 'Regisztráció'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@petrik.hu"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Jelszó</Label>
                  {authState === 'login' ? (
                    <a
                      href="#"
                      className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    >
                      {/* TODO: Implement forgotten password functionality */}
                      Elfelejtett jelszó?
                    </a>
                  ) : null}
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                {authState === 'register' && (
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between text-xs">
                      <span>Jelszó erőssége:</span>
                      <span>{getStrengthText()}</span>
                    </div>
                    <Progress
                      value={passwordStrength}
                      className={`h-2 ${getStrengthColor()}`}
                    />

                    <div className="mt-3 space-y-1">
                      <p className="text-sm font-medium">
                        A jelszónak tartalmaznia kell:
                      </p>
                      <ul className="space-y-1 text-xs">
                        <li
                          className={
                            passwordChecks.length
                              ? 'text-green-500'
                              : 'text-gray-500'
                          }
                        >
                          ✓ Legalább 8 karaktert
                        </li>
                        <li
                          className={
                            passwordChecks.uppercase
                              ? 'text-green-500'
                              : 'text-gray-500'
                          }
                        >
                          ✓ Legalább egy nagybetűt (A-Z)
                        </li>
                        <li
                          className={
                            passwordChecks.lowercase
                              ? 'text-green-500'
                              : 'text-gray-500'
                          }
                        >
                          ✓ Legalább egy kisbetűt (a-z)
                        </li>
                        <li
                          className={
                            passwordChecks.number
                              ? 'text-green-500'
                              : 'text-gray-500'
                          }
                        >
                          ✓ Legalább egy számot (0-9)
                        </li>
                        <li
                          className={
                            passwordChecks.special
                              ? 'text-green-500'
                              : 'text-gray-500'
                          }
                        >
                          ✓ Legalább egy speciális karaktert (!@#$%^&*)
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={
                  isPending ||
                  (authState === 'register' && passwordStrength < 100)
                }
              >
                {isPending
                  ? 'Várj...'
                  : authState === 'login'
                    ? 'Bejelentkezés'
                    : 'Regisztráció'}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              {authState === 'login' ? 'Még nincs fiókod?' : 'Már van fiókod?'}{' '}
              <a
                href="#"
                className="underline underline-offset-4"
                onClick={(e) => {
                  e.preventDefault()
                  setAuthState(authState === 'login' ? 'register' : 'login')
                }}
              >
                {authState === 'login' ? 'Regisztrálj most!' : 'Jelentkezz be!'}
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

export default Auth
