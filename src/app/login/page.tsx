"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ArrowIcon, BrandMark, CheckIcon, ShieldIcon, StarIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (authError) throw authError;
      setSent(true);
      setMessage(`We sent a sign-in link to ${email}. Enter the 6-digit code below to continue.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (authError) throw authError;
      router.push("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="login-page">
        <section className="login-hero">
          <div className="hero-content">
            <span className="hero-eyebrow"><BrandMark /> GUEST SUPPORT, REIMAGINED</span>
            <h1>Every refund decision,<br />made on solid ground.</h1>
            <p className="hero-copy">
              A support experience that knows who you are, reads every request with care,
              and never lets a stray line of text decide what gets paid.
            </p>
            <ul className="hero-points">
              <li><CheckIcon /> Your stays, your view — scoped to your verified email</li>
              <li><CheckIcon /> Requests stay tied to the person who sent them</li>
              <li><CheckIcon /> Refund decisions made in server code, not by the chat</li>
            </ul>
            <div className="hero-proof">
              <div className="proof-avatars"><span>M</span><span>Y</span><span>E</span></div>
              <div>
                <div className="proof-stars"><StarIcon /><StarIcon /><StarIcon /><StarIcon /><StarIcon /></div>
                <span className="proof-caption">Trusted by guests around the world</span>
              </div>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="art-card art-back">
              <div className="art-thumb thumb-a" />
              <div className="art-lines"><i /><i /></div>
            </div>
            <div className="art-card art-front">
              <div className="art-thumb thumb-b" />
              <div className="art-lines"><i /><i /><i /></div>
              <div className="art-badge"><ShieldIcon /> Ownership verified</div>
            </div>
          </div>
        </section>

        <section className="login-panel">
          <div className="login-card">
            <div className="login-card-head">
              <h2>{sent ? "Check your email" : "Welcome back"}</h2>
              <p>{sent ? "One quick step and you're in." : "Sign in to see your stays and support requests."}</p>
            </div>

            <div className="stepper" aria-label="Sign-in progress">
              <span className={sent ? "step done" : "step active"}>1 <em>Email</em></span>
              <span className="step-line" />
              <span className={sent ? "step active" : "step"}>2 <em>Code</em></span>
            </div>

            {!sent ? (
              <form onSubmit={sendLink} className="auth-form">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  placeholder="you@example.com"
                  onChange={(event) => setEmail(event.target.value)}
                />
                <button className="primary-btn" disabled={busy}>
                  {busy ? "Sending…" : "Continue with email"} <ArrowIcon />
                </button>
                <p className="form-hint">
                  We&apos;ll email you a link or code — no password to remember.
                </p>
              </form>
            ) : (
              <form onSubmit={verifyCode} className="auth-form">
                <label htmlFor="token">6-digit code</label>
                <input
                  id="token"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  value={token}
                  placeholder="123456"
                  onChange={(event) => setToken(event.target.value)}
                />
                <button className="primary-btn" disabled={busy}>
                  {busy ? "Verifying…" : "Verify and sign in"} <ArrowIcon />
                </button>
                <button type="button" className="text-btn" onClick={() => { setSent(false); setError(""); }}>
                  Use a different email
                </button>
              </form>
            )}

            {message && <p className="form-message" role="status">{message}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}

            <div className="auth-divider"><span>or</span></div>
            <p className="secure-note"><ShieldIcon /> Your email is verified by Supabase before a session is issued.</p>
          </div>
          <p className="legal">
            By continuing, you agree to the Terms of Service and Privacy Policy.
            <br />This is a training simulation. <Link href="/">Back home</Link>
          </p>
        </section>
      </main>
    </>
  );
}
