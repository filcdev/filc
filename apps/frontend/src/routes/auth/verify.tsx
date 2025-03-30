import { useEffect, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { TRPCClientError } from '@trpc/client'
import { toast } from 'sonner'

import BlobBackground from '@/components/ui/blob-background'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'

interface VerifyEmailProps {
  email?: string
}

const VerifyEmail = ({ email }: VerifyEmailProps) => {
  const { verifyEmail, resendVerification, user } = useAuth()
  const router = useRouter()
  const [token, setToken] = useState<string>('')
  const [isPending, setIsPending] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const userEmail = email ?? user?.email ?? ''

  // Handle cooldown for resending verification email
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    if (resendCooldown > 0) {
      timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1)
      }, 1000)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [resendCooldown])

  if (!user) {
    void router.navigate({ to: '/auth' })
  } else if (user.isEmailVerified) {
    if (user.isOnboarded) void router.navigate({ to: '/' })
    else void router.navigate({ to: '/auth/onboarding' })
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) {
      toast.error('Kérjük, add meg a megerősítő kódot')
      return
    }

    // Security: Ensure token is of reasonable length
    if (token.length < 32) {
      toast.error('Érvénytelen megerősítő kód')
      return
    }

    setIsPending(true)
    try {
      await verifyEmail(token)
      toast.success('Email cím sikeresen megerősítve!')
      // TODO: Add navigation to onboarding after successful verification
    } catch (err) {
      if (err instanceof TRPCClientError) {
        toast.error(err.message)
      } else {
        toast.error('Hiba történt az email cím megerősítése során')
      }
    } finally {
      setIsPending(false)
    }
  }

  const handleResend = async () => {
    if (!userEmail) {
      toast.error('Nem található email cím')
      return
    }

    if (resendCooldown > 0) {
      toast.error(
        `Kérjük várj még ${resendCooldown} másodpercet az újraküldés előtt`
      )
      return
    }

    setIsResending(true)
    try {
      await resendVerification(userEmail)
      toast.success('Megerősítő email újraküldve')
      // Set a 60-second cooldown before allowing another resend
      setResendCooldown(60)
    } catch (err) {
      if (err instanceof TRPCClientError) {
        toast.error(err.message)
      } else {
        toast.error('Hiba történt a megerősítő email újraküldése során')
      }
    } finally {
      setIsResending(false)
    }
  }

  return (
    <main className="flex grow items-center justify-center">
      <BlobBackground />
      <Card className="bg-background/80 z-3 min-w-md">
        <CardHeader>
          <CardTitle>Email cím megerősítése</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-center">
            Küldtünk egy megerősítő emailt a következő címre:{' '}
            <strong className="break-all">{userEmail}</strong>.
            <br />
            Kérjük, ellenőrizd a postaládádat és add meg a megerősítő kódot.
          </p>
          <form onSubmit={handleVerify}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="token">Megerősítő kód</Label>
                <Input
                  id="token"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Megerősítő kód"
                  className="font-mono"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isPending || !token.trim()}
              >
                {isPending ? 'Megerősítés folyamatban...' : 'Megerősítés'}
              </Button>
            </div>
          </form>
          <div className="mt-4 text-center text-sm">
            Nem kaptál emailt?{' '}
            <Button
              variant="link"
              className="p-0"
              disabled={isResending || resendCooldown > 0}
              onClick={handleResend}
            >
              {isResending
                ? 'Küldés...'
                : resendCooldown > 0
                  ? `Újraküldés (${resendCooldown}s)`
                  : 'Újraküldés'}
            </Button>
          </div>
          <div className="text-muted-foreground mt-2 text-center text-xs">
            Ellenőrizd a spam/levélszemét mappát is, ha nem találod az emailt a
            beérkező üzeneteid között.
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

export const Route = createFileRoute('/auth/verify')({
  component: VerifyEmail
})
