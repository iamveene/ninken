interface NinkenIconProps {
  className?: string
}

export function NinkenIcon({ className }: NinkenIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Ninken icon"
    >
      {/* Stylized hound/wolf silhouette — geometric stealth aesthetic */}
      <path
        d="M4 4L8 2L10 6L12 4L14 6L16 2L20 4L19 10L20 14L18 18L16 20L14 22H10L8 20L6 18L4 14L5 10L4 4Z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M4 4L8 2L10 6L12 4L14 6L16 2L20 4L19 10L20 14L18 18L16 20L14 22H10L8 20L6 18L4 14L5 10L4 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Eyes */}
      <circle cx="9" cy="11" r="1.2" fill="currentColor" />
      <circle cx="15" cy="11" r="1.2" fill="currentColor" />
      {/* Nose */}
      <path
        d="M11 15L12 16.5L13 15"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
