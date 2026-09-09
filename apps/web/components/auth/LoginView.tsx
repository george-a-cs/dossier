"use client";

import { useState, type FormEvent } from "react";
import { DossierLogo } from "@/components/DossierLogo";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useAuth } from "./AuthProvider";

export function LoginView() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg lg:flex-row">
      <div className="fixed inset-0 overflow-hidden lg:relative lg:inset-auto lg:h-auto lg:min-h-dvh lg:w-[42%] lg:shrink-0">
        <img
          src="/login-screen.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black/50 lg:hidden"
        />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-1 flex-col px-4 pt-20 pb-8 sm:px-10 lg:min-h-dvh lg:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_80%_55%_at_50%_38%,#ffffff_0%,#f3f8f7_72%)] lg:block"
        />

        <div className="relative z-10 flex flex-1 flex-col items-center lg:justify-center">
          <div className="w-full max-w-[420px]">
            <div className="mb-8 flex justify-center text-white lg:text-ink">
              <DossierLogo size="lg" />
            </div>

            <form
              onSubmit={onSubmit}
              className="rounded-[20px] border border-white/35 bg-white/35 px-7 py-8 text-white shadow-lg backdrop-blur-xl lg:border-transparent lg:bg-surface lg:text-ink lg:backdrop-blur-none"
            >
              <h1 className="m-0 text-[22px] font-semibold tracking-tight text-white lg:text-ink">
                Sign in to your account
              </h1>
              <p className="mt-1.5 mb-6 text-sm text-white/75 lg:text-muted">
                Use your Dossier account to open this collection.
              </p>
              <div className="flex flex-col gap-4">
                <Field
                  label="Email address"
                  htmlFor="login-email"
                  className="[&_label]:text-white lg:[&_label]:text-ink"
                >
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </Field>
                <Field
                  label="Password"
                  htmlFor="login-password"
                  className="[&_label]:text-white lg:[&_label]:text-ink"
                >
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="pr-16"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-[13px] font-medium text-white/85 hover:text-white lg:text-primary lg:hover:text-primary-hover"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-pressed={showPassword}
                      aria-controls="login-password"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </Field>
              </div>
              {error ? (
                <p className="mt-4 mb-0 text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="mt-6 w-full" loading={busy}>
                Sign in
              </Button>
            </form>
          </div>
        </div>

        <p className="relative z-10 mt-8 mb-0 text-center text-[12px] text-white/90 lg:text-muted">
          Dossier by George Cs. © 2026 · Grounded briefing from your documents
        </p>
      </div>
    </div>
  );
}
