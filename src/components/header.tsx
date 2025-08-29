import { useTheme } from "@/providers/theme-provider";
import { Moon, Sun } from "lucide-react";

export function Header() {
  return (
    <header className="h-12 bg-background-header border-b border-accent">
      <div className="container mx-auto px-4 h-full flex items-center max-w-5xl">
        <div className="w-full flex justify-between items-center">
          <h3 className="font-medium">React Realtime Chart</h3>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <GithubLink />
          </div>
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex items-center justify-center w-10 h-10 rounded-lg bg-background-secondary hover:bg-background-tertiary"
    >
      {theme === "dark" ? <Moon className="size-5 text-foreground" /> : <Sun className="size-5 text-foreground" />}
    </button>
  );
}

function GithubLink() {
  return (
    <a
      href="https://github.com/jkuri/react-realtime-chart"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center size-5 rounded-lg bg-background-secondary hover:bg-background-tertiary"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
        <path d="M9 18c-4.51 2-5-2-7-2" />
      </svg>
    </a>
  );
}
