import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './supabase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LiveOrders from './pages/LiveOrders';
import OrderDetail from './pages/OrderDetail';
import Reconciliation from './pages/Reconciliation';
import Settings from './pages/Settings';
import HelpCenter from './pages/HelpCenter';
import Vendors from './pages/Vendors';
import Products from './pages/Products';
import {
  Activity,
  DollarSign,
  Users,
  ShoppingBag,
  Settings as SettingsIcon,
  HelpCircle,
  Search,
  MessageSquare,
  Bell,
  Cpu,
  ChevronLeft
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
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-main)' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '3px solid var(--bg-tertiary)',
          borderTopColor: 'var(--accent-secondary)',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={() => {}} />;
  }

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'live-orders': return <LiveOrders onSelectOrder={handleSelectOrder} />;
      case 'order-detail': return selectedOrderId ? <OrderDetail orderId={selectedOrderId} onBack={() => navigateTo('live-orders')} /> : <LiveOrders onSelectOrder={handleSelectOrder} />;
      case 'reconciliation': return <Reconciliation />;
      case 'vendors': return <Vendors />;
      case 'products': return <Products />;
      case 'settings': return <Settings />;
      case 'help-center': return <HelpCenter />;
      default: return <Dashboard />;
    }
  };

  const navigationItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <Cpu size={18} /> }, // Using CPU or MONEF Home icon style
    { id: 'live-orders', name: 'Live Board', icon: <Activity size={18} /> },
    { id: 'reconciliation', name: 'Reconciliation', icon: <DollarSign size={18} /> },
    { id: 'vendors', name: 'Vendors', icon: <Users size={18} /> },
    { id: 'products', name: 'Products', icon: <ShoppingBag size={18} /> },
    { id: 'settings', name: 'Settings', icon: <SettingsIcon size={18} /> },
    { id: 'help-center', name: 'Help Center', icon: <HelpCircle size={18} /> },
  ];

  return (
    <div className="monef-app-container">
      {/* Sidebar Navigation */}
      <aside style={{
        width: '260px',
        background: 'rgba(18, 18, 20, 0.6)',
        backdropFilter: 'blur(16px)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 24px',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 40,
        transition: 'transform 0.3s ease',
      }} className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        
        {/* Brand Header */}
        <div className="flex-between" style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--color-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{ 
                width: '12px', height: '12px', 
                background: '#ffffff', 
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' 
              }} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em' }}>
              MAAME
            </h2>
          </div>
          <button style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Navigation links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {navigationItems.map((item) => {
            const isActive = activePage === item.id || (activePage === 'order-detail' && item.id === 'live-orders');
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  width: '100%',
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: '12px',
                  background: 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  fontFamily: 'inherit',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'var(--transition-smooth)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isActive ? '#ffffff' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive ? 'var(--bg-secondary)' : 'var(--text-secondary)',
                  transition: 'var(--transition-smooth)',
                }}>
                  {item.icon}
                </div>
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Bottom Area (MONEF style credits + user) */}
        <div style={{ marginTop: 'auto' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px', marginBottom: '24px', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ width: '36px', height: '36px', transform: 'rotate(-90deg)' }}>
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--color-success)" strokeWidth="4" strokeDasharray="70, 100" />
                </svg>
                <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '9px', color: '#fff', fontWeight: 700 }}>70%</span>
              </div>
              <div>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', display: 'block' }}>System Load</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px', lineHeight: 1.2 }}>Optimal capacity maintained</span>
              </div>
            </div>

            <button onClick={() => navigateTo('live-orders')} style={{ 
              width: '100%', padding: '10px', borderRadius: '99px', 
              background: 'rgba(255,255,255,0.03)', color: '#ffffff', 
              border: '1px solid transparent', 
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.03), rgba(255,255,255,0.03)), linear-gradient(90deg, #8b5cf6, #3b82f6)',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'var(--transition-smooth)' 
            }} onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 0 15px rgba(139, 92, 246, 0.3)'} onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
              View Live Logs
            </button>
          </div>

          <div className="flex-between">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>
                  {session.user.email?.charAt(0).toUpperCase() || 'S'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>Jhontosan B.</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.email}</span>
              </div>
            </div>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
               <SettingsIcon size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main View Area */}
      <main style={{
        flex: 1,
        marginLeft: '260px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        
        {/* Top Header */}
        <div style={{ 
          height: '80px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '0 40px',
        }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search here..." 
              style={{
                width: '100%',
                background: 'var(--bg-secondary)',
                border: '1px solid rgba(255,255,255,0.03)',
                borderRadius: '99px',
                padding: '12px 16px 12px 44px',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                outline: 'none',
                fontSize: '0.9rem'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Last sync = <strong style={{ color: 'var(--text-primary)' }}>6 seconds ago</strong></span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.03)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <MessageSquare size={16} />
              </button>
              <button style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.03)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}>
                <Bell size={16} />
                <div style={{ position: 'absolute', top: '10px', right: '12px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)' }} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 40px 40px 40px', flex: 1 }}>
          {renderContent()}
        </div>
      </main>

      {/* Global overrides */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
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
