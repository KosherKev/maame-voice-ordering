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

  // Pagination states
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  // Fetch summary
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

  // Fetch transaction history
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
    return `GHS ${(pesewas / 100).toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (['success', 'completed'].includes(s)) {
      return <span className="badge badge-success">{status}</span>;
    }
    if (['pending', 'processing'].includes(s)) {
      return <span className="badge badge-warning">{status}</span>;
    }
    return <span className="badge badge-danger">{status}</span>;
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

  // Reset page cursor on filter changes
  useEffect(() => {
    setCursor(undefined);
    setCursorHistory([]);
  }, [typeFilter, startDate, endDate]);

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Reconciliation Portal
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Financial settlement audits, ledger listings, and fee checks.
        </p>
      </div>

      {summaryError && (
        <div className="glass-panel" style={{ borderColor: 'var(--color-error)', background: 'var(--color-error-bg)', color: 'var(--text-primary)', marginBottom: '24px' }}>
          <h3 style={{ color: 'var(--color-error)', fontWeight: 600, marginBottom: '8px' }}>Failed to retrieve stats</h3>
          <p>{getFriendlyErrorMessage(summaryError)}</p>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid-cols-3" style={{ marginBottom: '40px' }}>
          <div className="glass-panel" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                Total Collected (In)
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>
                {formatGhs(summary.totalCollectedInPesewas)}
              </span>
            </div>
          </div>

          <div className="glass-panel" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-secondary)' }}>
              <TrendingDown size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                Total Disbursed (Out)
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>
                {formatGhs(summary.totalDisbursedInPesewas)}
              </span>
            </div>
          </div>

          <div className="glass-panel" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
              <Clock size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                Unsettled Balances
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-warning)' }}>
                {formatGhs(summary.outstandingUnsettledInPesewas)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Options */}
      <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} color="var(--text-secondary)" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="premium-input"
            style={{ padding: '8px 12px', width: '180px', background: 'var(--bg-tertiary)' }}
          >
            <option value="all">All Transactions</option>
            <option value="collection">Collections (Inflow)</option>
            <option value="disbursement">Disbursements (Outflow)</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="premium-input"
              style={{ padding: '6px 12px', width: '150px', background: 'var(--bg-tertiary)' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="premium-input"
              style={{ padding: '6px 12px', width: '150px', background: 'var(--bg-tertiary)' }}
            />
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Transaction History</h3>
        </div>

        {isLedgerLoading ? (
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
        ) : ledgerError ? (
          <div style={{ padding: '24px', color: 'var(--color-error)' }}>
            {getFriendlyErrorMessage(ledgerError)}
          </div>
        ) : !ledger || ledger.data.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No transaction records found matching these criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Order ID</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Moolre Tx ID</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Moolre Fee</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {ledger.data.map((tx, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {tx.type === 'collection' ? (
                        <span style={{ color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <ArrowLeft size={14} /> Inflow
                        </span>
                      ) : (
                        <span style={{ color: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <ArrowRight size={14} /> Outflow
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {tx.orderId.slice(0, 8)}...
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>
                      {tx.moolreTransactionId || 'Pending'}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>
                      {formatGhs(tx.moolreFeeInPesewas)}
                    </td>
                    <td style={{ padding: '16px 24px', fontWeight: 700, color: '#ffffff' }}>
                      {formatGhs(tx.amountInPesewas)}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {getStatusBadge(tx.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination controls */}
        {ledger && (ledger.pagination.hasMore || cursorHistory.length > 0) && (
          <div className="flex-between" style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
  );
}
