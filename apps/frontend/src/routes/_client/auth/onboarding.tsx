import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { TRPCClientError } from '@trpc/client'
import { toast } from 'sonner'

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

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/

const Onboarding = () => {
  const { completeOnboarding, user } = useAuth()
  const trpc = useTRPC()
  const router = useRouter()
  const [username, setUsername] = useState<string>('')
  const [classId, setClassId] = useState<string>('')
  const [isPending, setIsPending] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const classesQuery = useQuery(trpc.class.getAll.queryOptions())

  if (!user) {
    void router.navigate({ to: '/auth' })
  } else if (!user.isEmailVerified) {
    void router.navigate({ to: '/auth/verify' })
  } else if (user.isOnboarded) {
    void router.navigate({ to: '/' })
  }

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setUsername(value)

    if (!value) {
      setUsernameError('Felhasználónév megadása kötelező')
    } else if (value.length < 3) {
      setUsernameError('A felhasználónév legalább 3 karakter hosszú legyen')
    } else if (value.length > 20) {
      setUsernameError('A felhasználónév maximum 20 karakter lehet')
    } else if (!USERNAME_REGEX.test(value)) {
      setUsernameError(
        'A felhasználónév csak betűket, számokat és aláhúzást tartalmazhat'
      )
    } else {
      setUsernameError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Security: Re-validate inputs before submitting
    if (
      !username ||
      username.length < 3 ||
      username.length > 20 ||
      !USERNAME_REGEX.test(username)
    ) {
      toast.error('Kérjük, adj meg egy érvényes felhasználónevet')
      return
    }

    if (!classId) {
      toast.error('Kérjük, válassz osztályt')
      return
    }

    setIsPending(true)
    try {
      await completeOnboarding({ username, classId })
      toast.success('Profilod beállítása sikeres!')
      // TODO: Add navigation to dashboard after successful onboarding
    } catch (err) {
      if (err instanceof TRPCClientError) {
        toast.error(err.message)
      } else {
        toast.error('Hiba történt a profil beállítása során')
      }
    } finally {
      setIsPending(false)
    }
  }

  // If there's an error loading classes, show an error
  if (classesQuery.isError) {
    return (
      <div className="flex flex-1 grow items-center justify-center">
        <Card className="bg-background/80 z-3 min-w-md">
          <CardContent className="p-6">
            <p className="text-center text-red-500">
              Hiba történt. Kérjük, próbáld újra később.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 grow items-center justify-center">
      <Card className="bg-background/80 z-3 min-w-md">
        <CardHeader>
          <CardTitle>Profil beállítása</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-center">
            Kérjük, állítsd be a felhasználóneved és válaszd ki az osztályodat a
            kezdéshez.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label
                  htmlFor="username"
                  className="flex items-center justify-between"
                >
                  <span>Felhasználónév</span>
                  {usernameError && (
                    <span className="text-xs text-red-500">
                      {usernameError}
                    </span>
                  )}
                </Label>
                <Input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="Felhasználónév"
                  className={usernameError ? 'border-red-500' : ''}
                  aria-invalid={!!usernameError}
                  maxLength={20}
                />
                <p className="text-muted-foreground text-xs">
                  Csak betűket, számokat és aláhúzást használhatsz. (3-20
                  karakter)
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="class">Osztály</Label>
                <Select value={classId} onValueChange={setClassId} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Válassz osztályt" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {classesQuery.isLoading ? (
                        <SelectItem disabled value="null">
                          Betöltés...
                        </SelectItem>
                      ) : (
                        classesQuery.data?.map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isPending || !!usernameError || !username || !classId}
              >
                {isPending ? 'Feldolgozás...' : 'Befejezés'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_client/auth/onboarding')({
  component: Onboarding
})
