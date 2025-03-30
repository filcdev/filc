// https://docs.expo.dev/router/advanced/authentication/

import { useContext, createContext, type PropsWithChildren } from 'react';
import { useStorageState } from '../hooks/useStorageState';
import { useRouter } from 'expo-router';

const AuthContext = createContext<{
  signIn: () => void;
  signOut: () => void;
  session?: string | null;
  isLoading: boolean;
}>({
  signIn: () => null,
  signOut: () => null,
  session: null,
  isLoading: false,
});

// This hook can be used to access the user info.
export function useSession() {
  const value = useContext(AuthContext);
  if (process.env.NODE_ENV !== 'production') {
    if (!value) {
      throw new Error('useSession must be wrapped in a <SessionProvider />');
    }
  }
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [[isLoading, session], setSession] = useStorageState('session');
  const router = useRouter();

  return (
    <AuthContext.Provider
      value={{
        /*mock authentication handler ide majd backend integration*/
        signIn: () => {
          setSession('mock-session-token');
        },
        signOut: () => {
          setSession(null);
          router.replace('/');
        },
        session,
        isLoading,
      }}>
      {children}
    </AuthContext.Provider>
  );
}
