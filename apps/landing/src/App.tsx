import './App.css'
import { logo } from '@filc/ui'

const App = () => {
  return (
    <div className='min-h-dvh flex flex-col'>
      <header className='container mx-auto py-6 px-4 flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <img src={logo} alt='Logo' className='h-8 w-8 scale-150' />
          <span className='text-2xl font-bold'>Filc</span>
        </div>
      </header>

      <main className='flex-1 container mx-auto px-4 py-12 flex flex-col items-center justify-center text-center'>
        <div className='max-w-3xl mx-auto'>
          <div className='mb-8 inline-flex items-center justify-center px-4 py-2 rounded-full bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-medium'>
            Coming Soon
          </div>

          <h1 className='text-4xl md:text-6xl font-bold tracking-tight mb-6'>
            We promise...
          </h1>

          <p className='text-xl mb-12 max-w-2xl mx-auto'>
            Stay tuned for our launch!
          </p>
        </div>
      </main>

      <footer className='container mx-auto py-8 px-4 border-t'>
        <div className='flex flex-col md:flex-row justify-between items-center'>
          <div className='flex items-center gap-2 mb-4 md:mb-0'>
            <img src={logo} alt='Logo' className='h-8 w-8 scale-150' />
            <span className='text-lg font-semibold'>Filc</span>
          </div>

          <p className='text-sm'>&copy; {new Date().getFullYear()} filcdev</p>
        </div>
      </footer>
    </div>
  )
}

export default App
