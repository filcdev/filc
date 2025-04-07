const BlobBackground = () => {
  return (
    <div className="bg-background sticky top-0 left-0 -z-50 h-screen w-screen overflow-hidden">
      <div
        className="absolute top-[50%] left-[50%] aspect-square h-[40vmax] translate-[-50%] scale-150 animate-spin rounded-full bg-gradient-to-tr from-green-500 to-blue-500"
        style={{ animationDuration: '5s' }}
      ></div>
      <div className="absolute z-2 h-screen w-screen backdrop-blur-[13vmax]"></div>
    </div>
  )
}

export default BlobBackground
