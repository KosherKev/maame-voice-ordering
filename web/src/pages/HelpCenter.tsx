import { Book, LifeBuoy, MessageSquare, PhoneCall } from 'lucide-react';

export default function HelpCenter() {
  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Help Center
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Support and documentation for the Maame terminal.
        </p>
      </div>
      
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* LEFT COLUMN (~30% width) */}
        <div style={{ flex: '0 0 32%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Categories</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', background: 'rgba(139, 92, 246, 0.1)', border: 'none', borderLeft: '4px solid var(--accent-primary)', color: '#fff', textAlign: 'left', cursor: 'pointer', transition: 'var(--transition-smooth)' }}>
                <Book size={18} color="var(--accent-primary)" />
                <span style={{ fontWeight: 600 }}>Documentation</span>
              </button>
              <button style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', background: 'transparent', border: 'none', borderLeft: '4px solid transparent', color: 'var(--text-secondary)', textAlign: 'left', cursor: 'pointer', transition: 'var(--transition-smooth)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <MessageSquare size={18} />
                <span style={{ fontWeight: 500 }}>FAQs</span>
              </button>
              <button style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', background: 'transparent', border: 'none', borderLeft: '4px solid transparent', color: 'var(--text-secondary)', textAlign: 'left', cursor: 'pointer', transition: 'var(--transition-smooth)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <LifeBuoy size={18} />
                <span style={{ fontWeight: 500 }}>Contact Support</span>
              </button>
            </div>
          </div>

          <div className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.02) 100%)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: 'var(--color-success)' }}>
                <PhoneCall size={20} />
              </div>
              <div>
                <h4 style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>Emergency Support</h4>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>24/7 Available</span>
              </div>
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.85rem', marginBottom: '16px', lineHeight: 1.5 }}>
              For urgent technical issues regarding Maame terminals, call our hotline immediately.
            </p>
            <button className="btn-secondary" style={{ width: '100%', borderColor: 'rgba(16, 185, 129, 0.3)', color: 'var(--color-success)' }}>
              Call Support
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN (~70% width) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel" style={{ minHeight: '500px' }}>
            <h3 style={{ color: '#ffffff', marginBottom: '24px', fontSize: '1.4rem', fontWeight: 700 }}>Documentation</h3>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.95rem' }}>
              <p style={{ marginBottom: '16px' }}>
                Welcome to the Maame Operations Manual. This guide provides instructions on how to use the Maame terminal for managing vendors, products, live orders, and reconciliations.
              </p>
              <h4 style={{ color: '#fff', marginTop: '32px', marginBottom: '12px', fontSize: '1.1rem' }}>Getting Started</h4>
              <p style={{ marginBottom: '16px' }}>
                Maame provides voice ordering over phone calls and text-based ordering over USSD/WhatsApp for customers who want to purchase goods from partner vendors. 
                As an operator, you will use this dashboard to monitor these interactions in real-time.
              </p>
              <h4 style={{ color: '#fff', marginTop: '32px', marginBottom: '12px', fontSize: '1.1rem' }}>Live Monitoring</h4>
              <p style={{ marginBottom: '16px' }}>
                The Live Monitoring board uses secure WebSocket connections to instantly show new orders as they are placed via our AI voice agents and USSD gateways.
                If real-time connections drop, the system will automatically fallback to polling to ensure you never miss an update.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
