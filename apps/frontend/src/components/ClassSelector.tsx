import { useTRPC } from '@/utils/trpc'
import { useQuery } from '@tanstack/react-query'

interface ClassSelectorProps {
  onChange: (classId: string) => void
}
const ClassSelector = ({ onChange }: ClassSelectorProps) => {
  const trpc = useTRPC()
  const classesQuery = useQuery({
    ...trpc.class.getAll.queryOptions(),
    staleTime: Infinity,
    refetchOnWindowFocus: false
  })

  return (
    <select
      onChange={(e) => onChange(e.target.value)}
      className="p-3 text-center"
      defaultValue={""}
    >
      <option value="" disabled>
        Válaszd ki az osztályod
      </option>
      {classesQuery.data?.map((classItem) => (
        <option key={classItem.id} value={classItem.id}>
          {classItem.name}
        </option>
      ))}
    </select>
  )
}

export default ClassSelector
