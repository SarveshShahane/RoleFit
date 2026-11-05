import React from 'react';

interface RoleFitLogoProps {
  className?: string;
  size?: number;
}

export const RoleFitLogo: React.FC<RoleFitLogoProps> = ({
  className = 'w-9 h-9',
  size = 36,
}) => {
  return (
    <div
      className={`relative flex items-center justify-center flex-shrink-0 bg-transparent ${className}`}
      style={{ width: size, height: size }}
      title="RoleFit ATS"
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="rf-monogram-grad" x1="8" y1="5" x2="27" y2="31" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0F172A" />
            <stop offset="0.7" stopColor="#1E293B" />
            <stop offset="1" stopColor="#334155" />
          </linearGradient>
        </defs>

        <path
          d="M8 5V31"
          stroke="url(#rf-monogram-grad)"
          strokeWidth="3.4"
          strokeLinecap="round"
        />

        <path
          d="M8 5.5H27"
          stroke="url(#rf-monogram-grad)"
          strokeWidth="3.4"
          strokeLinecap="round"
        />

        <path
          d="M9 6C19 6 25 8.5 25 13C25 17 19.5 18 12 18H25"
          stroke="url(#rf-monogram-grad)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M11 18L21 31"
          stroke="url(#rf-monogram-grad)"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export default RoleFitLogo;
