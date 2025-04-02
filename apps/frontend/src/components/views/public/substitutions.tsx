import { useQuery } from '@tanstack/react-query'
import { Loader } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useTRPC } from '@/lib/trpc'

const Substitutions = () => {
  const trpc = useTRPC()
  const { data: substitutions, isLoading } = useQuery(
    trpc.substitution.getAll.queryOptions()
  )

  if (isLoading) {
    return (
      <div className="z-10 flex flex-col items-center justify-center gap-4 text-white">
        <Loader className="size-12 animate-spin" />
        <span className="text-xl font-semibold">Betöltés...</span>
      </div>
    )
  }

  return (
    <div className="bg-background/50 m-4 mx-auto flex max-w-4xl flex-1 grow rounded-lg border px-4 py-1.5">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Óra</TableHead>
            <TableHead>Tantárgy</TableHead>
            <TableHead>Hiányzik</TableHead>
            <TableHead>Helyettesít</TableHead>
            <TableHead className="text-right">Terem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {substitutions?.map((substitution) => (
            <TableRow key={substitution.id}>
              <TableCell className="font-bold">
                {substitution.lesson.lesson}.
              </TableCell>
              <TableCell>{substitution.subject.name}</TableCell>
              <TableCell>{substitution.missingTeacher.name}</TableCell>
              <TableCell>{substitution.teacher.name}</TableCell>
              <TableCell className="text-right">
                {substitution.room.name}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default Substitutions
