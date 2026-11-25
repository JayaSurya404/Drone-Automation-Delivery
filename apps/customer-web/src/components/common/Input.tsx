import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, onRightIconClick, className = '', id, ...props }, ref) => {
    const inputId = id || `input_${Math.random().toString(36).substr(2, 6)}`;

    return (
      <div className="form-group">
        {label && (
          <label htmlFor={inputId} className="form-label">
            {label}
          </label>
        )}
        <div className={`input-with-icon ${className}`}>
          {leftIcon && <span className="input-icon-left">{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={`form-control ${error ? 'has-error' : ''}`}
            {...props}
          />
          {rightIcon && (
            <span className="input-icon-right" onClick={onRightIconClick}>
              {rightIcon}
            </span>
          )}
        </div>
        {error && <span className="form-error-msg">{error}</span>}
        {hint && !error && <span className="form-hint">{hint}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
