import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { fetchFromBackend, getFriendlyErrorMessage } from '../utils/api';
import {
  Filter,
  WifiOff,
  Search,
  MoreHorizontal,
  PhoneCall,
  Laptop,
} from 'lucide-react';

interface Order {
  id: string;
  customerPhone: string;
  channel: 'voice' | 'ussd';
  status: string;
  totalInPesewas: number;
  serviceFeeInPesewas: number;
  createdAt: string;
  updatedAt: string;
}

interface LiveOrdersProps {
  onSelectOrder: (orderId: string) => void;
}

export default function LiveOrders({ onSelectOrder }: LiveOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [searchPhone, setSearchPhone] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Realtime & Polling status
  const [realtimeStatus, setRealtimeStatus] = useState<string>('connecting');
  const [showWarningBanner, setShowWarningBanner] = useState<boolean>(false);

  const ordersRef = useRef<Order[]>([]);
  const disconnectTimerRef = useRef<any | null>(null);
  const realtimeStatusRef = useRef<string>('connecting');

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    realtimeStatusRef.current = realtimeStatus;
  }, [realtimeStatus]);

  const loadInitialOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchFromBackend('/orders?limit=50');
      setOrders(response.data || []);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialOrders();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('orders-logical-replication')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          if (eventType === 'INSERT') {
            setOrders((prev) => [newRow as Order, ...prev]);
          } else if (eventType === 'UPDATE') {
            setOrders((prev) =>
              prev.map((order) => (order.id === newRow.id ? (newRow as Order) : order))
            );
          } else if (eventType === 'DELETE') {
            setOrders((prev) => prev.filter((order) => order.id !== oldRow.id));
          }
        }
      )
      .subscribe((status) => {
        setRealtimeStatus(status);
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          setShowWarningBanner(false);
          if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
          }
        } else {
          setRealtimeStatus('disconnected');
          if (!disconnectTimerRef.current) {
            disconnectTimerRef.current = setTimeout(() => {
              setShowWarningBanner(true);
            }, 60000);
          }
        }
      });

    const pollingInterval = setInterval(async () => {
      if (realtimeStatusRef.current !== 'connected') {
        const latestOrder = ordersRef.current[0];
        const since = latestOrder ? latestOrder.updatedAt : new Date(Date.now() - 30000).toISOString();
        try {
          const response = await fetchFromBackend(`/orders?since=${since}&limit=50`);
          if (response.data && response.data.length > 0) {
            setOrders((prev) => {
              let updated = [...prev];
              response.data.forEach((newOrder: Order) => {
                const index = updated.findIndex((o) => o.id === newOrder.id);
                if (index !== -1) {
                  updated[index] = newOrder;
                } else {
                  updated = [newOrder, ...updated];
                }
              });
              return updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            });
          }
        } catch (err) {}
      }
    }, 5000);

    return () => {
      channel.unsubscribe();
      clearInterval(pollingInterval);
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
      }
    };
  }, []);

  const formatGhs = (pesewas: number) => {
    return `$ ${(pesewas / 100).toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (['paid', 'disbursed', 'delivered'].includes(s)) {
      return <span className="badge-monef-success">{status.replace('_', ' ')}</span>;
    }
    if (['confirming_order', 'awaiting_payment', 'out_for_delivery', 'vendor_notified'].includes(s)) {
      return <span className="badge-monef-warning">{status.replace('_', ' ')}</span>;
    }
    if (['payment_failed', 'cancelled', 'abandoned'].includes(s)) {
      return <span className="badge-monef-error">{status.replace('_', ' ')}</span>;
    }
    return <span className="badge-monef-neutral">{status.replace('_', ' ')}</span>;
  };

  const getTimeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesChannel = channelFilter === 'all' || order.channel === channelFilter;
    const matchesSearch =
      searchPhone === '' ||
      order.customerPhone.includes(searchPhone) ||
      order.id.toLowerCase().includes(searchPhone.toLowerCase());

    return matchesStatus && matchesChannel && matchesSearch;
  });

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {showWarningBanner && (
        <div className="flex-between" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '12px 20px', color: 'var(--color-error)', marginBottom: '24px', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <WifiOff size={18} />
            <strong>Live updates paused.</strong>
            <span>Unable to establish WebSockets. Reverted to polling.</span>
          </div>
          <button onClick={() => loadInitialOrders()} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            Force Refresh
          </button>
        </div>
      )}

      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
            Live Monitoring Board
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Watch active phone calls and USSD interactions complete in real-time.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* LEFT COLUMN (~30% width) */}
        <div style={{ flex: '0 0 32%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="flex-between">
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>Status</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '99px', fontSize: '0.75rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: realtimeStatus === 'connected' ? 'var(--color-success)' : 'var(--color-warning)', display: 'inline-block', boxShadow: realtimeStatus === 'connected' ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none' }} />
                <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {realtimeStatus}
                </span>
              </div>
            </div>
            
            <div style={{ position: 'relative' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search phone or ID..."
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                className="premium-input"
                style={{ paddingLeft: '44px', background: 'rgba(255,255,255,0.02)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filter by Status</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '8px 16px' }}>
                <Filter size={14} color="var(--text-secondary)" />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem', padding: '4px 0', WebkitAppearance: 'none' }}>
                  <option value="all">All Statuses</option>
                  <option value="collecting_items">Collecting Items</option>
                  <option value="confirming_order">Confirming Order</option>
                  <option value="paid">Paid</option>
                  <option value="out_for_delivery">Out For Delivery</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filter by Channel</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '8px 16px' }}>
                <PhoneCall size={14} color="var(--text-secondary)" />
                <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem', padding: '4px 0', WebkitAppearance: 'none' }}>
                  <option value="all">All Channels</option>
                  <option value="voice">Voice Call</option>
                  <option value="ussd">USSD Session</option>
                </select>
              </div>
            </div>
            
          </div>
        </div>

        {/* RIGHT COLUMN (~70% width) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid var(--bg-tertiary)', borderTopColor: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
            </div>
          )}

          {error && (
            <div className="glass-panel" style={{ borderColor: 'var(--color-error)', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--text-primary)' }}>
              <h3 style={{ color: 'var(--color-error)', fontWeight: 600, marginBottom: '8px' }}>Failed to retrieve orders</h3>
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && (
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
              <table className="monef-table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: '24px' }}>Customer / ID</th>
                    <th>Channel</th>
                    <th>Time</th>
                    <th>Total / Fee</th>
                    <th>Status</th>
                    <th style={{ paddingRight: '24px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                        No orders found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} onClick={() => onSelectOrder(order.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ paddingLeft: '24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: order.channel === 'voice' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: order.channel === 'voice' ? 'var(--accent-primary)' : 'var(--accent-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {order.channel === 'voice' ? <PhoneCall size={16} /> : <Laptop size={16} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#ffffff' }}>{order.customerPhone}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {order.id.slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{order.channel}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{getTimeAgo(order.createdAt)}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#ffffff' }}>{formatGhs(order.totalInPesewas)}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fee: {formatGhs(order.serviceFeeInPesewas)}</div>
                        </td>
                        <td>{getStatusBadge(order.status)}</td>
                        <td style={{ paddingRight: '24px', textAlign: 'right' }}>
                          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <MoreHorizontal size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
