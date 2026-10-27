"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState } from "react"

type NavLink = { href: string; label: string; icon: string }
type NavGroup = { label: string; links: NavLink[] }

const groups: NavGroup[] = [
  { label: "Review", links: [
    { href: "/applications", label: "Seller applications", icon: "application" },
    { href: "/products", label: "Products", icon: "products" },
    { href: "/translations", label: "Translations", icon: "translations" },
  ] },
  { label: "Commerce", links: [
    { href: "/categories", label: "Categories", icon: "categories" },
    { href: "/sellers", label: "Sellers", icon: "sellers" },
    { href: "/fulfillment", label: "Fulfillment", icon: "fulfillment" },
    { href: "/couriers", label: "Couriers", icon: "couriers" },
  ] },
  { label: "Money", links: [
    { href: "/payments", label: "Payments", icon: "payments" },
    { href: "/finance", label: "Finance", icon: "finance" },
    { href: "/finance/returns", label: "Returns", icon: "returns" },
    { href: "/finance/disputes", label: "Disputes", icon: "disputes" },
  ] },
  { label: "Workspace", links: [
    { href: "/team", label: "Team", icon: "team" },
    { href: "/config", label: "Configuration", icon: "config" },
  ] },
]

const iconPaths: Record<string, React.ReactNode> = {
  application: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  products: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></>,
  translations: <><path d="M4 5h10M9 3v2c0 6-2 9-5 11M6 9c1 3 3 5 7 7M14 12l4 9m-8 0 4-9h3"/></>,
  categories: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  sellers: <><path d="M3 10h18l-2-6H5l-2 6ZM5 10v10h14V10M9 20v-6h6v6"/></>,
  fulfillment: <><rect x="3" y="6" width="12" height="12" rx="1"/><path d="M15 10h4l2 3v5h-6M7 18a2 2 0 1 0 4 0M17 18a2 2 0 1 0 4 0"/></>,
  couriers: <><path d="M3 17h3M3 13h6M12 5h5l4 6v7h-2M12 5H7l-2 6M10 18h5M6 18a2 2 0 1 0 4 0M15 18a2 2 0 1 0 4 0"/></>,
  payments: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></>,
  finance: <><path d="M4 20V9m5 11V4m5 16v-7m5 7V7M2 20h20"/></>,
  returns: <><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-2"/></>,
  disputes: <><path d="M12 3 2 21h20L12 3ZM12 9v5m0 4h.01"/></>,
  team: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1"/></>,
  config: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/></>,
}

function Icon({ name }: { name: string }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const active = groups.flatMap(group => group.links)
    .filter(link => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return <div className="admin-shell">
    {menuOpen && <button type="button" className="admin-overlay" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <aside className={`admin-sidebar ${menuOpen ? "is-open" : ""}`} aria-label="Admin navigation">
      <Link href="/applications" className="admin-brand" onClick={() => setMenuOpen(false)}>
        <Image src="/brand/icon.png" alt="Bawi Shopping" width={42} height={42} loading="eager" className="admin-brand-logo" />
        <span><strong>BAWI</strong><small>ADMIN STUDIO</small></span>
      </Link>
      <div className="admin-sidebar-scroll">
        {groups.map(group => <section key={group.label} className="admin-nav-group">
          <h2>{group.label}</h2>
          <nav aria-label={group.label}>
            {group.links.map(link => {
              const selected = active?.href === link.href
              return <Link key={link.href} href={link.href} aria-current={selected ? "page" : undefined} className={`admin-nav-link ${selected ? "is-active" : ""}`} onClick={() => setMenuOpen(false)}><Icon name={link.icon}/><span>{link.label}</span></Link>
            })}
          </nav>
        </section>)}
      </div>
      <div className="admin-sidebar-footer"><span className="admin-online-dot"/>Bawi Shopping workspace</div>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar">
        <button type="button" className="admin-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation" aria-expanded={menuOpen}><span/><span/><span/></button>
        <div className="admin-breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>{active?.label ?? "Overview"}</strong></div>
        <div className="admin-topbar-right"><span className="admin-topbar-label">BAWI SHOPPING</span><span className="admin-avatar" aria-label="Admin account">B</span></div>
      </header>
      <div className="admin-content">{children}</div>
    </div>
  </div>
}
