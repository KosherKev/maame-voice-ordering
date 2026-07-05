import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Edit2, Check, X, ShieldAlert, Trash2 } from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  phone: string;
  momoChannel: 'mtn' | 'telecel' | 'at';
  active: boolean;
  createdAt: string;
}

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [momoChannel, setMomoChannel] = useState<'mtn' | 'telecel' | 'at'>('mtn');
  const [active, setActive] = useState(true);

  const fetchVendors = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('vendors')
        .select('*')
        .order('name', { ascending: true });

      if (dbError) throw dbError;
      setVendors(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from('vendors')
        .insert([{ name, phone, momoChannel, active }]);

      if (dbError) throw dbError;
      setIsAdding(false);
      resetForm();
      fetchVendors();
    } catch (err: any) {
      setError(err.message || 'Failed to save vendor');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from('vendors')
        .update({ name, phone, momoChannel, active })
        .eq('id', id);

      if (dbError) throw dbError;
      setEditingId(null);
      resetForm();
      fetchVendors();
    } catch (err: any) {
      setError(err.message || 'Failed to update vendor');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vendor? If they have order history, this deletion will be blocked.')) {
      return;
    }
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id);

      if (dbError) {
        // Trigger blocks hard-delete if vendor has orders, displays a message
        if (dbError.message && dbError.message.includes('trigger')) {
          setError('This vendor has order history and cannot be deleted. Deactivate them instead to soft-delete.');
        } else {
          throw dbError;
        }
      } else {
        fetchVendors();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete vendor');
    }
  };

  const startEdit = (vendor: Vendor) => {
    setEditingId(vendor.id);
    setName(vendor.name);
    setPhone(vendor.phone);
    setMomoChannel(vendor.momoChannel);
    setActive(vendor.active);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setMomoChannel('mtn');
    setActive(true);
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Vendor Registries
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Configure and register momo disbursement accounts for partner vendors.
          </p>
        </div>
        {!isAdding && !editingId && (
          <button onClick={() => { setIsAdding(true); resetForm(); }} className="btn-primary">
            <Plus size={18} /> Add Vendor
          </button>
        )}
      </div>

      {error && (
        <div className="glass-panel" style={{ borderColor: 'var(--color-error)', background: 'var(--color-error-bg)', color: '#ffffff', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert size={20} color="var(--color-error)" style={{ flexShrink: 0 }} />
          <div>
            <strong>Operations Exception:</strong>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>{error}</p>
          </div>
        </div>
      )}

      {/* Add Vendor Panel */}
      {isAdding && (
        <div className="glass-panel" style={{ marginBottom: '24px', borderLeft: '4px solid var(--accent-primary)' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700 }}>Register New Vendor</h3>
          <form onSubmit={handleSaveAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Name</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="premium-input" placeholder="e.g. Ama Goods Store" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Momo Phone</label>
              <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="premium-input" placeholder="e.g. 0541112222" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Network</label>
              <select value={momoChannel} onChange={(e) => setMomoChannel(e.target.value as any)} className="premium-input">
                <option value="mtn">MTN Mobile Money</option>
                <option value="telecel">Telecel Cash</option>
                <option value="at">AT Money</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '45px' }}>
              <input type="checkbox" id="active-checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <label htmlFor="active-checkbox" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Account Active</label>
            </div>
            <div style={{ display: 'flex', gap: '8px', gridColumn: 'span 1' }}>
              <button type="submit" className="btn-primary" style={{ padding: '10px 16px', fontSize: '0.85rem' }}>Save</button>
              <button type="button" onClick={() => setIsAdding(false)} className="btn-secondary" style={{ padding: '10px 16px', fontSize: '0.85rem' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
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
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {vendors.map((vendor) => {
            const isEditing = editingId === vendor.id;
            return (
              <div key={vendor.id} className="glass-panel" style={{ borderLeft: vendor.active ? 'none' : '4px solid var(--color-error)' }}>
                {isEditing ? (
                  <form onSubmit={(e) => handleSaveEdit(e, vendor.id)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Name</label>
                      <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="premium-input" />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Momo Phone</label>
                      <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="premium-input" />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Network</label>
                      <select value={momoChannel} onChange={(e) => setMomoChannel(e.target.value as any)} className="premium-input">
                        <option value="mtn">MTN Mobile Money</option>
                        <option value="telecel">Telecel Cash</option>
                        <option value="at">AT Money</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '45px' }}>
                      <input type="checkbox" id={`active-${vendor.id}`} checked={active} onChange={(e) => setActive(e.target.checked)} />
                      <label htmlFor={`active-${vendor.id}`} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active</label>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" className="btn-primary" style={{ padding: '10px 16px', fontSize: '0.85rem' }}><Check size={16} /> Save</button>
                      <button type="button" onClick={() => setEditingId(null)} className="btn-secondary" style={{ padding: '10px 16px', fontSize: '0.85rem' }}><X size={16} /> Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex-between" style={{ flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {vendor.name}
                        {!vendor.active && <span className="badge badge-danger">Deactivated</span>}
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Phone: {vendor.phone} • Channel: <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{vendor.momoChannel}</span>
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => startEdit(vendor)} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Edit2 size={14} /> Edit
                      </button>
                      <button onClick={() => handleDelete(vendor.id)} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(239, 68, 68, 0.4)', color: 'var(--color-error)' }}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
