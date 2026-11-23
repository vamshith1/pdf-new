"use client";

import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { EyeIcon, EyeOffIcon } from "./Icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-13 px-7 text-base" };
  const variants: Record<Variant, string> = {
    primary: "bg-accent text-white hover:bg-accent-hover shadow-sm disabled:bg-accent/40",
    secondary: "border border-border bg-surface text-text hover:bg-surface-2",
    ghost: "text-muted hover:bg-surface-2 hover:text-text",
    danger: "text-danger hover:bg-danger-soft",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

/** A row of mutually exclusive options (radio group styled as buttons). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset disabled={disabled} className="disabled:opacity-50">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer flex-col items-center rounded-lg border px-2 py-2 text-center text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
              value === o.value ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border hover:bg-surface-2"
            }`}
          >
            <input type="radio" name={name} aria-label={o.label} className="sr-only" checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
            {o.hint && <span className="mt-0.5 text-xs font-normal text-muted">{o.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Larger option cards, e.g. compression levels. */
export function ChoiceCards<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; title: string; body: string; badge?: string }[];
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="space-y-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
              value === o.value ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2"
            }`}
          >
            <input type="radio" name={name} aria-label={o.title} className="mt-1 accent-[var(--accent)]" checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold">
                {o.title}
                {o.badge && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">{o.badge}</span>}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{o.body}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TextField({
  label,
  hint,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={hint || error ? `${id}-hint` : undefined}
        className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent aria-[invalid=true]:border-danger"
        {...props}
      />
      {(error || hint) && (
        <p id={`${id}-hint`} className={`mt-1.5 text-xs ${error ? "text-danger" : "text-muted"}`}>{error ?? hint}</p>
      )}
    </div>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  hint,
  error,
  autoComplete = "new-password",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string;
  autoComplete?: string;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className="h-10 w-full rounded-lg border border-border bg-surface pr-10 pl-3 text-sm outline-none focus:border-accent aria-[invalid=true]:border-danger"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-text"
        >
          {show ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
        </button>
      </div>
      {(error || hint) && <p className={`mt-1.5 text-xs ${error ? "text-danger" : "text-muted"}`}>{error ?? hint}</p>}
    </div>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
