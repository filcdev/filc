import { WeekType } from '@/lib/editor/conflict'
import { mockCohorts, mockRooms, mockTeachers } from '@/lib/editor/mock'
import { Button } from '@filc/ui/components/button'
import { Checkbox } from '@filc/ui/components/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filc/ui/components/dialog'
import { Input } from '@filc/ui/components/input'
import { Label } from '@filc/ui/components/label'
import { RadioGroup, RadioGroupItem } from '@filc/ui/components/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@filc/ui/components/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@filc/ui/components/tabs'
import { FaRegFile, FaPrint, FaSliders } from 'react-icons/fa6'
import { useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { PrintableTimetable } from './printable-timetable'

interface PrintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentView: 'school' | 'cohort' | 'teacher' | 'room'
  currentSelection?: string
}

export function PrintDialog({
  open,
  onOpenChange,
  currentView,
  currentSelection,
}: PrintDialogProps) {
  const [printView, setPrintView] = useState<
    'school' | 'cohort' | 'teacher' | 'room'
  >(currentView)
  const [selectedItems, setSelectedItems] = useState<string[]>(
    currentSelection ? [currentSelection] : []
  )
  const [weekType, setWeekType] = useState<WeekType>(WeekType.All)
  const [paperSize, setPaperSize] = useState('a4')
  const [orientation, setOrientation] = useState('landscape')
  const [showHeader, setShowHeader] = useState(true)
  const [showFooter, setShowFooter] = useState(true)
  const [headerText, setHeaderText] = useState('School Timetable')
  const [footerText, setFooterText] = useState(
    `Generated on ${new Date().toLocaleDateString()}`
  )
  const [printTab, setPrintTab] = useState('content')

  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'School Timetable',
    onAfterPrint: () => onOpenChange(false),
  })

  const toggleItem = (item: string) => {
    setSelectedItems(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    )
  }

  const selectAll = (items: string[]) => {
    setSelectedItems(items)
  }

  const clearAll = () => {
    setSelectedItems([])
  }

  const getItemsForView = () => {
    switch (printView) {
      case 'cohort':
        return mockCohorts.map(c => c.designation)
      case 'teacher':
        return mockTeachers.map(t => t.name)
      case 'room':
        return mockRooms.map(r => r.name)
      default:
        return []
    }
  }

  const getViewLabel = () => {
    switch (printView) {
      case 'cohort':
        return 'Cohorts'
      case 'teacher':
        return 'Teachers'
      case 'room':
        return 'Rooms'
      case 'school':
        return 'School View'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-3xl max-h-[90vh] overflow-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center'>
            <FaPrint className='mr-2 h-5 w-5' />
            Print Timetable
          </DialogTitle>
        </DialogHeader>

        <Tabs value={printTab} onValueChange={setPrintTab} className='mt-4'>
          <TabsList className='grid grid-cols-2'>
            <TabsTrigger value='content' className='flex items-center'>
              <FaRegFile className='mr-2 h-4 w-4' />
              Content
            </TabsTrigger>
            <TabsTrigger value='settings' className='flex items-center'>
              <FaSliders className='mr-2 h-4 w-4' />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value='content' className='space-y-4 pt-4'>
            <div className='space-y-4'>
              <div>
                <Label className='text-base'>
                  What would you like to print?
                </Label>
                <RadioGroup
                  value={printView}
                  onValueChange={value => {
                    setPrintView(
                      value as 'school' | 'cohort' | 'teacher' | 'room'
                    )
                    setSelectedItems([])
                  }}
                  className='flex flex-col space-y-2 mt-2'
                >
                  <div className='flex items-center space-x-2'>
                    <RadioGroupItem value='school' id='school' />
                    <Label htmlFor='school'>School-wide view</Label>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <RadioGroupItem value='cohort' id='cohort' />
                    <Label htmlFor='cohort'>Cohort view</Label>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <RadioGroupItem value='teacher' id='teacher' />
                    <Label htmlFor='teacher'>Teacher view</Label>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <RadioGroupItem value='room' id='room' />
                    <Label htmlFor='room'>Room view</Label>
                  </div>
                </RadioGroup>
              </div>

              {printView !== 'school' && (
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <Label className='text-base'>Select {getViewLabel()}</Label>
                    <div className='space-x-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => selectAll(getItemsForView())}
                      >
                        Select All
                      </Button>
                      <Button variant='outline' size='sm' onClick={clearAll}>
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className='grid grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded-md p-2'>
                    {getItemsForView().map(item => (
                      <div key={item} className='flex items-center space-x-2'>
                        <Checkbox
                          id={`item-${item}`}
                          checked={selectedItems.includes(item)}
                          onCheckedChange={() => toggleItem(item)}
                        />
                        <Label htmlFor={`item-${item}`} className='text-sm'>
                          {item}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor='weekType' className='text-base'>
                  Week Type
                </Label>
                <Select
                  value={weekType}
                  onValueChange={(v: WeekType) => setWeekType(v)}
                >
                  <SelectTrigger id='weekType'>
                    <SelectValue placeholder='Select week type' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WeekType.A}>Week A</SelectItem>
                    <SelectItem value={WeekType.B}>Week B</SelectItem>
                    <SelectItem value={WeekType.All}>All Weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value='settings' className='space-y-4 pt-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='paperSize'>Paper Size</Label>
                <Select value={paperSize} onValueChange={setPaperSize}>
                  <SelectTrigger id='paperSize'>
                    <SelectValue placeholder='Select paper size' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='a4'>A4</SelectItem>
                    <SelectItem value='letter'>Letter</SelectItem>
                    <SelectItem value='legal'>Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='orientation'>Orientation</Label>
                <Select value={orientation} onValueChange={setOrientation}>
                  <SelectTrigger id='orientation'>
                    <SelectValue placeholder='Select orientation' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='portrait'>Portrait</SelectItem>
                    <SelectItem value='landscape'>Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-2'>
              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='showHeader'
                  checked={showHeader}
                  onCheckedChange={checked => setShowHeader(checked as boolean)}
                />
                <Label htmlFor='showHeader'>Show Header</Label>
              </div>
              {showHeader && (
                <Input
                  id='headerText'
                  value={headerText}
                  onChange={e => setHeaderText(e.target.value)}
                  placeholder='Header text'
                />
              )}
            </div>

            <div className='space-y-2'>
              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='showFooter'
                  checked={showFooter}
                  onCheckedChange={checked => setShowFooter(checked as boolean)}
                />
                <Label htmlFor='showFooter'>Show Footer</Label>
              </div>
              {showFooter && (
                <Input
                  id='footerText'
                  value={footerText}
                  onChange={e => setFooterText(e.target.value)}
                  placeholder='Footer text'
                />
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className='hidden'>
          <div ref={printRef}>
            <PrintableTimetable
              view={printView}
              selectedItems={selectedItems}
              weekType={weekType}
              showHeader={showHeader}
              headerText={headerText}
              showFooter={showFooter}
              footerText={footerText}
              paperSize={paperSize}
              orientation={orientation}
            />
          </div>
        </div>

        <DialogFooter className='flex items-center justify-between mt-6'>
          <div className='text-sm text-muted-foreground'>
            {printView === 'school'
              ? 'Printing school-wide view'
              : `Printing ${selectedItems.length} ${getViewLabel().toLowerCase()}`}
          </div>
          <div className='space-x-2'>
            <Button variant='outline' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePrint}
              disabled={printView !== 'school' && selectedItems.length === 0}
            >
              <FaPrint className='mr-2 h-4 w-4' />
              Print
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
