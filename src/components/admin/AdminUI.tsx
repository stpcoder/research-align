'use client'

import type {
  ButtonHTMLAttributes,
  CSSProperties,
  DragEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

function cx(...values:(string|false|null|undefined)[]){return values.filter(Boolean).join(' ')}

export type AdminButtonVariant='primary'|'secondary'|'ghost'|'danger'
export type AdminButtonSize='sm'|'md'

export function AdminButton({
  variant='primary',
  size='md',
  className='',
  type='button',
  ...props
}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:AdminButtonVariant;size?:AdminButtonSize}){
  return <button type={type} className={cx('aui-button',variant,size==='sm'&&'small',className)} {...props}/>
}

export function AdminInput({className='',...props}:InputHTMLAttributes<HTMLInputElement>){
  return <input className={cx('aui-control',className)} {...props}/>
}

export function AdminSelect({className='',children,...props}:SelectHTMLAttributes<HTMLSelectElement>){
  return <select className={cx('aui-control',className)} {...props}>{children}</select>
}

export function AdminTextarea({className='',...props}:TextareaHTMLAttributes<HTMLTextAreaElement>){
  return <textarea className={cx('aui-control',className)} {...props}/>
}

export function AdminField({
  label,
  hint,
  error,
  children,
  className='',
}:{
  label:ReactNode
  hint?:ReactNode
  error?:ReactNode
  children:ReactNode
  className?:string
}){
  return <label className={cx('aui-field',className)}>
    <span className="aui-field-label">{label}</span>
    {children}
    {error?<span className="aui-field-error">{error}</span>:hint?<span className="aui-field-hint">{hint}</span>:null}
  </label>
}

export function AdminActions({children,className=''}:{children:ReactNode;className?:string}){
  return <div className={cx('aui-actions',className)}>{children}</div>
}

export function AdminToolbar({children,className=''}:{children:ReactNode;className?:string}){
  return <div className={cx('aui-toolbar',className)}>{children}</div>
}

export function AdminDivider({className=''}:{className?:string}){
  return <hr className={cx('aui-divider',className)}/>
}

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
  return <section className={cx('aui-surface',className)}>{children}</section>
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
  return <div className="aui-split" style={{ '--aui-sidebar': `${sidebarWidth}px` } as CSSProperties}>
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

export type AdminStatus = 'unassigned' | 'draft' | 'confirmed' | 'completed' | 'neutral' | 'info' | 'danger'

export function StatusBadge({ status, label }: { status: AdminStatus; label?: string }) {
  const defaultLabel: Record<AdminStatus, string> = {
    unassigned: '미배정',
    draft: '미확정',
    confirmed: '확정',
    completed: '완료',
    neutral: '진행 중',
    info: '진행 중',
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
  leading,
  onClick,
  className = '',
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  active?: boolean
  title: string
  subtitle?: string | null
  meta?: string | null
  status?: ReactNode
  leading?: ReactNode
  onClick?: () => void
  className?: string
  draggable?: boolean
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd?: (event: DragEvent<HTMLButtonElement>) => void
}) {
  return <button
    type="button"
    className={cx('aui-list-item',active&&'active',draggable&&'draggable',className)}
    onClick={onClick}
    draggable={draggable}
    onDragStart={onDragStart}
    onDragOver={onDragOver}
    onDrop={onDrop}
    onDragEnd={onDragEnd}
  >
    {leading && <span className="aui-list-leading">{leading}</span>}
    <span className="aui-list-copy">
      <strong>{title}</strong>
      {subtitle && <span>{subtitle}</span>}
      {meta && <small>{meta}</small>}
    </span>
    {status && <span className="aui-list-status">{status}</span>}
  </button>
}

export function AdminDataList({children,className=''}:{children:ReactNode;className?:string}){
  return <div className={cx('aui-data-list',className)}>{children}</div>
}

export function AdminDataRow({
  title,
  detail,
  trailing,
  columns,
  className='',
}:{
  title:ReactNode
  detail?:ReactNode
  trailing?:ReactNode
  columns?:string
  className?:string
}){
  return <div className={cx('aui-data-row',className)} style={columns?{'--aui-row-columns':columns} as CSSProperties:undefined}>
    <div className="aui-data-row-main"><strong>{title}</strong>{detail&&<span>{detail}</span>}</div>
    {trailing&&<div>{trailing}</div>}
  </div>
}

export function AdminTable({
  columns,
  minWidth,
  head,
  children,
  className='',
}:{
  columns:string
  minWidth?:number
  head?:ReactNode[]
  children:ReactNode
  className?:string
}){
  const style={'--aui-table-columns':columns,'--aui-table-min-width':minWidth?`${minWidth}px`:'0'} as CSSProperties
  return <div className={cx('aui-table',className)}><div className="aui-table-grid" style={style} role="table">
    {head&&<div className="aui-table-head" role="row">{head.map((cell,index)=><div className="aui-table-cell" role="columnheader" key={index}>{cell}</div>)}</div>}
    {children}
  </div></div>
}

export function AdminTableRow({children,className=''}:{children:ReactNode;className?:string}){
  return <div className={cx('aui-table-row',className)} role="row">{children}</div>
}

export function AdminTableCell({children,className=''}:{children:ReactNode;className?:string}){
  return <div className={cx('aui-table-cell',className)} role="cell">{children}</div>
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
