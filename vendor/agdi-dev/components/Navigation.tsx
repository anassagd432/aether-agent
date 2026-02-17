
import React from 'react';
import { Menu } from 'lucide-react';
import { NavItem, Page } from '../types';

const navItems: NavItem[] = [
  { label: 'Products', page: Page.PRODUCTS },
  { label: 'Solutions', page: Page.SOLUTIONS },
  { label: 'Developers', page: Page.DEVELOPERS },
  { label: 'Pricing', page: Page.PRICING },
  { label: 'Dedication', page: Page.DEDICATION },
];

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 lg:px-12 bg-slate-950/50 backdrop-blur-md pointer-events-auto border-b border-white/5">
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => onNavigate(Page.HOME)}
      >
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 border border-white/10 shadow-[0_0_15px_rgba(34,211,238,0.3)] group-hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] transition-shadow duration-300 overflow-hidden">
          <img
            src="/agdi-logo.png"
            alt="Agdi.dev"
            className="w-8 h-8 object-contain"
          />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">
          Agdi<span className="text-cyan-400">.dev</span>
        </span>
      </div>

      <div className="hidden md:flex items-center gap-8">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => onNavigate(item.page)}
            className={`text-sm font-medium transition-colors duration-200 ${currentPage === item.page
              ? 'text-cyan-400'
              : 'text-slate-300 hover:text-white'
              }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate(Page.AUTH)}
          className="hidden md:block px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          Log In
        </button>
        <button
          onClick={() => onNavigate(Page.WIZARD)}
          className="px-5 py-2 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)] hover:from-cyan-300 hover:to-cyan-400 transition-all border border-cyan-400/50 cursor-pointer"
        >
          Start Building
        </button>
        <button className="md:hidden text-slate-300">
          <Menu className="w-6 h-6" />
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
