import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";
import "../App.css";
import { applyTheme, loadThemePreference, type ThemePreference } from "../theme";
import { AppLayout } from "../components/layout/app-layout";
import '@xyflow/react/dist/style.css';

const RootLayout = () => {
  const [theme, setTheme] = useState<ThemePreference>('system');

  useEffect(() => {
    let mediaQuery: MediaQueryList | undefined;

    async function initializeTheme() {
      const savedTheme = await loadThemePreference();
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }

    initializeTheme();

    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => {
      mediaQuery?.removeEventListener('change', handleSystemThemeChange);
    };
  }, [theme]);

  return (
    <AppLayout>
      {/* Sub-pages such as /branch-map and /database mount exactly here! */}
      <Outlet />
      <TanStackRouterDevtools />
    </AppLayout>
  );
};

export const Route = createRootRoute({ component: RootLayout });