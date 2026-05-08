import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MdLock, MdPerson } from 'react-icons/md';
import logo from '../assets/logo.png';
import bgImage from '../assets/Rana Traders.jpg';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (!result.success) setError(result.message || 'Invalid credentials — غلط اسناد');
  };

  return (
    <div className="login-page" style={{ backgroundImage: `url(${bgImage})` }}>
      <div className="login-card">
        <div className="login-logo">
          <img src={logo} alt="Rana Traders — رانا ٹریڈرز" className="login-logo-img" />
        </div>
        {error && <div className="login-error">{error}</div>}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label><MdPerson style={{ verticalAlign: 'middle', marginRight: 6 }} /> Username</label>
            <input type="text" placeholder="Enter username" value={username} onChange={e => setUsername(e.target.value)} autoFocus required />
          </div>
          <div className="form-group">
            <label><MdLock style={{ verticalAlign: 'middle', marginRight: 6 }} /> Password</label>
            <input type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Login — لاگ ان'}
          </button>
        </form>
      </div>
    </div>
  );
}
