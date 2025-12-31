import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { alphabet, generateRandomString } from "oslo/crypto";

export const ResendOTP = Resend({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY,
  async generateVerificationToken() {
    return generateRandomString(8, alphabet("0-9"));
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    const { error } = await resend.emails.send({
      from: "Ourin <noreply@ourin.ai>",
      to: [email],
      subject: "Verify your email for Ourin",
      text: `Your verification code is: ${token}\n\nThis code expires in 15 minutes.`,
    });
    if (error) {
      console.error("Resend error:", error);
      throw new Error(`Could not send verification email: ${error.message}`);
    }
  },
});
