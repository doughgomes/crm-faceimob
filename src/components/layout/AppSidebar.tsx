import {
  LayoutDashboard, GitBranch, Users, UserPlus, Megaphone,
  UserCircle, Database, Settings, LogOut, Link2, Sun, Moon,
  CreditCard, Shield, Building2, UsersRound, Trophy, Swords, KeyRound, Target, LogIn, Globe, TrendingUp, Zap, Bot,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import logoFaceimob from "@/assets/logo-faceimob-white.png";
import logoFaceimobDark from "@/assets/logo-faceimob.png";
import logoSymbol from "@/assets/logo-faceimob-symbol-white.png";
import logoSymbolDark from "@/assets/logo-faceimob-symbol.png";
import { useTheme } from "@/hooks/useTheme";
import { useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

// App focado em Checkpoint: preenchimento + relatório geral.
const mainNav = [
  { title: "Preencher Checkpoint", url: "/meus-checkpoints", icon: Target, roles: ['admin', 'partner', 'director', 'manager', 'broker', 'cca'] },
  { title: "Relatório Geral", url: "/checkpoint", icon: TrendingUp, roles: ['admin', 'partner', 'director', 'manager', 'broker', 'cca'] },
];

const adminNav = [
  { title: "Equipes", url: "/equipes", icon: Users },
  { title: "Links & PINs", url: "/admin/daily-teams", icon: KeyRound },
  { title: "Permissões", url: "/admin/permissions", icon: Shield },
  { title: "IPs autorizados", url: "/admin/allowed-ips", icon: Globe },
];

const systemNav: { title: string; url: string; icon: any }[] = [];

export function AppSidebar() {
  const { state, setOpen } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { role, signOut } = useAuth();
  const isActive = (path: string) => location.pathname === path;
  const isLight = theme === "light";
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleMouseEnter = useCallback(() => {
    clearTimeout(hoverTimer.current);
    if (collapsed) {
      hoverTimer.current = setTimeout(() => setOpen(true), 350);
    }
  }, [collapsed, setOpen]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(false), 500);
  }, [setOpen]);

  const visibleMainNav = mainNav.filter(item => item.roles.includes(role));
  const showAdmin = role === 'admin';

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarContent>
        <div className="p-4 flex items-center justify-center transition-all duration-300">
          {!collapsed ? (
            <img src={isLight ? logoFaceimobDark : logoFaceimob} alt="Faceimob" className="h-10 object-contain animate-fade-in" />
          ) : (
            <img src={isLight ? logoSymbolDark : logoSymbol} alt="Faceimob" className="w-8 h-8 object-contain animate-scale-in" />
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainNav.map((item, i) => (
                <SidebarMenuItem key={item.title} style={{ animationDelay: `${i * 30}ms` }} className="animate-fade-in">
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end activeClassName="bg-gradient-to-r from-primary/20 to-primary/5 text-primary glow-primary">
                      <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                      {!collapsed && <span className="transition-opacity duration-200">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} end activeClassName="bg-gradient-to-r from-primary/20 to-primary/5 text-primary glow-primary">
                        <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                        {!collapsed && <span className="transition-opacity duration-200">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end activeClassName="bg-gradient-to-r from-primary/20 to-primary/5 text-primary glow-primary">
                      <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                      {!collapsed && <span className="transition-opacity duration-200">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleTheme} className="transition-all duration-200 hover:bg-primary/10">
              {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {!collapsed && <span>{isLight ? "Modo Escuro" : "Versão White"}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-destructive hover:text-destructive transition-all duration-200" onClick={async () => { await signOut(); navigate('/login'); }}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
