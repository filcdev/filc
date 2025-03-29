const BlobBackground = () => {
  return (
    <div className="bg-background absolute left-0 top-0 h-dvh w-dvw overflow-hidden">
      <div
        className="translate-[-50%] absolute left-[50%] top-[50%] aspect-square h-[40vmax] scale-150 animate-spin rounded-full bg-gradient-to-tr from-green-500 to-blue-500"
        style={{ animationDuration: '5s' }}
      ></div>
      <div className="z-2 absolute h-screen w-screen backdrop-blur-[13vmax]"></div>
    </div>
  )
}

export default BlobBackground
