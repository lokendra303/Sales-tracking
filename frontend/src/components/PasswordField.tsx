import { useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
};

export function PasswordField({ value, onChange, placeholder = "Password", required, autoComplete = "current-password" }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="eye"
        onClick={() => setVisible((on) => !on)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="currentColor"
              d="M3.3 2.3 2 3.6l3.1 3.1A11.6 11.6 0 0 0 1 12c1.8 4.4 6 7.5 11 7.5 1.8 0 3.5-.4 5-1.1l3.4 3.4 1.3-1.3zM12 17.5c-3.7 0-6.9-2.2-8.5-5.5.7-1.4 1.8-2.6 3.1-3.5l1.7 1.7A4 4 0 0 0 12 16a4 4 0 0 0 2.3-.7l1.5 1.5c-1.1.5-2.4.7-3.8.7zm0-11c3.7 0 6.9 2.2 8.5 5.5-.5 1-1.2 1.9-2.1 2.7l-1.5-1.5A4 4 0 0 0 12 8a4 4 0 0 0-1.3.2L9.1 6.6A9 9 0 0 1 12 6.5z"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 5c-5 0-9.2 3.1-11 7.5 1.8 4.4 6 7.5 11 7.5s9.2-3.1 11-7.5C21.2 8.1 17 5 12 5zm0 12.5c-3.7 0-6.9-2.2-8.5-5.5C5.1 8.7 8.3 6.5 12 6.5s6.9 2.2 8.5 5.5c-1.6 3.3-4.8 5.5-8.5 5.5zM12 9a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
