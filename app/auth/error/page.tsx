import Link from 'next/link'
import { LogoMark } from '@/components/landing/logo-mark'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string }>
}) {
  const params = await searchParams
  const error = params.error || "Erreur d'authentification"
  const description =
    params.error_description ||
    "Une erreur s'est produite lors de l'authentification. Veuillez réessayer."

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center mb-6">
          <LogoMark />
        </Link>
        <div className="bg-card border border-border rounded-2xl shadow-kin-hover p-8 text-center transition-smooth">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>

          <h1 className="text-3xl font-serif font-bold text-foreground mb-3">
            {error}
          </h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            {description}
          </p>

          <div className="flex gap-3">
            <Button
              render={<Link href="/auth/login">Retour à la connexion</Link>}
              variant="outline"
              className="flex-1 transition-smooth"
            />
            <Button
              render={<Link href="/auth/sign-up">S'inscrire</Link>}
              className="flex-1 transition-smooth hover:scale-[1.02]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
