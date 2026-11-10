/** Brasão central — `frontend/public/logo.png` (favicon e `BrandLogo`). */
export const BRAND_LOGO_SRC = '/logo.png'

export const BRAND_ALT = 'Brasão oficial — As Crônicas de Beladona'

type BrandLogoProps = {
  className?: string
  /** Visual height; width follows aspect ratio */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'hero'
  withGlow?: boolean
}

const sizeClass: Record<NonNullable<BrandLogoProps['size']>, string> = {
  xs: 'h-8 w-auto',
  sm: 'h-10 w-auto',
  md: 'h-14 w-auto',
  lg: 'h-24 w-auto',
  hero: 'h-56 w-auto max-w-full',
}

export function BrandLogo({ className = '', size = 'sm', withGlow = false }: BrandLogoProps) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={BRAND_ALT}
      className={`object-contain select-none ${sizeClass[size]} ${withGlow ? 'drop-shadow-[0_0_24px_rgba(158,27,45,0.55)]' : ''} ${className}`}
      decoding="async"
    />
  )
}
