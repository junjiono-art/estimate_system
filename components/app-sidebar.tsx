"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  CalculatorIcon,
  GitCompareArrowsIcon,
  DatabaseIcon,
  HistoryIcon,
  ActivityIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar"

const navMain = [
  {
    label: "試算",
    items: [
      { title: "新規試算", href: "/", icon: CalculatorIcon },
      { title: "試算比較", href: "/compare", icon: GitCompareArrowsIcon },
      { title: "試算履歴", href: "/history", icon: HistoryIcon },
    ],
  },
  {
    label: "マスタ管理",
    items: [
      { title: "FC費用",        href: "/master/franchise",     icon: DatabaseIcon },
      { title: "投資コスト",    href: "/master/investment-cost", icon: DatabaseIcon },
      { title: "ランニングコスト", href: "/master/running-cost", icon: DatabaseIcon },
      { title: "出店済み店舗",  href: "/master/stores",        icon: DatabaseIcon },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="none" className="w-52 border-r-0 sticky top-0 h-svh">
      {/* ロゴヘッダー */}
      <SidebarHeader className="px-4 py-5">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary">
            <ActivityIcon className="size-4 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight text-sidebar-accent-foreground">
              FitCalc
            </span>
            <span className="text-[10px] text-sidebar-foreground/50 mt-0.5">
              出店試算ツール
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator className="bg-sidebar-border/60" />

      <SidebarContent className="px-2 py-3">
        {navMain.map((group) => (
          <SidebarGroup key={group.label} className="mb-1 p-0">
            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="h-8 rounded-md px-3 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary/20 data-[active=true]:text-sidebar-primary data-[active=true]:font-medium"
                      >
                        <Link href={item.href} className="flex items-center gap-2.5">
                          <item.icon className="size-3.5 shrink-0" />
                          <span>{item.title}</span>
                          {isActive && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator className="bg-sidebar-border/60" />

      <SidebarFooter className="px-4 py-3">
        <p className="text-[10px] text-sidebar-foreground/30 font-mono">
          v0.1.0 — prototype
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
