import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { fetchFromBackend, getFriendlyErrorMessage } from '../utils/api';
import {
  Filter,
  WifiOff,
  Search,
  ChevronRight,
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
  // Ref mirror so interval callbacks never capture stale state
  const realtimeStatusRef = useRef<string>('connecting');

  // Keep refs in sync so interval callbacks can access latest values without stale closures
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    realtimeStatusRef.current = realtimeStatus;
  }, [realtimeStatus]);

  // Initial load
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

  // Supabase Realtime logic + fallback polling
  useEffect(() => {
    // 1. Subscribe to Realtime
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
          // If not subscribed, start a 60s timer to show the "live updates paused" banner
          setRealtimeStatus('disconnected');
          if (!disconnectTimerRef.current) {
            disconnectTimerRef.current = setTimeout(() => {
              setShowWarningBanner(true);
            }, 60000);
          }
        }
      });

    // 2. Set up fallback polling (every 5 seconds) if Realtime is not active/connected.
    // Reads from realtimeStatusRef (not state) to avoid stale closure — the interval
    // is created once on mount and must not re-subscribe on every status change.
    const pollingInterval = setInterval(async () => {
      // Contract §4.1: fall back to GET /v1/orders?since={lastSeenTimestamp} every 5 s
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
              // Sort by createdAt desc
              return updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            });
          }
        } catch (err) {
          console.error('Fallback polling failed:', err);
        }
      }
    }, 5000);

    return () => {
      channel.unsubscribe();
      clearInterval(pollingInterval);
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
      }
    };
    // Effect runs exactly once on mount — channel subscription must not be torn
    // down and recreated on every status change (that would cause a reconnect loop).
  }, []);

  // Formatter utilities
  const formatGhs = (pesewas: number) => {
    return `GHS ${(pesewas / 100).toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (['paid', 'disbursed', 'delivered'].includes(s)) {
      return <span className="badge badge-success">{status}</span>;
    }
    if (['confirming_order', 'awaiting_payment', 'out_for_delivery', 'vendor_notified'].includes(s)) {
      return <span className="badge badge-warning">{status}</span>;
    }
    if (['payment_failed', 'cancelled', 'abandoned'].includes(s)) {
      return <span className="badge badge-danger">{status}</span>;
    }
    return <span className="badge badge-neutral">{status}</span>;
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

  // Filter logic
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
      {/* Warning banner for disconnected realtime updates */}
      {showWarningBanner && (
        <div
          className="flex-between"
          style={{
            background: 'var(--color-error-bg)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '12px',
            padding: '12px 20px',
            color: 'var(--color-error)',
            marginBottom: '24px',
            fontSize: '0.9rem',
            animation: 'fadeIn 0.4s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <WifiOff size={18} />
            <strong>Live updates paused.</strong>
            <span>Unable to establish WebSockets. Reverted to polling.</span>
          </div>
          <button
            onClick={() => loadInitialOrders()}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            Force Refresh
          </button>
        </div>
      )}

      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Live Monitoring Board
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Watch active phone calls and USSD interactions complete in real-time.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: realtimeStatus === 'connected' ? 'var(--color-success)' : 'var(--color-warning)',
              display: 'inline-block',
              boxShadow: realtimeStatus === 'connected' ? '0 0 10px var(--color-success)' : 'none',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
            Realtime: {realtimeStatus}
          </span>
        </div>
      </div>

      {/* Filter / Search panel */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          marginBottom: '24px',
          padding: '16px 20px',
        }}
      >
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
          <input
            type="text"
            placeholder="Search by phone or Order ID..."
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            className="premium-input"
            style={{ paddingLeft: '40px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="var(--text-secondary)" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="premium-input"
              style={{ padding: '8px 12px', width: '160px', background: 'var(--bg-tertiary)' }}
            >
              <option value="all">All Statuses</option>
              <option value="collecting_items">Collecting Items</option>
              <option value="confirming_order">Confirming Order</option>
              <option value="awaiting_payment">Awaiting Payment</option>
              <option value="paid">Paid</option>
              <option value="vendor_notified">Vendor Notified</option>
              <option value="out_for_delivery">Out For Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="disbursed">Disbursed</option>
              <option value="payment_failed">Payment Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </div>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="premium-input"
            style={{ padding: '8px 12px', width: '130px', background: 'var(--bg-tertiary)' }}
          >
            <option value="all">All Channels</option>
            <option value="voice">Voice Call</option>
            <option value="ussd">USSD Session</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '3px solid var(--bg-tertiary)',
            borderTopColor: 'var(--accent-primary)',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      )}

      {error && (
        <div className="glass-panel" style={{ borderColor: 'var(--color-error)', background: 'var(--color-error-bg)', color: 'var(--text-primary)' }}>
          <h3 style={{ color: 'var(--color-error)', fontWeight: 600, marginBottom: '8px' }}>Failed to retrieve orders</h3>
          <p>{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {filteredOrders.length === 0 ? (
            <div
              className="glass-panel"
              style={{
                textAlign: 'center',
                padding: '48px',
                borderStyle: 'dashed',
                background: 'transparent',
                color: 'var(--text-secondary)',
              }}
            >
              No orders found matching the filter criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="glass-panel"
                  onClick={() => onSelectOrder(order.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 24px',
                    cursor: 'pointer',
                    gap: '20px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background:
                          order.channel === 'voice'
                            ? 'rgba(99, 102, 241, 0.1)'
                            : 'rgba(6, 182, 212, 0.1)',
                        color: order.channel === 'voice' ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {order.channel === 'voice' ? <PhoneCall size={20} /> : <Laptop size={20} />}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '1rem' }}>
                          {order.customerPhone}
                        </span>
                        <span
                          style={{
                            color: 'var(--text-muted)',
                            fontSize: '0.75rem',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                          }}
                        >
                          ID: {order.id.slice(0, 8)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Created {getTimeAgo(order.createdAt)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '1.05rem', marginBottom: '4px' }}>
                        {formatGhs(order.totalInPesewas)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Fee: {formatGhs(order.serviceFeeInPesewas)}
                      </div>
                    </div>

                    <div style={{ width: '140px', display: 'flex', justifyContent: 'flex-end' }}>
                      {getStatusBadge(order.status)}
                    </div>

                    <ChevronRight size={20} color="var(--text-muted)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
