import type * as React from 'react'

import LogoImage from '../../assets/logo.svg'

export const Logo = (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
  return (
    <img
      src={LogoImage}
      // it's decorative, so we set aria-hidden to true
      aria-hidden={true}
      className='h-8 w-8 scale-150'
      {...props}
    />
  )
}
