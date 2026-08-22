'use client'

import { createContext, useContext } from 'react'

interface AiSidePanelContextValue {
  /** When true, AppShell renders AIAssistantClient as an inline side panel. */
  active: boolean
}

const AiSidePanelContext = createContext<AiSidePanelContextValue>({ active: false })

export function AiSidePanelProvider({ children }: { children: React.ReactNode }) {
  return (
    <AiSidePanelContext.Provider value={{ active: true }}>
      {children}
    </AiSidePanelContext.Provider>
  )
}

export function useAiSidePanel() {
  return useContext(AiSidePanelContext)
}
