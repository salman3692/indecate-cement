import { useState } from 'react';
import { Menu } from 'lucide-react';

export default function AppShell({ sidebar, headerExtras, children }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Slim brand bar for subtle color + identity */}
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white shadow-sm">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="p-2 rounded-xl border hover:bg-neutral-50 md:hidden"
              onClick={() => setOpen(v => !v)}
              aria-label="Toggle sidebar"
            >
              <Menu size={18} />
            </button>

            {/* Brand with subtle accent */}
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-600" />
              <span className="font-semibold tracking-tight">Indicate</span>
            </span>
            <span className="hidden md:inline text-neutral-400">•</span>
            <span className="hidden md:inline text-neutral-500">Decarbonization Explorer</span>
          </div>
          <div className="flex items-center gap-2">{headerExtras}</div>
        </div>
      </header>

      {/* Body grid */}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-4">
        <div
          className={`grid gap-4 md:gap-6 transition-[grid-template-columns] duration-200 grid-cols-1 ${
            open ? 'md:grid-cols-[300px,1fr]' : 'md:grid-cols-[0px,1fr]'
          }`}
        >
          {/* Sidebar */}
          <aside
            className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${
              open ? 'md:opacity-100' : 'md:opacity-0 md:pointer-events-none'
            }`}
          >
            <div className="p-4">{sidebar}</div>
          </aside>

          {/* Main */}
          <main className="min-w-0">
            <div className="grid gap-4 md:gap-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
