import { memo } from 'react'

interface SparkIconProps {
  className?: string
  animated?: boolean
}

export const SparkIcon = memo(function SparkIcon({ className = '', animated = false }: SparkIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main spark - 4-pointed star */}
      <path
        d="M12 2L13.5 9.5L21 12L13.5 14.5L12 22L10.5 14.5L3 12L10.5 9.5L12 2Z"
        fill="currentColor"
        className={animated ? 'animate-spark-pulse' : ''}
      />
      {/* Small accent sparks */}
      <circle
        cx="19"
        cy="5"
        r="1.5"
        fill="currentColor"
        opacity="0.6"
        className={animated ? 'animate-spark-twinkle' : ''}
      />
      <circle
        cx="5"
        cy="19"
        r="1"
        fill="currentColor"
        opacity="0.4"
        className={animated ? 'animate-spark-twinkle-delayed' : ''}
      />
    </svg>
  )
})
