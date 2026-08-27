// emails/verify-email.tsx
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Preview,
} from "@react-email/components";

interface ResetPasswordProps {
  verifyUrl: string;
}

export default function ResetPassword({ verifyUrl }: ResetPasswordProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset Password</Preview>
      <Body style={{ backgroundColor: "#f6f6f6", fontFamily: "sans-serif" }}>
        <Container
          style={{
            backgroundColor: "#fff",
            padding: "32px",
            borderRadius: "8px",
          }}
        >
          <Heading style={{ fontSize: "20px" }}>Reset Password</Heading>
          <Text>Klik tombol di bawah buat Reset Password lo.</Text>
          <Button
            href={verifyUrl}
            style={{
              backgroundColor: "#000",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
            }}
          >
            Reset Password
          </Button>
          <Text style={{ fontSize: "12px", color: "#888", marginTop: "24px" }}>
            Link ini berlaku 30 menit. Kalau lo gak ngerasa reset password,
            abaikan email ini aja.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
