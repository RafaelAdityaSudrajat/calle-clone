import "dotenv/config";
import { sendEmail } from "./src/services/email.service";

sendEmail({
  email: "rafaeladityasudrajat14@gmail.com", // pake email asli lo buat cek beneran nyampe
  token: "dummy-token-123",
})
  .then(() => console.log("✅ Email sent"))
  .catch((err) => console.error("❌ Failed", err));
