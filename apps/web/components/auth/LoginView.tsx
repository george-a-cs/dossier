"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useAuth } from "./AuthProvider";

export function LoginView() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <p className="mb-8 text-center text-[28px] font-semibold tracking-tight text-ink">
          dossier
        </p>
        <form
          onSubmit={onSubmit}
          className="rounded-[16px] bg-surface p-6 shadow-md"
        >
          <h1 className="m-0 text-lg font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 mb-5 text-sm text-muted">
            Use your Dossier account to open this collection.
          </p>
          <div className="flex flex-col gap-4">
            <Field label="Email" htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <Field label="Password" htmlFor="login-password">
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>
          </div>
          {error ? (
            <p className="mt-4 mb-0 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="mt-5 w-full" loading={busy}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
