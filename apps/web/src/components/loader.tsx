export const Loader = () => {
  return (
    <div className='flex items-center justify-center h-screen'>
      <svg
        viewBox='0 0 15 15'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
        width='50'
        height='50'
        className='text-primary animate-spin'
      >
        <title>Loading...</title>
        <path
          d='M8 1V.5H7V1h1zM7 4.5V5h1v-.5H7zm1 6V10H7v.5h1zM7 14v.5h1V14H7zM4.5 7.995H5v-1h-.5v1zm-3.5-1H.5v1H1v-1zM14 8h.5V7H14v1zm-3.5-1.005H10v1h.5v-1zM7 1v3.5h1V1H7zm0 9.5V14h1v-3.5H7zM4.5 6.995H1v1h3.5v-1zM14 7l-3.5-.005v1L14 8V7zM2.147 2.854l3 3 .708-.708-3-3-.708.708zm10-.708l-3 3 .708.708 3-3-.708-.708zM2.854 12.854l3-3-.708-.708-3 3 .708.708zm6.292-3l3 3 .708-.708-3-3-.708.708z'
          fill='currentColor'
        />
      </svg>
    </div>
  )
}
