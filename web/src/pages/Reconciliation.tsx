import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFromBackend, getFriendlyErrorMessage } from '../utils/api';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Filter,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';

interface LedgerEntry {
  type: 'collection' | 'disbursement';
  orderId: string;
  amountInPesewas: number;
  moolreFeeInPesewas: number;
  moolreTransactionId: string;
  status: string;
  timestamp: string;
}

interface PaginatedLedger {
  data: LedgerEntry[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

export default function Reconciliation() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const { data: summary, error: summaryError } = useQuery({
    queryKey: ['reconciliationSummary', startDate, endDate],
    queryFn: () => {
      let url = '/reconciliation/summary';
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      if (endDate) params.set('endDate', new Date(endDate).toISOString());
      const queryStr = params.toString();
      return fetchFromBackend(queryStr ? `${url}?${queryStr}` : url);
    },
  });

  const {
    data: ledger,
    isLoading: isLedgerLoading,
    error: ledgerError,
  } = useQuery<PaginatedLedger>({
    queryKey: ['reconciliationTransactions', typeFilter, startDate, endDate, cursor],
    queryFn: () => {
      let url = `/reconciliation/transactions?limit=15`;
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      if (endDate) params.set('endDate', new Date(endDate).toISOString());
      if (cursor) params.set('cursor', cursor);

      const queryStr = params.toString();
      return fetchFromBackend(queryStr ? `/reconciliation/transactions?${queryStr}` : url);
    },
  });

  const formatGhs = (pesewas: number) => {
    return `$ ${(pesewas / 100).toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (['success', 'completed'].includes(s)) {
      return <span className="badge-monef-success">{status.replace('_', ' ')}</span>;
    }
    if (['pending', 'processing'].includes(s)) {
      return <span className="badge-monef-warning">{status.replace('_', ' ')}</span>;
    }
    return <span className="badge-monef-error">{status.replace('_', ' ')}</span>;
  };

  const handleNextPage = () => {
    if (ledger?.pagination.nextCursor) {
      setCursorHistory((prev) => [...prev, cursor || '']);
      setCursor(ledger.pagination.nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (cursorHistory.length > 0) {
      const prevCursor = cursorHistory[cursorHistory.length - 1];
      setCursorHistory((prev) => prev.slice(0, -1));
      setCursor(prevCursor || undefined);
    }
  };

  useEffect(() => {
    setCursor(undefined);
    setCursorHistory([]);
  }, [typeFilter, startDate, endDate]);

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
          Reconciliation Portal
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Financial settlement audits, ledger listings, and fee checks.
        </p>
      </div>

      {summaryError && (
        <div className="glass-panel" style={{ borderColor: 'var(--color-error)', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--text-primary)', marginBottom: '24px' }}>
          <h3 style={{ color: 'var(--color-error)', fontWeight: 600, marginBottom: '8px' }}>Failed to retrieve stats</h3>
          <p>{getFriendlyErrorMessage(summaryError)}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* LEFT COLUMN (~30% width) */}
        <div style={{ flex: '0 0 32%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {summary && (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>
                  <TrendingUp size={24} />
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                    Total Collected (In)
                  </span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>
                    {formatGhs(summary.totalCollectedInPesewas)}
                  </span>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border-color)', width: '100%' }} />

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)' }}>
                  <TrendingDown size={24} />
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                    Total Disbursed (Out)
                  </span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>
                    {formatGhs(summary.totalDisbursedInPesewas)}
                  </span>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border-color)', width: '100%' }} />

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' }}>
                  <Clock size={24} />
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                    Unsettled Balances
                  </span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-warning)' }}>
                    {formatGhs(summary.outstandingUnsettledInPesewas)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>Filter Records</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Transaction Type</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '8px 16px' }}>
                <Filter size={14} color="var(--text-secondary)" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem', padding: '4px 0', WebkitAppearance: 'none' }}
                >
                  <option value="all">All Transactions</option>
                  <option value="collection">Collections (Inflow)</option>
                  <option value="disbursement">Disbursements (Outflow)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Date Range</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '8px 16px', marginBottom: '8px' }}>
                <Calendar size={14} color="var(--text-secondary)" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem', padding: '4px 0', WebkitAppearance: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '8px 16px' }}>
                <Calendar size={14} color="var(--text-secondary)" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem', padding: '4px 0', WebkitAppearance: 'none' }}
                />
              </div>
            </div>

            <button style={{ width: '100%', padding: '12px', borderRadius: '99px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', marginTop: '8px', transition: 'var(--transition-smooth)' }} onClick={() => { setStartDate(''); setEndDate(''); setTypeFilter('all'); }}>
              Clear Filters
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN (~70% width) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Transaction History</h3>
            </div>

            {isLedgerLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid var(--bg-tertiary)', borderTopColor: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : ledgerError ? (
              <div style={{ padding: '24px', color: 'var(--color-error)' }}>
                {getFriendlyErrorMessage(ledgerError)}
              </div>
            ) : !ledger || ledger.data.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', flex: 1 }}>
                No transaction records found matching these criteria.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table className="monef-table" style={{ borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Timestamp</th>
                      <th style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Type</th>
                      <th style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Order ID</th>
                      <th style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Amount</th>
                      <th style={{ paddingRight: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.data.map((tx, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ paddingLeft: '24px', paddingBottom: '12px', paddingTop: '12px' }}>
                          {new Date(tx.timestamp).toLocaleString()}
                        </td>
                        <td style={{ paddingBottom: '12px', paddingTop: '12px' }}>
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
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>Fee: {formatGhs(tx.moolreFeeInPesewas)}</div>
                        </td>
                        <td style={{ paddingRight: '24px', paddingBottom: '12px', paddingTop: '12px' }}>
                          {getStatusBadge(tx.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {ledger && (ledger.pagination.hasMore || cursorHistory.length > 0) && (
              <div className="flex-between" style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                <button
                  onClick={handlePrevPage}
                  disabled={cursorHistory.length === 0}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}
                >
                  <ChevronLeft size={16} /> Older
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Page {cursorHistory.length + 1}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={!ledger.pagination.hasMore}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}
                >
                  Newer <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
