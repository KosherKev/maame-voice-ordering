export default function Settings() {
  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Configure system preferences and notifications.
        </p>
      </div>
      <div className="glass-panel">
        <h3 style={{ color: '#ffffff', marginBottom: '16px' }}>General Preferences</h3>
        <p style={{ color: 'var(--text-secondary)' }}>This module is currently under development.</p>
      </div>
    </div>
  );
}
