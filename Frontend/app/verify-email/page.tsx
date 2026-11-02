import { AuthCard } from "@/components/AuthCard";
import { Btn, Notice } from "@/components/ui";

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Verify your email" sub="Verification keeps student and teacher workspaces safe.">
      <Notice tone="blue">
        Open the verification link from your email. After verification you can sign in and use protected features.
        If the link expired, enter your email on the sign-in page and choose “Resend verification email”.
      </Notice>
      <Btn href="/sign-in" className="mt-5 w-full">Go to sign in</Btn>
    </AuthCard>
  );
}
