export const content = {
  en: {
    title: 'The best app in the world',
    subtitle: 'Made by petrik students, for petrik students',
    github: 'The last commit was made {time} ago by {user}',
    button: 'Open',
  },
  hu: {
    title: 'A világ legjobb applikációja',
    subtitle: 'Petrikesektől, petrikeseknek',
    github: 'Az utolsó commit {time} történt, {user} által',
    button: 'Megnyitás',
  },
}

export const get = (
  language: 'hu' | 'en',
  key: keyof (typeof content)[typeof language],
  replacers?: Record<string, unknown>
) => {
  const value = content[language][key]
  if (!value) {
    return key
  }
  return Object.entries(replacers || {}).reduce(
    (acc, [placeholder, replacement]) => {
      return acc.replace(
        new RegExp(`{${placeholder}}`, 'g'),
        String(replacement)
      )
    },
    value
  )
}
