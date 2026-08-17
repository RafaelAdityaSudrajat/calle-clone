// emails/verify-email.tsx
import {
  Html, Head, Body, Container, Heading, Text, Button, Preview,
} from '@react-email/components';

interface VerifyEmailProps {
  verifyUrl: string;
}

export default function VerifyEmail({ verifyUrl }: VerifyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verifikasi email lo buat mulai belanja di calle</Preview>
      <Body style={{ backgroundColor: '#f6f6f6', fontFamily: 'sans-serif' }}>
        <Container style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '8px' }}>
          <Heading style={{ fontSize: '20px' }}>Verifikasi email lo</Heading>
          <Text>Klik tombol di bawah buat verifikasi email dan aktifin akun lo.</Text>
          <Button
            href={verifyUrl}
            style={{
              backgroundColor: '#000', color: '#fff', padding: '12px 24px',
              borderRadius: '6px', textDecoration: 'none',
            }}
          >
            Verifikasi Email
          </Button>
          <Text style={{ fontSize: '12px', color: '#888', marginTop: '24px' }}>
            Link ini berlaku 24 jam. Kalau lo gak ngerasa daftar, abaikan email ini aja.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}