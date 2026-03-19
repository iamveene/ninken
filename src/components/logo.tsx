import { NinkenIcon } from "./ninken-icon"

interface LogoProps {
  className?: string
  tagline?: string
}

export function NinkenLogo({ className, tagline }: LogoProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <NinkenIcon className="h-10 w-10" />
        <div className="flex flex-col">
          <svg
            viewBox="0 0 200 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-auto"
            aria-label="Ninken"
          >
            <text
              x="0"
              y="32"
              fill="currentColor"
              fontFamily="var(--font-geist-sans), system-ui, sans-serif"
              fontSize="36"
              fontWeight="700"
              letterSpacing="-1"
            >
              Ninken
            </text>
            <text
              x="152"
              y="32"
              fill="currentColor"
              fontFamily="'Noto Sans JP', system-ui, sans-serif"
              fontSize="16"
              opacity="0.6"
            >
              忍犬
            </text>
          </svg>
        </div>
      </div>
      {tagline && (
        <p className="mt-2 text-sm tracking-wide text-muted-foreground">
          {tagline}
        </p>
      )}
    </div>
  )
}

export function NinkenLogoCompact({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <NinkenIcon className="h-5 w-5" />
      <svg
        viewBox="0 0 120 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-auto"
        aria-label="Ninken"
      >
        <text
          x="0"
          y="21"
          fill="currentColor"
          fontFamily="var(--font-geist-sans), system-ui, sans-serif"
          fontSize="22"
          fontWeight="700"
          letterSpacing="-0.5"
        >
          Ninken
        </text>
      </svg>
    </div>
  )
}
