import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './supabase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LiveOrders from './pages/LiveOrders';
import OrderDetail from './pages/OrderDetail';
import Reconciliation from './pages/Reconciliation';
import Vendors from './pages/Vendors';
import Products from './pages/Products';
import {
  LayoutDashboard,
  Activity,
  DollarSign,
  Users,
  ShoppingBag,
  LogOut,
  Menu,
  X,
  Cpu,
} from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function MainApp() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation state
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Mobile sidebar visibility
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setActivePage('dashboard');
  };

  const navigateTo = (page: string) => {
    setActivePage(page);
    setSelectedOrderId(null);
    setSidebarOpen(false);
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setActivePage('order-detail');
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{
          width: '45px',
          height: '45px',
          borderRadius: '50%',
          border: '3px solid var(--bg-tertiary)',
          borderTopColor: 'var(--accent-primary)',
          animation: 'spin 1s linear infinite'
        }} />
        <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}} />
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={() => {}} />;
  }

  // Render active page component
  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard onNavigate={navigateTo} />;
      case 'live-orders':
        return <LiveOrders onSelectOrder={handleSelectOrder} />;
      case 'order-detail':
        return selectedOrderId ? (
          <OrderDetail orderId={selectedOrderId} onBack={() => navigateTo('live-orders')} />
        ) : (
          <LiveOrders onSelectOrder={handleSelectOrder} />
        );
      case 'reconciliation':
        return <Reconciliation />;
      case 'vendors':
        return <Vendors />;
      case 'products':
        return <Products />;
      default:
        return <Dashboard onNavigate={navigateTo} />;
    }
  };

  const navigationItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'live-orders', name: 'Live Board', icon: <Activity size={20} /> },
    { id: 'reconciliation', name: 'Reconciliation', icon: <DollarSign size={20} /> },
    { id: 'vendors', name: 'Vendors', icon: <Users size={20} /> },
    { id: 'products', name: 'Products', icon: <ShoppingBag size={20} /> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      
      {/* Mobile Header */}
      <header style={{
        display: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 20px',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 50,
      }} className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Cpu size={24} color="var(--accent-primary)" />
          <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#ffffff' }}>Maame</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside style={{
        width: '260px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 40,
        transition: 'transform 0.3s ease',
      }} className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px', paddingLeft: '8px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 10px rgba(99, 102, 241, 0.3)'
          }}>
            <Cpu size={18} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              Maame Admin
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>V1.0 staff terminal</span>
          </div>
        </div>

        {/* Navigation links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          {navigationItems.map((item) => {
            const isActive = activePage === item.id || (activePage === 'order-detail' && item.id === 'live-orders');
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: '10px',
                  background: isActive ? 'var(--accent-primary-glow)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  fontFamily: 'inherit',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'var(--transition-smooth)',
                  borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {item.icon}
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Footer session card */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingLeft: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '0.85rem' }}>
              {session.user.email?.charAt(0).toUpperCase() || 'S'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session.user.email}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Staff Session</span>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="btn-secondary"
            style={{ width: '100%', padding: '10px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--color-error)', background: 'transparent' }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main View Area */}
      <main style={{
        flex: 1,
        marginLeft: '260px',
        padding: '40px',
        minHeight: '100vh',
        transition: 'margin 0.3s ease',
      }} className="main-content">
        {renderContent()}
      </main>

      {/* Media query styling overrides injected dynamically */}
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .mobile-header {
            display: flex !important;
          }
          .sidebar {
            transform: translateX(-260px);
            top: 64px !important;
          }
          .sidebar.open {
            transform: translateX(0);
          }
          .main-content {
            margin-left: 0 !important;
            padding: 84px 20px 40px 20px !important;
          }
        }
      `}} />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainApp />
    </QueryClientProvider>
  );
}
