import logoUrl from '../assets/logo.svg?raw'

// Inline raw SVG markup so `currentColor` fills inherit the surrounding `color`
// (using <img> would freeze the fill). Wrapper div sets the color from the theme.
export function Logo({
  className,
  height = 12,
  title = 'PROJECTUS',
}: {
  className?: string
  height?: number
  title?: string
}) {
  return (
    <span
      className={className ?? 'brand'}
      role="img"
      aria-label={title}
      style={{ display: 'inline-flex', height, lineHeight: 0 }}
      dangerouslySetInnerHTML={{
        __html: logoUrl.replace(/<svg([^>]*)>/, `<svg$1 height="${height}" width="auto" style="display:block">`),
      }}
    />
  )
}
