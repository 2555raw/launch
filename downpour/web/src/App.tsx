import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { WalletProvider } from './wallet/WalletProvider';
import { PadProvider } from './backend/PadProvider';
import { StormProvider } from './storm/Storm';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';

const Swap = lazy(() => import('./pages/Swap'));
const Board = lazy(() => import('./pages/Board'));
const CoinPage = lazy(() => import('./pages/CoinPage'));
const Launch = lazy(() => import('./pages/Launch'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Desk = lazy(() => import('./pages/Desk'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Proof = lazy(() => import('./pages/Proof'));
const Verify = lazy(() => import('./pages/Verify'));
const Faq = lazy(() => import('./pages/Faq'));
const NotFound = lazy(() => import('./pages/NotFound'));

export function App() {
  return (
    <WalletProvider>
      <PadProvider>
        <StormProvider>
          <Layout>
            <Suspense fallback={<div className="wrap"><div className="skeleton" style={{ height: 320 }} /></div>}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/swap" element={<Swap />} />
                <Route path="/board" element={<Board />} />
                <Route path="/coin/:address" element={<CoinPage />} />
                <Route path="/launch" element={<Launch />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/desk" element={<Desk />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/proof" element={<Proof />} />
                <Route path="/verify" element={<Verify />} />
                <Route path="/faq" element={<Faq />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Layout>
        </StormProvider>
      </PadProvider>
    </WalletProvider>
  );
}
