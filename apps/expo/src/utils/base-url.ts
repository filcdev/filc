import Constants from 'expo-constants'

export const getBaseUrl = () => {
  const debuggerHost = Constants.expoConfig?.hostUri
  const localhost = debuggerHost?.split(':')[0]

  if (!localhost) {
    // We could not find localhost, so we need to throw an error.
    throw new Error(
      'Failed to get localhost. Please point to your production server.'
    )
  }
  return `http://${localhost}:4000/trpc`
}
