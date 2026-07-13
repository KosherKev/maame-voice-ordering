
import { useQuery } from '@tanstack/react-query';
import { fetchFromBackend, getFriendlyErrorMessage } from '../utils/api';
import {
  Calendar,
  Filter,
  Download,
  RefreshCw,
  BarChart3,
  CreditCard,
  Clock,
  PhoneCall,
  Laptop,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

interface DashboardProps {
  onNavigate?: (page: string) => void;
}

interface Order {
  id: string;
  customerPhone: string;
  channel: 'voice' | 'ussd';
  status: string;
  totalInPesewas: number;
  serviceFeeInPesewas: number;
  createdAt: string;
}

interface LedgerEntry {
  type: 'collection' | 'disbursement';
  orderId: string;
  amountInPesewas: number;
  status: string;
  timestamp: string;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  // Fetch Reconciliation Summary
  const { data: summary, isLoading: isLoadingSummary, error: summaryError } = useQuery({
    queryKey: ['reconciliationSummary'],
    queryFn: () => fetchFromBackend('/reconciliation/summary'),
    refetchInterval: 15000,
  });

  // Fetch Recent Orders to calculate channels and show recent list
  const { data: ordersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['dashboardOrders'],
    queryFn: () => fetchFromBackend('/orders?limit=50'),
    refetchInterval: 15000,
  });

  // Fetch Recent Transactions
  const { data: txData, isLoading: isLoadingTx } = useQuery({
    queryKey: ['dashboardTransactions'],
    queryFn: () => fetchFromBackend('/reconciliation/transactions?limit=5'),
    refetchInterval: 15000,
  });

  const formatGhs = (pesewas: number) => {
    return `$ ${(pesewas / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (['paid', 'disbursed', 'delivered', 'success', 'completed'].includes(s)) {
      return <span className="badge-monef-success">{status.replace('_', ' ')}</span>;
    }
    if (['confirming_order', 'awaiting_payment', 'out_for_delivery', 'vendor_notified', 'pending', 'processing'].includes(s)) {
      return <span className="badge-monef-warning">{status.replace('_', ' ')}</span>;
    }
    if (['payment_failed', 'cancelled', 'abandoned', 'failed'].includes(s)) {
      return <span className="badge-monef-error">{status.replace('_', ' ')}</span>;
    }
    return <span className="badge-monef-neutral">{status.replace('_', ' ')}</span>;
  };

  const orders: Order[] = ordersData?.data || [];
  const transactions: LedgerEntry[] = txData?.data || [];
  
  // Calculate channel percentages
  const totalOrders = orders.length;
  const ussdCount = orders.filter(o => o.channel === 'ussd').length;
  const voiceCount = orders.filter(o => o.channel === 'voice').length;
  
  const ussdPercentage = totalOrders > 0 ? Math.round((ussdCount / totalOrders) * 100) : 0;
  const voicePercentage = totalOrders > 0 ? Math.round((voiceCount / totalOrders) * 100) : 0;

  const isLoading = isLoadingSummary || isLoadingOrders || isLoadingTx;
  const error = summaryError;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header Area */}
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
            Hello, Staff!
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Good morning, today is the best day to manage your operations.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '99px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <Calendar size={14} />
            <span>Today</span>
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '99px', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <Filter size={14} /> Filter
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '99px', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <Download size={14} /> Export
          </button>
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
        <div className="glass-panel" style={{ borderColor: 'var(--color-error)', background: 'var(--color-error-bg)', color: 'var(--text-primary)', marginBottom: '24px' }}>
          <h3 style={{ color: 'var(--color-error)', fontWeight: 600, marginBottom: '8px' }}>Metrics Loading Failed</h3>
          <p>{getFriendlyErrorMessage(error)}</p>
        </div>
      )}

      {!isLoading && !error && summary && (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          
          {/* LEFT COLUMN (~30% width) */}
          <div style={{ flex: '0 0 32%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Active Channels Overview */}
            <div className="glass-panel" style={{ 
              display: 'flex',
              flexDirection: 'column',
              minHeight: '280px'
            }}>
              <div className="flex-between" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>
                   Active Channels (Recent)
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                    <Laptop size={18} color="var(--accent-primary)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="flex-between">
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>USSD Orders</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{ussdPercentage}%</span>
                    </div>
                    <div style={{ height: '4px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', marginTop: '6px' }}>
                      <div style={{ height: '100%', width: `${ussdPercentage}%`, background: 'var(--accent-primary)', borderRadius: '99px', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <PhoneCall size={18} color="#3b82f6" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="flex-between">
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>Voice IVR</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{voicePercentage}%</span>
                    </div>
                    <div style={{ height: '4px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', marginTop: '6px' }}>
                      <div style={{ height: '100%', width: `${voicePercentage}%`, background: '#3b82f6', borderRadius: '99px', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 'auto' }}>
                  Based on the {totalOrders} most recent orders.
                </div>

              </div>
            </div>

            {/* Service Fee Revenue */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="flex-between" style={{ color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
                  <RefreshCw size={16} /> Total Service Fee Revenue
                </div>
              </div>
              
              <div>
                <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>
                  {formatGhs(summary.totalServiceFeeRevenueInPesewas || 0)}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>From completed orders</span>
                </div>
              </div>

              <button style={{ width: '100%', padding: '14px', borderRadius: '99px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-primary)', color: '#fff', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', marginTop: '12px' }}>
                Exchange Balance
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN (~70% width) */}
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* ROW 1: 3 Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
              <div className="glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                  <BarChart3 size={16} /> Total Collections
                </div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                  {formatGhs(summary.totalCollectedInPesewas)}
                </h2>
                <div className="flex-between" style={{ alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current period</span>
                </div>
              </div>

              <div className="glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                  <CreditCard size={16} /> Vendor Disbursements
                </div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                  {formatGhs(summary.totalDisbursedInPesewas)}
                </h2>
                <div className="flex-between" style={{ alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current period</span>
                </div>
              </div>

              <div className="glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                  <Clock size={16} /> Pending Settlement
                </div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-warning)', marginBottom: '8px' }}>
                  {formatGhs(summary.outstandingUnsettledInPesewas)}
                </h2>
                <div className="flex-between" style={{ alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Outstanding</span>
                </div>
              </div>
            </div>

            {/* ROW 2: Recent Orders */}
            <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
              <div className="flex-between" style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Recent Orders</h3>
                {onNavigate && (
                  <button onClick={() => onNavigate('LiveOrders')} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
                    View All
                  </button>
                )}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="monef-table" style={{ borderSpacing: 0, margin: 0, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>ID / Phone</th>
                      <th style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Channel</th>
                      <th style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Total</th>
                      <th style={{ paddingRight: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 5).map((order) => (
                      <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ paddingLeft: '24px', paddingBottom: '12px', paddingTop: '12px' }}>
                          <div style={{ fontWeight: 600, color: '#ffffff' }}>{order.customerPhone}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {order.id.slice(0, 8)}</div>
                        </td>
                        <td style={{ paddingBottom: '12px', paddingTop: '12px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                          {order.channel}
                        </td>
                        <td style={{ fontWeight: 600, color: '#ffffff', paddingBottom: '12px', paddingTop: '12px' }}>
                          {formatGhs(order.totalInPesewas)}
                        </td>
                        <td style={{ paddingRight: '24px', paddingBottom: '12px', paddingTop: '12px' }}>
                          {getStatusBadge(order.status)}
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No recent orders found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ROW 3: Recent Transactions */}
            <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
              <div className="flex-between" style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Recent Transactions</h3>
                {onNavigate && (
                  <button onClick={() => onNavigate('Reconciliation')} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
                    View All
                  </button>
                )}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="monef-table" style={{ borderSpacing: 0, margin: 0, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Type</th>
                      <th style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Order ID</th>
                      <th style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Amount</th>
                      <th style={{ paddingRight: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ paddingLeft: '24px', paddingBottom: '12px', paddingTop: '12px' }}>
                          {tx.type === 'collection' ? (
                            <span style={{ color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                              <ArrowLeft size={14} /> Inflow
                            </span>
                          ) : (
                            <span style={{ color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                              <ArrowRight size={14} /> Outflow
                            </span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)', paddingBottom: '12px', paddingTop: '12px' }}>
                          {tx.orderId.slice(0, 8)}...
                        </td>
                        <td style={{ fontWeight: 700, color: '#ffffff', paddingBottom: '12px', paddingTop: '12px' }}>
                          {formatGhs(tx.amountInPesewas)}
                        </td>
                        <td style={{ paddingRight: '24px', paddingBottom: '12px', paddingTop: '12px' }}>
                          {getStatusBadge(tx.status)}
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No recent transactions found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Styles injection for spin */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
