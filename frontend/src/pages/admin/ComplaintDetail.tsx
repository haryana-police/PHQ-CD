import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/common/Button';

export const ComplaintDetail = () => {
  const { id } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['complaint', id],
    queryFn: async () => {
      const response = await fetch(`/api/complaints/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      return response.json();
    },
  });

  const record = data?.data;

  return (
    <Layout>
      <div className="page-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff' }}>Complaint Record Details</h2>
          <Link to="/admin/complaints">
            <Button variant="secondary">Back to List</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="loading-spinner"><svg width="28" height="28" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : !record ? (
          <div className="empty-state"><p>Record not found</p></div>
        ) : (
          <div className="card" style={{ padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
              
              <div className="detail-section">
                <h3 style={{ fontSize: '1.1rem', color: '#a5b4fc', marginBottom: '16px', borderBottom: '1px solid rgba(165, 180, 252, 0.2)', paddingBottom: '8px' }}>General Information</h3>
                <DetailRow label="Registration Number" value={record.complRegNum} />
                <DetailRow label="Registration Date" value={record.complRegDt ? new Date(record.complRegDt).toLocaleDateString() : '-'} />
                <DetailRow label="Source" value={record.complaintSource} />
                <DetailRow label="Status" value={record.statusOfComplaint} />
                <DetailRow label="Category" value={record.compCategory} />
                <DetailRow label="Disposal Date" value={record.disposalDate ? new Date(record.disposalDate).toLocaleDateString() : '-'} />
              </div>

              <div className="detail-section">
                <h3 style={{ fontSize: '1.1rem', color: '#a5b4fc', marginBottom: '16px', borderBottom: '1px solid rgba(165, 180, 252, 0.2)', paddingBottom: '8px' }}>Complainant Details</h3>
                <DetailRow label="Name" value={`${record.firstName || ''} ${record.lastName || ''}`.trim() || '-'} />
                <DetailRow label="Mobile" value={record.mobile} />
                <DetailRow label="Gender" value={record.gender} />
                <DetailRow label="Age" value={record.age?.toString()} />
                <DetailRow label="Father/Spouse" value={record.fatherSpouseName} />
              </div>

              <div className="detail-section">
                <h3 style={{ fontSize: '1.1rem', color: '#a5b4fc', marginBottom: '16px', borderBottom: '1px solid rgba(165, 180, 252, 0.2)', paddingBottom: '8px' }}>Location Details</h3>
                <DetailRow label="District" value={record.district?.name} />
                <DetailRow label="Address" value={[record.addressLine1, record.addressLine2, record.addressLine3].filter(Boolean).join(', ')} />
                <DetailRow label="Village" value={record.village} />
                <DetailRow label="Tehsil" value={record.tehsil} />
              </div>

              <div className="detail-section">
                <h3 style={{ fontSize: '1.1rem', color: '#a5b4fc', marginBottom: '16px', borderBottom: '1px solid rgba(165, 180, 252, 0.2)', paddingBottom: '8px' }}>Police & Legal Info</h3>
                <DetailRow label="FIR Number" value={record.firNumber} />
                <DetailRow label="FIR Date" value={record.firDate ? new Date(record.firDate).toLocaleDateString() : '-'} />
                <DetailRow label="Act/Section" value={record.ActSection} />
                <DetailRow label="IO Details" value={record.ioDetails} />
                <DetailRow label="Action Taken" value={record.actionTaken} />
              </div>

            </div>

            <div style={{ marginTop: '32px' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#a5b4fc', marginBottom: '16px', borderBottom: '1px solid rgba(165, 180, 252, 0.2)', paddingBottom: '8px' }}>Complaint Description</h3>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', color: 'var(--text-secondary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {record.complDesc || 'No description provided.'}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

const DetailRow = ({ label, value }: { label: string, value: string | undefined | null }) => (
  <div style={{ display: 'flex', marginBottom: '12px', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', width: '40%' }}>{label}</span>
    <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', width: '60%', textAlign: 'right', wordBreak: 'break-word' }}>{value || '-'}</span>
  </div>
);

export default ComplaintDetail;
