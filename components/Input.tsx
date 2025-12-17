import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => {
  return (
    <div className={`w-full ${className}`}>
      <label className="block text-sm font-medium text-slate-300 mb-1">
        {label}
      </label>
      <div className="relative rounded-md shadow-sm">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}
        <input
          className={`block w-full ${icon ? 'pl-10' : 'pl-3'} pr-3 py-2 bg-slate-800 border ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-600 focus:ring-indigo-500 focus:border-indigo-500'} rounded-md text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 sm:text-sm transition-colors`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default Input;