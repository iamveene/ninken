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
            <defs>
              <filter id="ninken-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0.86  0 1 0 0 0.15  0 0 1 0 0.15  0 0 0 0.4 0" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <text
              x="0"
              y="32"
              fill="currentColor"
              fontFamily="var(--font-geist-sans), system-ui, sans-serif"
              fontSize="36"
              fontWeight="700"
              letterSpacing="-1"
              filter="url(#ninken-glow)"
            >
              Ninken
            </text>
            <text
              x="152"
              y="32"
              fill="#dc2626"
              fontFamily="'Noto Sans JP', system-ui, sans-serif"
              fontSize="16"
            >
              忍犬
            </text>
          </svg>
        </div>
      </div>
      {tagline && (
        <p className="mt-2 text-sm tracking-wide text-red-500/80">
          {tagline}
        </p>
      )}
    </div>
  )
}

export function NinkenLogoCompact({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <svg
        viewBox="0 0 150 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-auto"
        aria-label="Ninken"
      >
        <defs>
          <filter id="ninken-glow-sm" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0.86  0 1 0 0 0.15  0 0 1 0 0.15  0 0 0 0.3 0" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <text
          x="0"
          y="21"
          fill="currentColor"
          fontFamily="var(--font-geist-sans), system-ui, sans-serif"
          fontSize="22"
          fontWeight="700"
          letterSpacing="-0.5"
          filter="url(#ninken-glow-sm)"
        >
          Ninken
        </text>
        <text
          x="95"
          y="21"
          fill="#dc2626"
          fontFamily="'Noto Sans JP', system-ui, sans-serif"
          fontSize="12"
        >
          忍犬
        </text>
      </svg>
    </div>
  )
}
