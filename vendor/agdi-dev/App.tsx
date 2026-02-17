
import React, { useState, Suspense, lazy, useCallback, useEffect } from 'react';
import Navigation from './components/Navigation';
import LandingPage from './components/LandingPage';
import { Page } from './types';
import { isComingSoonMode } from './lib/soft-launch';
import { useAuth } from './hooks/useAuth';

const Dedication = lazy(() => import('./components/Dedication'));
const Builder = lazy(() => import('./components/Builder'));
const Docs = lazy(() => import('./components/Docs'));
const About = lazy(() => import('./components/About'));
const Legal = lazy(() => import('./components/Legal'));
const ComingSoon = lazy(() => import('./components/ComingSoon'));
const WizardPage = lazy(() => import('./components/wizard/WizardPage').then(m => ({ default: m.WizardPage })));
const PricingPage = lazy(() => import('./components/PricingPage'));
const SimpleBuilder = lazy(() => import('./components/SimpleBuilder'));
const AuthPage = lazy(() => import('./components/AuthPage'));
const Dashboard = lazy(() => import('./components/Dashboard'));

// ─── URL ↔ Page mapping ──────────────────────────────────────
const PAGE_TO_PATH: Record<Page, string> = {
  [Page.HOME]: '/',
  [Page.PRODUCTS]: '/products',
  [Page.SOLUTIONS]: '/solutions',
  [Page.DEVELOPERS]: '/developers',
  [Page.DEDICATION]: '/dedication',
  [Page.WIZARD]: '/wizard',
  [Page.AUTH]: '/login',
  [Page.PRICING]: '/pricing',
  [Page.DASHBOARD]: '/dashboard',
  [Page.BUILDER]: '/builder',
  [Page.DOCS]: '/docs',
  [Page.ABOUT]: '/about',
  [Page.LEGAL]: '/legal',
};

const PATH_TO_PAGE: Record<string, Page> = Object.fromEntries(
  Object.entries(PAGE_TO_PATH).map(([page, path]) => [path, page as Page])
) as Record<string, Page>;

/** Read the current browser URL and return the matching Page (falls back to HOME). */
function pageFromUrl(): Page {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return PATH_TO_PAGE[path] ?? Page.HOME;
}

// ─── Loading Screen ───────────────────────────────────────────
const LoadingScreen: React.FC = () => (
  <div className="flex items-center justify-center h-full w-full text-slate-400">
    Loading...
  </div>
);

const App: React.FC = () => {
  const auth = useAuth();

  // Initialise page from the browser URL so deep-links work
  const [currentPage, setCurrentPage] = useState<Page>(() => pageFromUrl());
  const [wizardSpec, setWizardSpec] = useState<string | null>(null);
  const [wizardUserType, setWizardUserType] = useState<'developer' | 'business_owner'>('developer');

  // ─── URL sync: push the URL whenever currentPage changes ──
  useEffect(() => {
    const targetPath = PAGE_TO_PATH[currentPage] ?? '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ page: currentPage }, '', targetPath);
    }
    // Update document title based on current page
    const titles: Record<Page, string> = {
      [Page.HOME]: 'Agdi.dev — The Autonomous Dev Squad',
      [Page.PRODUCTS]: 'Products — Agdi.dev',
      [Page.SOLUTIONS]: 'Solutions — Agdi.dev',
      [Page.DEVELOPERS]: 'Developers — Agdi.dev',
      [Page.DEDICATION]: 'Dedication — Agdi.dev',
      [Page.WIZARD]: 'Create Project — Agdi.dev',
      [Page.AUTH]: 'Log In — Agdi.dev',
      [Page.PRICING]: 'Pricing — Agdi.dev',
      [Page.DASHBOARD]: 'Dashboard — Agdi.dev',
      [Page.BUILDER]: 'Builder — Agdi.dev',
      [Page.DOCS]: 'Documentation — Agdi.dev',
      [Page.ABOUT]: 'About — Agdi.dev',
      [Page.LEGAL]: 'Legal — Agdi.dev',
    };
    document.title = titles[currentPage] ?? 'Agdi.dev';
  }, [currentPage]);

  // ─── Handle browser back/forward buttons ───────────────────
  useEffect(() => {
    const onPopState = () => {
      setCurrentPage(pageFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Wizard completes → go to auth page first
  const handleWizardComplete = useCallback((spec: string, userType: 'developer' | 'business_owner') => {
    setWizardSpec(spec);
    setWizardUserType(userType);

    // If already authenticated (e.g., returning user), skip auth and go to dashboard
    if (auth.isConfigured && auth.isAuthenticated) {
      setCurrentPage(Page.DASHBOARD);
    } else {
      setCurrentPage(Page.AUTH);
    }
  }, [auth.isAuthenticated, auth.isConfigured]);

  // Auth completes → go to dashboard
  const handleAuthenticated = useCallback(() => {
    setCurrentPage(Page.DASHBOARD);
  }, []);

  // Pages that should hide the main navigation
  const hideNav = [Page.BUILDER, Page.WIZARD, Page.PRICING, Page.AUTH, Page.DASHBOARD].includes(currentPage);

  // Pages that should be full-screen (no scroll)
  const fullScreen = [Page.BUILDER, Page.WIZARD, Page.AUTH].includes(currentPage);

  // Sync wizard user type from auth (after OAuth redirect refresh)
  useEffect(() => {
    if (auth.userType) {
      setWizardUserType(auth.userType);
    }
  }, [auth.userType]);

  // Post-auth default route: if user is authenticated and lands on HOME (e.g., OAuth redirect), send to dashboard.
  useEffect(() => {
    if (!auth.isConfigured) return;
    if (auth.isLoading) return;

    if (auth.isAuthenticated) {
      if (currentPage === Page.HOME || currentPage === Page.AUTH) {
        setCurrentPage(Page.DASHBOARD);
      }
    }
  }, [auth.isAuthenticated, auth.isConfigured, auth.isLoading, currentPage]);

  // Guard protected pages
  useEffect(() => {
    if (!auth.isConfigured) return;
    if (auth.isLoading) return;

    const protectedPages = [Page.DASHBOARD, Page.BUILDER];
    if (protectedPages.includes(currentPage) && !auth.isAuthenticated) {
      setCurrentPage(Page.AUTH);
    }
  }, [auth.isAuthenticated, auth.isConfigured, auth.isLoading, currentPage]);

  const renderPage = () => {
    switch (currentPage) {
      case Page.HOME:
        return <LandingPage onNavigate={setCurrentPage} />;
      case Page.PRODUCTS:
        return <LandingPage initialSection="products" onNavigate={setCurrentPage} />;
      case Page.SOLUTIONS:
        return <LandingPage initialSection="solutions" onNavigate={setCurrentPage} />;
      case Page.DEVELOPERS:
        return <LandingPage initialSection="developers" onNavigate={setCurrentPage} />;
      case Page.DEDICATION:
        return <Dedication />;
      case Page.WIZARD:
        return (
          <WizardPage
            onBack={() => setCurrentPage(Page.HOME)}
            onComplete={handleWizardComplete}
          />
        );
      case Page.AUTH:
        return (
          <AuthPage
            userType={wizardUserType}
            onBack={() => setCurrentPage(Page.WIZARD)}
            onAuthenticated={handleAuthenticated}
          />
        );
      case Page.DASHBOARD:
        // If auth is configured but user is not authenticated, show auth page
        if (auth.isConfigured && !auth.isLoading && !auth.isAuthenticated) {
          return (
            <AuthPage
              userType={wizardUserType}
              onBack={() => setCurrentPage(Page.HOME)}
              onAuthenticated={handleAuthenticated}
            />
          );
        }
        return (
          <Dashboard
            userEmail={auth.user?.email ?? null}
            onSignOut={async () => {
              await auth.signOut();
              setWizardSpec(null);
              setCurrentPage(Page.HOME);
            }}
            onCreateNew={() => setCurrentPage(Page.WIZARD)}
            onOpenBuilder={() => setCurrentPage(Page.BUILDER)}
            onOpenProject={async (projectId) => {
              // Load project into the global localProjectManager via the hook
              const { localProjectManager } = await import('./lib/local-project-manager');
              await localProjectManager.loadProjectById(projectId);
              setCurrentPage(Page.BUILDER);
            }}
          />
        );
      case Page.BUILDER:
        // Auth guard (handled by effect too, but keep safe)
        if (auth.isConfigured && !auth.isLoading && !auth.isAuthenticated) {
          return (
            <AuthPage
              userType={wizardUserType}
              onBack={() => setCurrentPage(Page.HOME)}
              onAuthenticated={handleAuthenticated}
            />
          );
        }
        // Soft launch lock
        if (isComingSoonMode()) {
          return <ComingSoon onBack={() => setCurrentPage(Page.HOME)} />;
        }
        // Developers → full IDE, Business owners → simplified view
        if (wizardUserType === 'business_owner' && wizardSpec) {
          return <SimpleBuilder wizardSpec={wizardSpec} onBack={() => setCurrentPage(Page.DASHBOARD)} />;
        }
        return <Builder onBack={() => setCurrentPage(Page.DASHBOARD)} wizardSpec={wizardSpec ?? undefined} />;
      case Page.DOCS:
        return <Docs onBack={() => setCurrentPage(Page.HOME)} />;
      case Page.ABOUT:
        return <About onBack={() => setCurrentPage(Page.HOME)} />;
      case Page.LEGAL:
        return <Legal onBack={() => setCurrentPage(Page.HOME)} />;
      case Page.PRICING:
        return <PricingPage onBack={() => setCurrentPage(Page.HOME)} onSelectPlan={(tier) => {
          if (tier === 'free') setCurrentPage(Page.WIZARD);
          else alert(`Stripe checkout for "${tier}" plan coming soon!`);
        }} />;
      default:
        return <LandingPage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen text-white selection:bg-cyan-500/30 font-sans overflow-x-hidden relative">
      <div className="bg-noise"></div>
      {!hideNav && <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />}

      <main className={`relative z-10 w-full ${fullScreen ? 'h-screen overflow-hidden' : ''}`}>
        <Suspense fallback={<LoadingScreen />}>
          {renderPage()}
        </Suspense>
      </main>

      {currentPage === Page.DEDICATION && (
        <footer className="fixed bottom-4 left-6 z-50 pointer-events-none">
          <div className="text-[10px] text-slate-600 font-mono tracking-widest uppercase">
            Agdi Systems © 2026
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;
