import Image from "next/image"

interface NinkenIconProps {
  className?: string
}

export function NinkenIcon({ className }: NinkenIconProps) {
  return (
    <Image
      src="/ninken-badge.png"
      alt="Ninken"
      width={24}
      height={24}
      className={className}
      priority
    />
  )
}
