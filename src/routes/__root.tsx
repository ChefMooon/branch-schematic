import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";
import "../App.css";
import { applyTheme, loadThemePreference, type ThemePreference } from "../theme";
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
    <>
        <div className="navbar">
            <Link to="/">Home</Link>
            <Link to="/branch-map">Branch Map</Link>
            <Link to="/database">Database</Link>
            <Link to="/about">About</Link>

            {/* We use a plain CSS class here instead of Tailwind */}
            <div className="settings-right">
                <Link to="/settings">Settings</Link>
            </div>
        </div>

        <hr />
        <Outlet />
        <TanStackRouterDevtools />
    </>
    );
};

export const Route = createRootRoute({ component: RootLayout });
