import Image from "next/image"

interface LogoProps {
  className?: string
  tagline?: string
}

export function NinkenLogo({ className, tagline }: LogoProps) {
  return (
    <div className={className}>
      <Image
        src="/ninken-logo.png"
        alt="Ninken 忍犬"
        width={600}
        height={200}
        className="w-full max-w-md h-auto"
        priority
      />
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
      <span className="text-sm font-bold tracking-tight text-neutral-100">
        Ninken
      </span>
      <span className="text-xs text-red-600">忍犬</span>
    </div>
  )
}
