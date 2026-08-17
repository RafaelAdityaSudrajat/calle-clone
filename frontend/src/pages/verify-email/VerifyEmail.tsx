import { useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] =
    useState<'loading' | 'success' | 'error'>('loading');

  const hasVerified = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    if (hasVerified.current) return;

    hasVerified.current = true;

    const verifyEmail = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/auth/verify-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
          },
        );

        if (!response.ok) {
          throw new Error('Email verification failed');
        }

        setStatus('success');
      } catch {
        setStatus('error');
      }
    };

    verifyEmail();
  }, [token]);

  if (status === 'loading') {
    return <p>Verifying your email...</p>;
  }

  if (status === 'success') {
    return <p>Email verified! Silakan login.</p>;
  }

  return <p>Verifikasi gagal atau link expired.</p>;
}