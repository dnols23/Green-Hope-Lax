'use client'
import { useId, useState } from 'react'

// Password input with a show/hide eye. Note the eye reveals what is being typed,
// not a stored password — team and admin passwords are only ever kept hashed.
export function PasswordField({
  name,
  label,
  placeholder,
  required = false,
  minLength,
  autoComplete = 'off',
  hint,
}: {
  name: string
  label: string
  placeholder?: string
  required?: boolean
  minLength?: number
  autoComplete?: string
  hint?: string
}) {
  const [shown, setShown] = useState(false)
  const id = useId()

  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <div className="pw-wrap">
        <input
          id={id}
          name={name}
          type={shown ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="field pw-input"
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          className="pw-eye"
          aria-pressed={shown}
          aria-label={shown ? 'Hide password' : 'Show password'}
          title={shown ? 'Hide password' : 'Show password'}
        >
          {shown ? (
            // eye with a slash — currently visible, click to hide
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c5.5 0 9 6 9 6a15.8 15.8 0 0 1-3.1 3.8" />
              <path d="M6.2 6.7A15.9 15.9 0 0 0 3 11s3.5 6 9 6a9.7 9.7 0 0 0 4.2-.9" />
              <path d="M9.9 8.9a3 3 0 0 0 4.2 4.2" />
              <path d="M3 3l18 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 11s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
              <circle cx="12" cy="11" r="2.6" />
            </svg>
          )}
        </button>
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}
