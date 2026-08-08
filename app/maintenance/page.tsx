import { Wrench } from 'lucide-react'
import { LogoMark } from '@/components/landing/logo-mark'

export const metadata = {
  title: 'Maintenance en cours',
}

export default function MaintenancePage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <LogoMark />
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-kin-hover p-8 transition-smooth">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-7 h-7 text-primary" />
          </div>

          <h1 className="text-lg font-serif font-bold text-foreground mb-2">
            Maintenance en cours
          </h1>
          <p className="text-sm text-muted-foreground">
            Kininaru est en cours de mise à jour. L'application sera de retour dans quelques
            instants — merci de votre patience.
          </p>
        </div>
      </div>
    </div>
  )
}
