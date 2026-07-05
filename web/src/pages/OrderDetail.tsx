import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { fetchFromBackend, getFriendlyErrorMessage } from '../utils/api';
import {
  ArrowLeft,
  Phone,
  Calendar,
  AlertCircle,
  XCircle,
  RotateCcw,
  CheckCircle2,
  MessageSquareCode,
  DollarSign,
  Truck,
  User,
} from 'lucide-react';

interface OrderItem {
  id: string;
  productId: string;
  vendorId: string;
  quantity: number;
  unitPriceInPesewas: number;
}

interface Disbursement {
  id: string;
  amountInPesewas: number;
  status: string;
  createdAt: string;
}

interface Fulfillment {
  id: string;
  deliveryStatus: string;
  disbursementStatus: string;
  subtotalInPesewas: number;
  disbursements: Disbursement[];
}

interface Payment {
  id: string;
  status: string;
  amountInPesewas: number;
  moolreTransactionId: string | null;
  createdAt: string;
}

interface Order {
  id: string;
  customerPhone: string;
  channel: 'voice' | 'ussd';
  status: string;
  totalInPesewas: number;
  serviceFeeInPesewas: number;
  createdAt: string;
  updatedAt: string;
  orderItems: OrderItem[];
  fulfillments: Fulfillment[];
  payment: Payment | null;
  callSessionId?: string | null;
  ussdSessionId?: string | null;
}

interface TranscriptLine {
  speaker: 'customer' | 'maame';
  text: string;
  timestamp: string;
}

interface OrderDetailProps {
  orderId: string;
  onBack: () => void;
}

export default function OrderDetail({ orderId, onBack }: OrderDetailProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Operation action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Initial order fetch
  const fetchOrderDetails = async () => {
    try {
      const data = await fetchFromBackend(`/orders/${orderId}`);
      setOrder(data);
      if (data.callSessionId) {
        fetchCallTranscript(data.callSessionId);
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCallTranscript = async (sessionId: string) => {
    try {
      const session = await fetchFromBackend(`/call-sessions/${sessionId}`);
      if (session && session.transcript) {
        const transcriptLines = typeof session.transcript === 'string'
          ? JSON.parse(session.transcript)
          : session.transcript;
        setTranscript(transcriptLines || []);
      }
    } catch (err) {
      console.error('Failed to load call session details:', err);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  // Auto scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Realtime logical replication subscriptions
  useEffect(() => {
    if (!order) return;

    // 1. Subscribe to Order details row
    const orderSubscription = supabase
      .channel(`order-row-${order.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        (payload) => {
          setOrder((prev) => (prev ? { ...prev, ...payload.new } : null));
        }
      )
      .subscribe();

    // 2. Subscribe to Fulfillment row(s)
    const fulfillmentSubscription = supabase
      .channel(`order-fulfillments-${order.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendor_fulfillments', filter: `order_id=eq.${order.id}` },
        async () => {
          // Re-fetch full details to update complex nested state easily
          const updated = await fetchFromBackend(`/orders/${order.id}`);
          setOrder(updated);
        }
      )
      .subscribe();

    // 3. Subscribe to Call Session transcript updates
    let callSessionSubscription: any = null;
    if (order.callSessionId) {
      callSessionSubscription = supabase
        .channel(`call-session-${order.callSessionId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'call_sessions', filter: `id=eq.${order.callSessionId}` },
          (payload) => {
            const { eventType, new: newRow } = payload;
            if (eventType === 'UPDATE' || eventType === 'INSERT') {
              if (newRow && newRow.transcript) {
                const lines = typeof newRow.transcript === 'string'
                  ? JSON.parse(newRow.transcript)
                  : newRow.transcript;
                setTranscript(lines || []);
              }
            }
          }
        )
        .subscribe();
    }

    return () => {
      orderSubscription.unsubscribe();
      fulfillmentSubscription.unsubscribe();
      if (callSessionSubscription) {
        callSessionSubscription.unsubscribe();
      }
    };
  }, [order?.id, order?.callSessionId]);

  // Order Operations
  const handleCancelOrder = async () => {
    if (!order) return;
    setActionLoading('cancel');
    setActionMessage(null);
    const idempotencyKey = crypto.randomUUID();

    try {
      const updated = await fetchFromBackend(`/orders/${order.id}/cancel`, {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey },
      });
      setOrder(updated);
      setActionMessage({ text: 'Order cancelled successfully.', type: 'success' });
    } catch (err: any) {
      setActionMessage({ text: getFriendlyErrorMessage(err), type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryPayment = async () => {
    if (!order) return;
    setActionLoading('retry-payment');
    setActionMessage(null);
    const idempotencyKey = crypto.randomUUID();

    try {
      const updated = await fetchFromBackend(`/orders/${order.id}/retry-payment`, {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey },
      });
      setOrder(updated);
      setActionMessage({ text: 'Payment collection prompt re-triggered.', type: 'success' });
    } catch (err: any) {
      setActionMessage({ text: getFriendlyErrorMessage(err), type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkDelivered = async (fulfillmentId: string) => {
    setActionLoading('mark-delivered');
    setActionMessage(null);
    const idempotencyKey = crypto.randomUUID();

    try {
      await fetchFromBackend(`/fulfillments/${fulfillmentId}/mark-delivered`, {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey },
      });
      // Re-fetch entire order to update status/fulfillments/disbursements
      const updated = await fetchFromBackend(`/orders/${orderId}`);
      setOrder(updated);
      setActionMessage({ text: 'Fulfillment marked delivered. Vendor payout initiated.', type: 'success' });
    } catch (err: any) {
      setActionMessage({ text: getFriendlyErrorMessage(err), type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Render variables
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

  const getFulfillment = () => {
    return order?.fulfillments && order.fulfillments.length > 0 ? order.fulfillments[0] : null;
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={onBack} className="btn-secondary" style={{ padding: '10px 14px', borderRadius: '10px' }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '12px' }}>
            Order Detail
          </h1>
          <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            ID: {orderId}
          </span>
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
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
          <h3 style={{ color: 'var(--color-error)', fontWeight: 600, marginBottom: '8px' }}>Failed to retrieve order</h3>
          <p>{error}</p>
        </div>
      )}

      {!isLoading && !error && order && (
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap-reverse', alignItems: 'stretch' }}>
          {/* Left Column: Stats & Operations */}
          <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Info Summary Panel */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="flex-between">
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Summary</h3>
                {getStatusBadge(order.status)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.9rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>
                    Customer Number
                  </span>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={14} color="var(--accent-primary)" />
                    {order.customerPhone}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>
                    Source Channel
                  </span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                    {order.channel}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>
                    Total Order Value
                  </span>
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                    {formatGhs(order.totalInPesewas)}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>
                    Created Timestamp
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} color="var(--text-muted)" />
                    {new Date(order.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Order Items Panel */}
            <div className="glass-panel">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Catalog Items</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {order.orderItems.map((item) => (
                  <div key={item.id} className="flex-between" style={{ paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>
                      <span style={{ fontWeight: 600, color: '#ffffff' }}>Product ID: {item.productId.slice(0, 8)}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block' }}>
                        Qty: {item.quantity} × {formatGhs(item.unitPriceInPesewas)}
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, color: '#ffffff' }}>
                      {formatGhs(item.quantity * item.unitPriceInPesewas)}
                    </span>
                  </div>
                ))}
                <div className="flex-between" style={{ paddingTop: '8px', fontSize: '1.05rem', fontWeight: 800 }}>
                  <span>Grand Total</span>
                  <span style={{ color: 'var(--accent-primary)' }}>{formatGhs(order.totalInPesewas)}</span>
                </div>
              </div>
            </div>

            {/* Payment & Disbursement Panel */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Financial Transactions</h3>

              {/* Payment Section */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex-between" style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DollarSign size={16} color="var(--accent-primary)" />
                    Moolre Customer Payment
                  </span>
                  {order.payment ? (
                    <span className={`badge ${order.payment.status === 'success' ? 'badge-success' : order.payment.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                      {order.payment.status}
                    </span>
                  ) : (
                    <span className="badge badge-neutral">uninitiated</span>
                  )}
                </div>
                {order.payment && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <span>Ref: {order.payment.moolreTransactionId || 'Pending'}</span>
                    <span style={{ textAlign: 'right' }}>Collected: {formatGhs(order.payment.amountInPesewas)}</span>
                  </div>
                )}
              </div>

              {/* Disbursement Section */}
              {getFulfillment() && (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex-between" style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Truck size={16} color="var(--accent-secondary)" />
                      Vendor Fulfillment Settlement
                    </span>
                    <span className={`badge ${
                      getFulfillment()?.disbursementStatus === 'completed'
                        ? 'badge-success'
                        : getFulfillment()?.disbursementStatus === 'failed'
                        ? 'badge-danger'
                        : getFulfillment()?.disbursementStatus === 'processing'
                        ? 'badge-warning'
                        : 'badge-neutral'
                    }`}>
                      Settlement: {getFulfillment()?.disbursementStatus}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <span>Delivery: {getFulfillment()?.deliveryStatus}</span>
                    <span style={{ textAlign: 'right' }}>Settled Amt: {formatGhs(getFulfillment()?.subtotalInPesewas || 0)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Operations Console Panel */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Operations Control Console</h3>

              {actionMessage && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: actionMessage.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                  border: `1px solid ${actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                  color: actionMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '0.85rem'
                }}>
                  <AlertCircle size={16} />
                  <span>{actionMessage.text}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {/* Retry Payment Button */}
                <button
                  onClick={handleRetryPayment}
                  disabled={order.status !== 'payment_failed' || actionLoading !== null}
                  className="btn-primary"
                  style={{ flex: '1 1 150px' }}
                >
                  <RotateCcw size={16} />
                  {actionLoading === 'retry-payment' ? 'Retrying...' : 'Retry Payment Prompt'}
                </button>

                {/* Mark Delivered Button */}
                {getFulfillment() && (
                  <button
                    onClick={() => handleMarkDelivered(getFulfillment()!.id)}
                    disabled={
                      getFulfillment()!.deliveryStatus === 'delivered' ||
                      !['paid', 'vendor_notified', 'out_for_delivery'].includes(order.status) ||
                      actionLoading !== null
                    }
                    className="btn-secondary"
                    style={{
                      flex: '1 1 150px',
                      borderColor: 'var(--color-success)',
                      color: 'var(--color-success)',
                      background: 'rgba(16, 185, 129, 0.03)',
                    }}
                  >
                    <CheckCircle2 size={16} />
                    {actionLoading === 'mark-delivered' ? 'Settling...' : 'Confirm Delivery & Pay Vendor'}
                  </button>
                )}

                {/* Cancel Order Button */}
                <button
                  onClick={handleCancelOrder}
                  disabled={order.status === 'disbursed' || order.status === 'cancelled' || actionLoading !== null}
                  className="btn-danger"
                  style={{ flex: '1 1 150px' }}
                >
                  <XCircle size={16} />
                  {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel Order'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Call Transcript */}
          {order.channel === 'voice' && (
            <div
              className="glass-panel"
              style={{
                flex: '1 1 450px',
                display: 'flex',
                flexDirection: 'column',
                height: '750px',
                maxHeight: '85vh',
                position: 'relative',
              }}
            >
              <div className="flex-between" style={{ marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquareCode size={18} color="var(--accent-primary)" />
                  Voice Call Live Transcript
                </h3>
                <span
                  className="badge badge-info"
                  style={{ animation: order.status === 'collecting_items' ? 'pulse-glow 2s infinite' : 'none' }}
                >
                  {order.status === 'collecting_items' ? 'Live Streaming' : 'Archived'}
                </span>
              </div>

              {/* Dialogue balloons container */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  paddingRight: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {transcript.length === 0 ? (
                  <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                    Waiting for speech transcript packages to arrive...
                  </div>
                ) : (
                  transcript.map((line, idx) => {
                    const isMaame = line.speaker === 'maame';
                    return (
                      <div
                        key={idx}
                        style={{
                          alignSelf: isMaame ? 'flex-start' : 'flex-end',
                          maxWidth: '85%',
                          animation: 'fadeIn 0.3s ease-out',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            justifyContent: isMaame ? 'flex-start' : 'flex-end',
                            marginBottom: '4px',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {isMaame ? (
                            <>
                              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff', fontWeight: 'bold' }}>M</div>
                              <span>Maame Agent</span>
                            </>
                          ) : (
                            <>
                              <span>Customer</span>
                              <User size={12} />
                            </>
                          )}
                          <span>•</span>
                          <span>{new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                        <div
                          style={{
                            background: isMaame ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                            color: '#ffffff',
                            padding: '12px 16px',
                            borderRadius: isMaame ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                            border: isMaame ? '1px solid rgba(255,255,255,0.06)' : 'none',
                            fontSize: '0.95rem',
                            lineHeight: '1.4',
                          }}
                        >
                          {line.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
