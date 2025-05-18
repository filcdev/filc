import { Button } from '@filc/ui/components/button'
import { useLanguage } from './lib/language'

const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage()
  return (
    <Button
      variant='outline'
      size='icon'
      onClick={() => setLanguage(language === 'hu' ? 'en' : 'hu')}
      className='text-sm'
    >
      {language === 'hu' ? '🇭🇺' : '🇬🇧'}
    </Button>
  )
}

export default LanguageSwitcher
