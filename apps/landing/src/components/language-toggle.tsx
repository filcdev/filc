import { useLanguage } from '@/lib/language'
import { Button } from '@filc/ui/components/button'

export const LanguageSwitcher = () => {
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
