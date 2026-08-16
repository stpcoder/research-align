'use client'

import type { ReactNode } from 'react'

export function AdminPageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return <header className="aui-page-head">
    <div className="aui-page-copy">
      {kicker && <span className="aui-kicker">{kicker}</span>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="aui-page-actions">{actions}</div>}
  </header>
}

export function AdminSurface({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={`aui-surface ${className}`}>{children}</section>
}

export function AdminSplitView({
  sidebar,
  children,
  sidebarWidth = 300,
}: {
  sidebar: ReactNode
  children: ReactNode
  sidebarWidth?: number
}) {
  return <div className="aui-split" style={{ '--aui-sidebar': `${sidebarWidth}px` } as React.CSSProperties}>
    <div className="aui-sidebar">{sidebar}</div>
    <div className="aui-main">{children}</div>
  </div>
}

export function AdminPanelHeader({
  title,
  meta,
  description,
  actions,
}: {
  title: string
  meta?: string
  description?: string
  actions?: ReactNode
}) {
  return <div className="aui-panel-head">
    <div>
      <div className="aui-panel-title-row"><h3>{title}</h3>{meta && <span>{meta}</span>}</div>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="aui-panel-actions">{actions}</div>}
  </div>
}

export type AdminStatus = 'unassigned' | 'draft' | 'confirmed' | 'completed' | 'neutral' | 'danger'

export function StatusBadge({ status, label }: { status: AdminStatus; label?: string }) {
  const defaultLabel: Record<AdminStatus, string> = {
    unassigned: '미배정',
    draft: '미확정',
    confirmed: '확정',
    completed: '완료',
    neutral: '진행 중',
    danger: '오류',
  }
  return <span className={`aui-status ${status}`}>{label || defaultLabel[status]}</span>
}

export function AdminListItem({
  active,
  title,
  subtitle,
  meta,
  status,
  onClick,
}: {
  active?: boolean
  title: string
  subtitle?: string | null
  meta?: string | null
  status?: ReactNode
  onClick?: () => void
}) {
  return <button type="button" className={`aui-list-item ${active ? 'active' : ''}`} onClick={onClick}>
    <span className="aui-list-copy">
      <strong>{title}</strong>
      {subtitle && <span>{subtitle}</span>}
      {meta && <small>{meta}</small>}
    </span>
    {status && <span className="aui-list-status">{status}</span>}
  </button>
}

export function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return <div className="aui-segmented">
    {options.map(option => <button
      type="button"
      key={option.value}
      className={value === option.value ? 'active' : ''}
      onClick={() => onChange(option.value)}
    >{option.label}</button>)}
  </div>
}
