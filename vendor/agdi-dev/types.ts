
export enum AppState {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export enum Page {
  HOME = 'HOME',
  DEDICATION = 'DEDICATION',
  PRODUCTS = 'PRODUCTS',     // Placeholder for nav link
  SOLUTIONS = 'SOLUTIONS',   // Placeholder for nav link
  DEVELOPERS = 'DEVELOPERS', // Placeholder for nav link
  WIZARD = 'wizard',         // Question-driven wizard flow
  AUTH = 'auth',             // Authentication page
  PRICING = 'pricing',       // Pricing page
  DASHBOARD = 'dashboard',   // Post-auth landing
  BUILDER = 'builder',       // IDE Page
  DOCS = 'docs',             // Documentation
  ABOUT = 'about',
  LEGAL = 'legal'
}

export interface GeneratedAsset {
  id: string;
  url: string;
  prompt: string;
  createdAt: number;
}

export interface NavItem {
  label: string;
  page: Page;
  active?: boolean;
}
