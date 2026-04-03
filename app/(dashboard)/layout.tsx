import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider className="min-h-svh">
      <AppSidebar />
      <SidebarInset className="min-h-svh">{children}</SidebarInset>
    </SidebarProvider>
  )
}
