type BrandImageProps = {
  className?: string
}

const brandImageClass = (className?: string) =>
  ['select-none object-contain', className].filter(Boolean).join(' ')

export function BrandMark({ className }: BrandImageProps) {
  return (
    <img
      src="/hshlogocube.png"
      className={brandImageClass(className)}
      alt="High Score Host"
      decoding="async"
      draggable={false}
    />
  )
}

export function BrandLogo({ className }: BrandImageProps) {
  return (
    <img
      src="/hshlogo.png"
      className={brandImageClass(className)}
      alt="High Score Host"
      decoding="async"
      draggable={false}
    />
  )
}
