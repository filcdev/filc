interface TextInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  password?: true
}
const TextInput = ({
  value,
  onChange,
  placeholder,
  className,
  password
}: TextInputProps) => {
  return (
    <input
      type={password ? 'password' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" ${className}`}
    />
  )
}

export default TextInput
