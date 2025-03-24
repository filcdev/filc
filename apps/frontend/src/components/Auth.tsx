import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { useTRPC } from '@/lib/trpc'
import { useQuery } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'
import { toast } from "sonner"

type AuthState = 'login' | 'register'

const Auth = () => {
  const { login, register } = useAuth()
  const trpc = useTRPC()
  const [isPending, setIsPending] = useState(false)
  const [password, setPassword] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [username, setUserName] = useState<string>('')
  const [classId, setClassId] = useState<string>('')
  const [authState, setAuthState] = useState<AuthState>('login')

  const classesQuery = useQuery(trpc.class.getAll.queryOptions())

  const onSubmit = async (e: React.FormEvent) => {
    setIsPending(true)
    e.preventDefault()
    try {
      if (authState === 'login') {
        await login({ email, password })
      } else {
        await register({ email, username, password, classId })
      }
    } catch (err) {
      if (err instanceof TRPCClientError) {
        // try parsing it as JSON
        const parsedError = JSON.parse(err.message) as Zod.ZodError[]
        if (parsedError.length > 0) {
          toast.error(parsedError[0]?.message)
        } else {
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
      <div className="bg-background absolute top-0 left-0 h-dvh w-dvw overflow-hidden">
        <div
          className="translate-[-50%] absolute left-[50%] top-[50%] aspect-square h-[40vmax] scale-150 animate-spin rounded-full bg-gradient-to-tr from-green-500 to-blue-500"
          style={{ animationDuration: '5s' }}
        ></div>
        <div className="z-2 absolute h-screen w-screen backdrop-blur-[13vmax]"></div>
      </div>
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
              {authState === 'register' ? (
                <div className="grid gap-2">
                  <Label htmlFor="username">Felhasználónév</Label>
                  <Input
                    id="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Jelszó</Label>
                  {authState === 'login' ? (
                    <a
                      href="#"
                      className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    >
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
              </div>
              {authState === 'register' ? (
                <div className="grid gap-2">
                  <Label htmlFor="username">Osztály</Label>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Válassz osztályt" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {classesQuery.data?.map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending
                  ? 'Várj...'
                  : authState === 'login'
                    ? 'Bejelentkezés'
                    : 'Regisztráció'}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              {authState === 'login'
                ? 'Még nincs fiókod?'
                : 'Már van fiókod?'}{' '}
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
