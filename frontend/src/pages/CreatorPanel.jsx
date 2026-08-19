import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const MODULE_LABELS = {
  tender_bid: 'Tender / Bid',
  sales: 'Sales / Work Orders',
  purchase: 'Purchase / Vendor POs',
  stores: 'Stores / Inventory',
  production: 'Production',
  quality: 'Quality',
  dispatch_accounts: 'Dispatch / Accounts',
  management: 'Management / Dashboard',
};

// Deliberately a plain axios instance, not the shared api client — this panel
// has nothing to do with the normal login/token system.
const creatorApi = axios.create({ baseURL: '/api/creator' });

export default function CreatorPanel() {
  const { key } = useParams();
  const [modules, setModules] = useState(null);
  const [error, setError] = useState(false);

  async function load() {
    try {
      const { data } = await creatorApi.get(`/${key}/modules`);
      setModules(data);
    } catch {
      setError(true);
    }
  }
  useEffect(() => { load(); }, [key]);

  async function toggle(moduleName, current) {
    await creatorApi.put(`/${key}/modules/${moduleName}`, { is_enabled: !current });
    load();
  }

  if (error) {
    // Deliberately generic — this page should look like any other 404, not hint that a Creator panel exists.
    return <div style={{ padding: 60, fontFamily: 'sans-serif', color: '#666' }}>Not found.</div>;
  }

  if (!modules) return <div style={{ padding: 60, fontFamily: 'sans-serif' }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 640, margin: '60px auto', padding: '0 24px', fontFamily: '-apple-system, sans-serif' }}>
      <h1 style={{ fontSize: 20 }}>Module Settings</h1>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
        Controls which modules exist in this deployment — separate from, and outside the reach of, Superadmin and Module Admin accounts.
      </p>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
        {modules.map((m) => (
          <div key={m.module} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #eee' }}>
            <span>{MODULE_LABELS[m.module] || m.module}</span>
            <button
              onClick={() => toggle(m.module, m.is_enabled)}
              style={{
                border: 'none', borderRadius: 999, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: m.is_enabled ? '#2f7a4f' : '#ccc', color: m.is_enabled ? '#fff' : '#555',
              }}
            >
              {m.is_enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        ))}
      </div>

      <p style={{ color: '#999', fontSize: 12, marginTop: 20 }}>
        Master Data, Auth, and Users are foundational and always on — not listed here.
      </p>
    </div>
  );
}
