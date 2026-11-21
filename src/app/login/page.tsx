"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setSent(true);
      setMessage("Check your inbox for the magic link or 6-digit code.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not verify code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Guest sign-in</h1>
      <p className="muted">
        Passwordless email sign-in. Supabase issues a session only after you prove
        control of the inbox; that verified email is the ownership key.
      </p>

      <div className="card">
        <form onSubmit={sendLink}>
          <label htmlFor="email">Guest email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            placeholder="guest01@example.com"
            onChange={(event) => setEmail(event.target.value)}
          />
          <p><button disabled={busy || sent}>{sent ? "Link sent" : "Send magic link"}</button></p>
        </form>

        {sent && (
          <form onSubmit={verifyCode}>
            <label htmlFor="token">6-digit code from the email</label>
            <input
              id="token"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
            <p><button disabled={busy}>Verify and sign in</button></p>
          </form>
        )}

        {message && <p role="status">{message}</p>}
      </div>
    </main>
  );
}
