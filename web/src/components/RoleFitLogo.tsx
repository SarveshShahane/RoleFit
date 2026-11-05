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
      className={`relative flex items-center justify-center flex-shrink-0 bg-transparent text-slate-900 dark:text-white ${className}`}
      style={{ width: size, height: size }}
      title="RoleFit ATS"
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <path
          d="M8 5V31"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
        />

        <path
          d="M8 5.5H27"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
        />

        <path
          d="M9 6C19 6 25 8.5 25 13C25 17 19.5 18 12 18H25"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M11 18L21 31"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export default RoleFitLogo;
