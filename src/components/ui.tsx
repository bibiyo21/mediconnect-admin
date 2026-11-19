'use client';

/**
 * Console primitives (docs/design-system.md §8), styled with the shared tokens
 * in globals.css. Reuse these; do not create per-page variants.
 */
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({ variant = 'primary', loading = false, children, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const inactive = disabled || loading;
  return (
    <button {...rest} className={`btn btn--${variant}`} disabled={inactive} aria-disabled={inactive || undefined} aria-busy={loading || undefined}>
      {loading ? <span className="spinner" aria-hidden /> : null}
      <span className={loading ? 'btn__label--loading' : undefined}>{children}</span>
    </button>
  );
}

export function TextField({ label, hint, error, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">{label}</label>
      <input id={id} className="field__input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {error ? <p id={`${id}-error`} className="field__error" role="alert">{error}</p> : hint ? <p id={`${id}-hint`} className="field__hint">{hint}</p> : null}
    </div>
  );
}

export function SelectField({ label, children, ...select }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">{label}</label>
      <select id={id} className="field__input" {...select}>{children}</select>
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning' | 'error'; children: ReactNode }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info'; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      {title ? <h2 className="card__title">{title}</h2> : null}
      {children}
    </section>
  );
}

export function Pagination({ page, lastPage, total, onPage }: { page: number; lastPage: number; total: number; onPage: (page: number) => void }) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted">{total} total · page {page} of {Math.max(lastPage, 1)}</span>
      <div className="pagination__buttons">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button variant="secondary" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </nav>
  );
}

export function StateMessage({ state, message, onRetry }: { state: 'loading' | 'empty' | 'error'; message: string; onRetry?: () => void }) {
  return (
    <div className={`state state--${state}`} role={state === 'error' ? 'alert' : 'status'} aria-live="polite">
      {state === 'loading' ? <span className="spinner" aria-hidden /> : null}
      <p>{message}</p>
      {onRetry ? <Button variant="secondary" onClick={onRetry}>Try again</Button> : null}
    </div>
  );
}
