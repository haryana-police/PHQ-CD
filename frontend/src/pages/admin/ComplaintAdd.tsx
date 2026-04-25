import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/common/Button';
import { useGovDistricts, useGovPoliceStations, useGovOffices } from '@/hooks/useData';

export const ComplaintAdd = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    complRegNum: '',
    complRegDt: new Date().toISOString().split('T')[0],
    complaintSource: '',
    statusOfComplaint: 'Pending',
    firstName: '',
    lastName: '',
    mobile: '',
    gender: 'Male',
    age: '',
    addressLine1: '',
    village: '',
    tehsil: '',
    districtId: '',
    policeStationId: '',
    branch: '',
    incidentType: '',
    incidentPlc: '',
    complDesc: '',
  });

  const [error, setError] = useState('');

  const { data: districts } = useGovDistricts();
  const { data: offices } = useGovOffices();
  const { data: stations } = useGovPoliceStations(formData.districtId);

  const createComplaint = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          ...data,
          age: data.age ? parseInt(data.age) : null,
          districtId: data.districtId ? parseInt(data.districtId) : null,
          policeStationId: data.policeStationId ? parseInt(data.policeStationId) : null,
          complRegDt: data.complRegDt ? new Date(data.complRegDt).toISOString() : new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to create complaint');
      }

      return response.json();
    },
    onSuccess: () => {
      navigate('/admin/complaints');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createComplaint.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <Layout>
      <div className="page-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff' }}>Add New Complaint</h2>
          <Link to="/admin/complaints">
            <Button variant="secondary">Cancel</Button>
          </Link>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            
            <div className="detail-section">
              <h3 style={{ fontSize: '1.1rem', color: '#a5b4fc', marginBottom: '16px', borderBottom: '1px solid rgba(165, 180, 252, 0.2)', paddingBottom: '8px' }}>General Information</h3>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Registration Number</label>
                <input required type="text" name="complRegNum" value={formData.complRegNum} onChange={handleChange} className="form-input" placeholder="Enter Registration Number" />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Registration Date</label>
                <input type="date" name="complRegDt" value={formData.complRegDt} onChange={handleChange} className="form-input" />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Complaint Source</label>
                <select name="complaintSource" value={formData.complaintSource} onChange={handleChange} className="form-select">
                  <option value="">Select Source</option>
                  <option value="Online Portal">Online Portal</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="CM Window">CM Window</option>
                  <option value="Written Application">Written Application</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Branch / Office</label>
                <select name="branch" value={formData.branch} onChange={handleChange} className="form-select">
                  <option value="">Select Branch</option>
                  {offices?.data?.map((o: any) => (
                    <option key={o.id || o.ID} value={o.Name}>{o.Name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Status</label>
                <select name="statusOfComplaint" value={formData.statusOfComplaint} onChange={handleChange} className="form-select">
                  <option value="Pending">Pending</option>
                  <option value="Disposed">Disposed</option>
                </select>
              </div>
            </div>

            <div className="detail-section">
              <h3 style={{ fontSize: '1.1rem', color: '#a5b4fc', marginBottom: '16px', borderBottom: '1px solid rgba(165, 180, 252, 0.2)', paddingBottom: '8px' }}>Complainant Details</h3>
              
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>First Name</label>
                  <input required type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="form-input" placeholder="First Name" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Last Name</label>
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="form-input" placeholder="Last Name" />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Mobile Number</label>
                <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} className="form-input" placeholder="Enter 10-digit mobile number" />
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} className="form-select">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Age</label>
                  <input type="number" name="age" value={formData.age} onChange={handleChange} className="form-input" placeholder="Age" min="1" max="120" />
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3 style={{ fontSize: '1.1rem', color: '#a5b4fc', marginBottom: '16px', borderBottom: '1px solid rgba(165, 180, 252, 0.2)', paddingBottom: '8px' }}>Location & Incident</h3>
              
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>District</label>
                  <select name="districtId" value={formData.districtId} onChange={handleChange} className="form-select">
                    <option value="">Select District</option>
                    {districts?.data?.map((d: any) => (
                      <option key={d.id || d.ID} value={d.id || d.ID}>{d.DistrictName}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Police Station</label>
                  <select name="policeStationId" value={formData.policeStationId} onChange={handleChange} className="form-select" disabled={!formData.districtId}>
                    <option value="">Select Police Station</option>
                    {stations?.data?.map((s: any) => (
                      <option key={s.id || s.ID} value={s.id || s.ID}>{s.Name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Address / Location</label>
                <input type="text" name="addressLine1" value={formData.addressLine1} onChange={handleChange} className="form-input" placeholder="Full Address" />
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Village</label>
                  <input type="text" name="village" value={formData.village} onChange={handleChange} className="form-input" placeholder="Village" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Tehsil</label>
                  <input type="text" name="tehsil" value={formData.tehsil} onChange={handleChange} className="form-input" placeholder="Tehsil" />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Incident Type</label>
                <input type="text" name="incidentType" value={formData.incidentType} onChange={handleChange} className="form-input" placeholder="e.g. Theft, Assault, Cyber Crime" />
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#a5b4fc', marginBottom: '16px', borderBottom: '1px solid rgba(165, 180, 252, 0.2)', paddingBottom: '8px' }}>Complaint Description</h3>
              <textarea 
                name="complDesc" 
                value={formData.complDesc} 
                onChange={handleChange} 
                className="form-input" 
                style={{ height: '150px', resize: 'vertical' }} 
                placeholder="Provide a detailed description of the complaint here..."
              />
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
              <Link to="/admin/complaints">
                <Button variant="secondary" type="button">Cancel</Button>
              </Link>
              <Button type="submit" disabled={createComplaint.isPending} style={{ width: '200px' }}>
                {createComplaint.isPending ? 'Saving...' : 'Save Complaint'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ComplaintAdd;
