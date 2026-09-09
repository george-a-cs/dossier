"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { createUser, listUsers, updateProfile } from "@/lib/api";
import { roleLabel } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";
import { useAuth } from "./AuthProvider";

export function SettingsView() {
  const { user, setUser } = useAuth();
  if (!user) return null;

  return (
    <div className="min-w-0">
      <PageHeader
        title="Settings"
        tooltip="Your account details and password."
      />
      <div className="flex max-w-xl flex-col gap-5">
        <ProfileCard user={user} onSaved={setUser} />
        <PasswordCard onSaved={setUser} />
        {user.role === "super_admin" ? <UsersCard /> : null}
      </div>
    </div>
  );
}

function ProfileCard({
  user,
  onSaved,
}: {
  user: AuthUser;
  onSaved: (user: AuthUser) => void;
}) {
  const nameId = useId();
  const emailId = useId();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
  }, [user.email, user.name]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      onSaved(await updateProfile({ name, email }));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mt-0 mb-4 text-base font-semibold">Profile</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Name" htmlFor={nameId}>
          <Input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>
        <Field label="Email" htmlFor={emailId}>
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        {error ? (
          <p className="m-0 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? <p className="m-0 text-sm text-success">Profile saved.</p> : null}
        <div>
          <Button type="submit" loading={busy}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordCard({ onSaved }: { onSaved: (user: AuthUser) => void }) {
  const currentId = useId();
  const nextId = useId();
  const confirmId = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirm) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Use at least 8 characters");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      onSaved(
        await updateProfile({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mt-0 mb-4 text-base font-semibold">Password</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Current password" htmlFor={currentId}>
          <Input
            id={currentId}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </Field>
        <Field label="New password" htmlFor={nextId}>
          <Input
            id={nextId}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </Field>
        <Field label="Confirm new password" htmlFor={confirmId}>
          <Input
            id={confirmId}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </Field>
        {error ? (
          <p className="m-0 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? <p className="m-0 text-sm text-success">Password updated.</p> : null}
        <div>
          <Button type="submit" loading={busy}>
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function UsersCard() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function refresh() {
    try {
      setUsers(await listUsers());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Card>
      <div className="mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="m-0 text-base font-semibold">Users</h2>
          <p className="mt-1 mb-0 text-sm text-muted">
            Add people who can sign in to this Dossier.
          </p>
        </div>
        <Button size="sm" className="sm:shrink-0" onClick={() => setOpen(true)}>
          Add user
        </Button>
      </div>
      {error ? (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="m-0 list-none divide-y divide-line p-0">
        {users.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-medium">{item.name}</p>
              <p className="m-0 truncate text-[13px] text-muted">{item.email}</p>
            </div>
            <span className="shrink-0 text-[12px] text-muted">{roleLabel(item.role)}</span>
          </li>
        ))}
      </ul>
      {open ? (
        <AddUserModal
          onClose={() => setOpen(false)}
          onCreated={async () => {
            setOpen(false);
            await refresh();
          }}
        />
      ) : null}
    </Card>
  );
}

function AddUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createUser({ name, email, password });
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add user"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-user-form" loading={busy}>
            Add user
          </Button>
        </>
      }
    >
      <form id="add-user-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Name" htmlFor={nameId}>
          <Input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>
        <Field label="Email" htmlFor={emailId}>
          <Input
            id={emailId}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field label="Password" htmlFor={passwordId} hint="At least 8 characters.">
          <Input
            id={passwordId}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        {error ? (
          <p className="m-0 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
