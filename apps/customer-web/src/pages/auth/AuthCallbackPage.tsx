import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerApiClient } from '../../services/api';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = customerApiClient.getAccessToken();
    if (token) {
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return null;
};
