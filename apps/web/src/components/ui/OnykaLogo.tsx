import { useId } from 'react'

interface OnykaLogoProps {
  size?: number
  className?: string
}

export function OnykaLogo({ size, className }: OnykaLogoProps) {
  const uid = useId().replace(/:/g, '')
  const fid = `f_${uid}`
  const gid = `g_${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 386 386"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g filter={`url(#${fid})`}>
        <path
          d="M193 0.658295C216.054 134.015 251.916 169.919 385.118 193C251.916 216.081 216.054 251.985 193 385.342C169.946 251.985 134.084 216.081 0.881866 193C134.084 169.919 169.946 134.015 193 0.658295ZM192.814 139C163.093 139 139 163.121 139 192.876C139 222.631 163.093 246.753 192.814 246.753C222.534 246.753 246.628 222.631 246.628 192.876C246.628 163.121 222.534 139 192.814 139Z"
          fill={`url(#${gid})`}
          fillRule="evenodd"
        />
      </g>
      <defs>
        <filter id={fid} x="-5" y="-5" width="396" height="396" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dx="-5" dy="-5" />
          <feGaussianBlur stdDeviation="12.5" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.4 0" />
          <feBlend mode="normal" in2="shape" result="effect1" />
        </filter>
        <radialGradient id={gid} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(193 157) rotate(90) scale(228.342 228.342)">
          <stop style={{ stopColor: 'color-mix(in srgb, var(--color-accent-hover), white 15%)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--color-accent)' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--color-accent), black 45%)' }} />
        </radialGradient>
      </defs>
    </svg>
  )
}
