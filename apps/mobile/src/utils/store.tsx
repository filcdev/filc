import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState
} from 'react'
import { appDataDir } from '@tauri-apps/api/path'
import { Client, Store, Stronghold,  } from '@tauri-apps/plugin-stronghold'

interface StrongholdContextType {
  stronghold: Stronghold | null
  client: Client | null
  insertRecord: (key: string, value: string) => Promise<void>
  getRecord: (key: string) => Promise<string | null>
  deleteRecord: (key: string) => Promise<void>
  editRecord: (key: string, value: string) => Promise<void>
}

const stub = (returnType?: any) => {
  return async () => {
    return returnType
  }
}

const StrongholdContext = createContext<StrongholdContextType>({
  stronghold: null,
  client: null,
  insertRecord: stub(),
  getRecord: stub(null),
  deleteRecord: stub(),
  editRecord: stub()
})

export const StrongholdProvider = ({ children }: { children: ReactNode }) => {
  const [stronghold, setStronghold] = useState<Stronghold | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [store, setStore] = useState<Store | null>(null)

  const init = async () => {
    const vaultPath = `${await appDataDir()}/vault.hold`
    const vaultPassword = 'vault password'
    const strongholdInstance = await Stronghold.load(vaultPath, vaultPassword)

    setStronghold(strongholdInstance)

    if (!stronghold) {
      console.error('Failed to load Stronghold')
      return
    }
    console.log('Stronghold loaded successfully')

    let clientInstance: Client
    const clientName = 'filcClient'
    try {
      clientInstance = await stronghold.loadClient(clientName)
      console.log('Client loaded successfully')
    } catch {
      console.warn('Client not found, creating a new one')
      clientInstance = await stronghold.createClient(clientName)
    }
    setClient(clientInstance)
    setStore(clientInstance.getStore())
  }

  useEffect(() => {
    init().catch((err) => {
      console.error('Error initializing Stronghold:', err)
    })
  }, [])

  console.log('Stronghold:', init())
  console.log('Client:', client)

  const insertRecord = async (key: string, value: string) => {
    if (!client || !stronghold || !store) return
    const data = Array.from(new TextEncoder().encode(value))
    await store.insert(key, data)
    await stronghold.save()
  }

  const getRecord = async (key: string) => {
    if (!client || !stronghold || !store) {
      console.warn(
        `Missing ${!client ? 'client' : ''} ${!stronghold ? 'stronghold' : ''} ${!store ? 'store' : ''}`
      )
      await init()
      return null
    }
    const record = await store.get(key)
    return new TextDecoder().decode(new Uint8Array(record || []))
  }

  const deleteRecord = async (key: string) => {
    if (!client || !stronghold || !store) return
    await store.remove(key)
    await stronghold.save()
  }

  const editRecord = async (key: string, value: string) => {
    if (!client || !stronghold || !store) {
      console.warn(
        `Missing ${!client ? 'client' : ''} ${!stronghold ? 'stronghold' : ''} ${!store ? 'store' : ''}`
      )
      return
    }
    await store.remove(key)
    const data = Array.from(new TextEncoder().encode(value))
    await store.insert(key, data)
  }

  return (
    <StrongholdContext.Provider
      value={{
        stronghold,
        client,
        insertRecord,
        getRecord,
        deleteRecord,
        editRecord
      }}
    >
      {children}
    </StrongholdContext.Provider>
  )
}

export const useStronghold = () => {
  const context = useContext(StrongholdContext)
  if (!context) {
    throw new Error('useStronghold must be used within a StrongholdProvider')
  }
  return context
}
