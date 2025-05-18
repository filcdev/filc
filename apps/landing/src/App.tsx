import './App.css'

import { Button } from '@filc/ui/components/button'
import { Logo } from '@filc/ui/components/logo'
import LanguageSwitcher from './LanguageSwitcher'
import GithubTicker from './components/github'
import { LanguageProvider, useLanguage } from './lib/language'

const AppContent = () => {
  const { get } = useLanguage()

  return (
    <div className='min-h-dvh flex flex-col'>
      <header className='container mx-auto py-6 px-4 flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Logo className='h-8 w-8 scale-150' />
          <span className='text-2xl font-bold'>Filc</span>
        </div>
        <LanguageSwitcher />
      </header>

      <main className='flex-1 container mx-auto px-4 py-12 flex flex-col items-center justify-center text-center'>
        <h1 className='text-3xl md:text-6xl font-bold tracking-tight mb-6 md:mb-2'>
          {get('title')}
        </h1>

        <h2 className='text-xl md:text-2xl font-semibold mb-8'>
          {get('subtitle')}
        </h2>

        <GithubTicker />

        <Button
          variant='default'
          size='lg'
          onClick={() => document.location.replace('https://app.filc.space')}
        >
          {get('button')}
        </Button>
      </main>

      <footer className='container mx-auto py-8 px-4 border-t'>
        <div className='flex flex-col md:flex-row justify-between items-center'>
          <div className='flex items-center gap-2 mb-4 md:mb-0'>
            <Logo className='h-8 w-8 scale-150' />
            <span className='text-lg font-semibold'>Filc</span>
          </div>

          <p className='text-sm'>&copy; {new Date().getFullYear()} filcdev</p>
        </div>
      </footer>
    </div>
  )
}

const App = () => (
  <LanguageProvider>
    <AppContent />
  </LanguageProvider>
)

export default App
