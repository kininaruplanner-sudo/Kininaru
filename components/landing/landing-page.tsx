'use client'

import { LandingHeader } from './landing-header'
import { LandingHero } from './landing-hero'
import { LandingFeatures } from './landing-features'
import { LandingStats } from './landing-stats'
import { LandingTestimonials } from './landing-testimonials'
import { LandingFaq } from './landing-faq'
import { LandingCta } from './landing-cta'
import { LandingFooter } from './landing-footer'

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <LandingHeader />
      <main id="main-content">
        <LandingHero />
        <LandingStats />
        <LandingFeatures />
        <LandingTestimonials />
        <LandingFaq />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  )
}
