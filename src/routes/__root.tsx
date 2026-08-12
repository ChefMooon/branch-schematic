import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";
import "../App.css";
import { applyTheme, loadThemePreference, type ThemePreference } from "../theme";
import { AppLayout } from "../components/layout/AppLayout";
import { DatabaseRecoveryGate } from "../components/database-recovery/DatabaseRecoveryGate";
import { NotificationProvider } from "../components/notifications/NotificationProvider";
import { OnboardingProvider } from "../features/onboarding/hooks/useOnboarding";
import { OnboardingPresentation } from "../features/onboarding/components/OnboardingPresentation";

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
    <DatabaseRecoveryGate>
      <NotificationProvider>
        <OnboardingProvider>
          <AppLayout>
            {/* Sub-pages such as /branch-map and /database mount exactly here! */}
            <Outlet />
            {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
          </AppLayout>
          <OnboardingPresentation />
        </OnboardingProvider>
      </NotificationProvider>
    </DatabaseRecoveryGate>
  );
};

export const Route = createRootRoute({ component: RootLayout });