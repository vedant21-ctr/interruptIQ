import React from 'react';

export interface ButtonProps {
  label: string;
  onClick?: () => void;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick, className }) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 bg-violet-600 text-white rounded-lg shadow-md hover:bg-violet-700 transition-all ${className || ''}`}
    >
      {label}
    </button>
  );
};
