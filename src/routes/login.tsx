import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff, Sparkles } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — SafishaPro" }, { name: "description", content: "Sign in to SafishaPro admin dashboard." }] }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex bg-background">
      <div className="flex-1 flex items-center justify-center p-6">

        <Card className="w-full max-w-md p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in with your SafishaPro staff account.</p>
          </div>
          {showReset ? <form className="space-y-4" onSubmit={async (event) => {
            event.preventDefault(); setError(null); setResetMessage(null); setIsSubmitting(true);
            try { await authApi.requestPasswordReset(email); setResetMessage("If this email is registered, password-reset instructions have been sent."); }
            catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to request a reset."); }
            finally { setIsSubmitting(false); }
          }}>
            <div className="space-y-2"><Label htmlFor="reset-email">Staff email</Label><Input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            {resetMessage && <p className="text-sm text-muted-foreground">{resetMessage}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Sending…" : "Request password reset"}</Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => { setShowReset(false); setError(null); }}>Back to sign in</Button>
          </form> : <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setIsSubmitting(true);
              try {
                await login(email, password);
                navigate({ to: "/dashboard" });
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Unable to sign in.");
              } finally { setIsSubmitting(false); }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email or Username</Label>
              <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} className="pr-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}</Button>
            <Button type="button" variant="link" className="w-full" onClick={() => { setShowReset(true); setError(null); }}>Forgot your password?</Button>
          </form>}
        </Card>
      </div>
    </div>
  );
}
