import { useTRPC } from "@/lib/trpc"
import { useQuery } from "@tanstack/react-query"
import { Loader } from "lucide-react"

const Substitutions = () => {
  const trpc = useTRPC()
  const substitutionsQuery = useQuery(trpc.substitution.getAll.queryOptions())

  const { data: substitutions, isLoading } = substitutionsQuery

  if (isLoading) {
    return (
        <div className="z-10 flex flex-col items-center justify-center gap-4 text-white">
          <Loader className="size-12 animate-spin" />
          <span className="text-xl font-semibold">Betöltés...</span>
        </div>
    )
  }

  return (
    <div className="flex-1 grow">
      <h1>Helyettesitesek</h1>
      <p>{JSON.stringify(substitutions)}</p>
    </div>
  )
}

export default Substitutions
