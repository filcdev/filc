import dayjs from 'dayjs'
import en from 'dayjs/locale/en'
import hu from 'dayjs/locale/hu'
import relativeTime from 'dayjs/plugin/relativeTime'
import { type ComponentChildren, createContext } from 'preact'
import { useContext, useEffect, useState } from 'preact/hooks'
import { get as cGet, type content } from '../content'

dayjs.extend(relativeTime)

export type Language = 'hu' | 'en'

interface LanguageContextProps {
  language: Language
  setLanguage: (lang: Language) => void
  get: (
    key: keyof (typeof content)[Language],
    replacers?: Record<string, unknown>
  ) => string
}

const LanguageContext = createContext<LanguageContextProps>({
  language: 'hu',
  setLanguage: () => null,
  get: () => '',
})

export const LanguageProvider = ({
  children,
}: { children: ComponentChildren }) => {
  const [language, setLanguage] = useState<Language>('hu')
  const get = cGet.bind(null, language)

  useEffect(() => {
    dayjs.locale(language === 'hu' ? hu : en)
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage, get }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return ctx
}
