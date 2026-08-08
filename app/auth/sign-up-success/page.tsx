import Link from 'next/link'
import { LogoMark } from '@/components/landing/logo-mark'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center mb-6">
          <LogoMark />
        </Link>
        <div className="bg-card border border-border rounded-2xl shadow-kin-hover p-8 text-center transition-smooth">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h1 className="text-3xl font-serif font-bold text-foreground mb-3">
            Check your email
          </h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            {"We've sent you a confirmation email. Please click the link in the email to verify your account and complete your registration."}
          </p>

          <Button
            render={<Link href="/auth/login">Back to login</Link>}
            className="transition-smooth hover:scale-[1.02]"
          />
        </div>
      </div>
    </div>
  )
}
