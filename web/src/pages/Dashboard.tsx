import { useQuery } from '@tanstack/react-query';
import { fetchFromBackend, getFriendlyErrorMessage } from '../utils/api';
import {
  TrendingUp,
  DollarSign,
  TrendingDown,
  Percent,
  Clock,
  ArrowRight,
  ShieldCheck,
  PhoneCall,
  ShoppingBag,
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['reconciliationSummary'],
    queryFn: () => fetchFromBackend('/reconciliation/summary'),
    refetchInterval: 15000, // refresh every 15s for dynamic stats
  });

  const formatGhs = (pesewas: number) => {
    return `GHS ${(pesewas / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Operations Overview
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Real-time metrics, payment collections, and settlement tracking.
        </p>
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
        <div className="grid-cols-3" style={{ marginBottom: '40px' }}>
          <div className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '80px',
              height: '80px',
              background: 'radial-gradient(circle, var(--accent-primary-glow) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                Total Collections
              </span>
              <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)' }}>
                <TrendingUp size={20} />
              </div>
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              {formatGhs(summary.totalCollectedInPesewas)}
            </h2>
            <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Successfully paid by customers
            </div>
          </div>

          <div className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '80px',
              height: '80px',
              background: 'radial-gradient(circle, var(--accent-secondary-glow) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                Vendor Disbursements
              </span>
              <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-secondary)' }}>
                <TrendingDown size={20} />
              </div>
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              {formatGhs(summary.totalDisbursedInPesewas)}
            </h2>
            <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Transferred to vendor wallets
            </div>
          </div>

          <div className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '80px',
              height: '80px',
              background: 'radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                Pending Settlement
              </span>
              <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' }}>
                <Clock size={20} />
              </div>
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-warning)', letterSpacing: '-0.02em' }}>
              {formatGhs(summary.outstandingUnsettledInPesewas)}
            </h2>
            <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Collected but not yet disbursed
            </div>
          </div>

          <div className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                Service Fee Revenue
              </span>
              <div style={{ padding: '8px', borderRadius: '10px', background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                <Percent size={20} />
              </div>
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)', letterSpacing: '-0.02em' }}>
              {formatGhs(summary.totalServiceFeeRevenueInPesewas)}
            </h2>
            <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Platform commission earnings
            </div>
          </div>

          <div className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                Moolre Transaction Fees
              </span>
              <div style={{ padding: '8px', borderRadius: '10px', background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
                <DollarSign size={20} />
              </div>
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-info)', letterSpacing: '-0.02em' }}>
              {formatGhs(summary.totalMoolreFeesInPesewas)}
            </h2>
            <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Aggregate carrier/gateway fees
            </div>
          </div>

          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.15)', background: 'transparent' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
              System Health
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              All nodes operating nominally. Real-time channels active.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', fontSize: '0.85rem', fontWeight: 600 }}>
              <ShieldCheck size={18} />
              <span>Secure Session Guard Verified</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Launch Panel */}
      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginBottom: '20px' }}>
        Quick Navigation
      </h3>
      <div className="grid-cols-3" style={{ gap: '20px' }}>
        <div className="glass-panel" onClick={() => onNavigate('live-orders')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifySelf: 'stretch', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-primary-glow)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PhoneCall size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>Live Order Feeds</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Monitor incoming voice transcripts</p>
          </div>
          <ArrowRight size={18} color="var(--text-muted)" />
        </div>

        <div className="glass-panel" onClick={() => onNavigate('reconciliation')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifySelf: 'stretch', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-secondary-glow)', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>Reconciliation Ledger</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Audit transactions and collections</p>
          </div>
          <ArrowRight size={18} color="var(--text-muted)" />
        </div>

        <div className="glass-panel" onClick={() => onNavigate('products')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifySelf: 'stretch', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--color-success-bg)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingBag size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>Catalog Management</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Manage products and inventory</p>
          </div>
          <ArrowRight size={18} color="var(--text-muted)" />
        </div>
      </div>
      
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
