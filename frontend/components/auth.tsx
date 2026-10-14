"use client";
import {useState} from "react";
import {ArrowRight, BookOpen, Check, Eye, EyeOff, GraduationCap, LockKeyhole, Sparkles} from "lucide-react";
import {api} from "@/lib/api-client";

export function AuthScreen({provider, onSuccess}: {provider: "password" | "chatgpt"; onSuccess: () => Promise<void>}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      await api("auth/" + mode, "POST", {email, password, ...(mode === "register" ? {name} : {})});
      setPassword("");
      await onSuccess();
    } catch (error: any) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="auth-page">
    <header className="auth-header"><a href="/" className="auth-brand"><GraduationCap size={30}/>STUDYMATE<span>AI</span></a><span className="auth-header-note"><LockKeyhole size={14}/>Your private learning space</span></header>
    <main id="main-content" className="auth-layout">
      <section className="auth-story">
        <span className="eyebrow">LESS OVERWHELM. MORE UNDERSTANDING.</span>
        <h1>MAKE YOUR <br/>NEXT IDEA <br/><span>CLICK.</span></h1>
        <p>Your notes, a thoughtful tutor, and a little practice. Everything you need to move forward, in one place.</p>
        <div className="auth-feature-list">{["Keep your notes organized by course", "Learn with answers you can trace to a source", "Turn your next practice into progress"].map(text => <div key={text}><Check size={16}/>{text}</div>)}</div>
        <div className="auth-preview">
          <div className="row spread"><span className="eyebrow">A LOOK INSIDE</span><Sparkles size={20}/></div>
          <h2>One question.<br/>A little more clarity.</h2>
          <p>“What makes a primary key unique?”</p>
          <div className="auth-source"><BookOpen size={17}/><span>Learn from your material.<br/><small>Check the quote. Open the source.</small></span><ArrowRight size={20}/></div>
        </div>
        <small className="auth-story-footnote">Built for your own notes, your own pace, your next small win.</small>
      </section>
      <section className="auth-panel" aria-labelledby="auth-title">
        <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
        <h2 id="auth-title">{mode === "register" ? "Make room to learn." : "Welcome back."}</h2>
        <p>{mode === "register" ? "Create an account to save your notes and progress." : "Pick up where you left off."}</p>
        {provider === "password" ? <>
          <div className="auth-tabs" aria-label="Account options">{(["login", "register"] as const).map(option => <button type="button" key={option} aria-pressed={mode === option} disabled={busy} className={mode === option ? "selected" : ""} onClick={() => {setMode(option); setError(""); setPassword("");}}>{option === "login" ? "Sign in" : "Create account"}</button>)}</div>
          <form onSubmit={submit} className="auth-form">
            {mode === "register" && <label className="field"><span>Your name</span><input autoComplete="name" name="name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="How should we call you?" disabled={busy}/></label>}
            <label className="field"><span>Email address</span><input type="email" autoComplete="email" name="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" disabled={busy}/></label>
            <label className="field"><span>Password</span><div className="password-input"><input type={show ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} name="password" minLength={mode === "register" ? 12 : 1} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "register" ? "At least 12 characters" : "Enter your password"} aria-describedby={mode === "register" ? "password-hint" : undefined} disabled={busy}/><button type="button" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
            {mode === "register" && <small id="password-hint">Use at least 12 characters. A memorable passphrase works well.</small>}
            {error && <p className="error auth-error" role="alert">{error}</p>}
            <button className="btn primary auth-submit" disabled={busy}>{busy ? "Opening your workspace…" : mode === "register" ? "Create my workspace" : "Sign in"}<ArrowRight size={18}/></button>
          </form>
          <p className="auth-switch">{mode === "login" ? "New here?" : "Already have an account?"} <button disabled={busy} type="button" onClick={() => {setMode(mode === "login" ? "register" : "login"); setError(""); setPassword("");}}>{mode === "login" ? "Create an account" : "Sign in"}</button></p>
        </> : <a className="btn primary auth-submit" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in with ChatGPT<ArrowRight size={18}/></a>}
        <div className="auth-privacy"><LockKeyhole size={16}/><span>Your courses, notes, and progress stay in your account. AI study requests use relevant excerpts from the material you choose.</span></div>
      </section>
    </main>
    <footer className="auth-footer"><span>STUDYMATE AI</span><span>Thoughtful learning, one topic at a time.</span></footer>
  </div>;
}

export function PasswordSettings() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return <form className="password-settings spaced" onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    setError(""); setMessage("");
    if (next !== confirm) {setError("Your new passwords do not match."); return;}
    setBusy(true);
    try {await api("auth/password", "POST", {currentPassword: current, newPassword: next}); setCurrent(""); setNext(""); setConfirm(""); setMessage("Password changed. Your other sessions have been signed out.");}
    catch(error: any) {setError(error.message);}
    finally {setBusy(false);}
  }}><h3>Change password</h3><p>Use a passphrase of at least 12 characters.</p>
    <label className="field spaced"><span>Current password</span><input type="password" autoComplete="current-password" required maxLength={128} value={current} disabled={busy} onChange={e => setCurrent(e.target.value)}/></label>
    <label className="field spaced"><span>New password</span><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={next} disabled={busy} onChange={e => setNext(e.target.value)}/></label>
    <label className="field spaced"><span>Confirm new password</span><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} disabled={busy} onChange={e => setConfirm(e.target.value)}/></label>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    <button className="btn spaced" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
  </form>;
}
