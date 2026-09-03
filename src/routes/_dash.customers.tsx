import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, History, ShieldBan, MapPin } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { paymentsApi, usersApi, type AdminUserDetails, type ApiUser, type Payment, type UserActivity } from "@/lib/api";
import { LocationDisplay } from "@/components/location-display";
import { LocationPicker, type LocationPickerValue } from "@/components/location-picker";

export const Route = createFileRoute("/_dash/customers")({ component: ClientsPage });

function ClientsPage() {
  const { can } = useAuth();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<ApiUser | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "activity" | null>(null);
  const [details, setDetails] = useState<AdminUserDetails | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");

  const load = async () => {
    try {
      setError(null);
      setUsers(await usersApi.list("client"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load clients.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      users.filter((user) =>
        `${user.full_name} ${user.email ?? ""} ${user.phone ?? ""} ${user.role.name} ${user.city ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [users, query]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleUsers = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const open = async (user: ApiUser, next: "view" | "edit" | "activity") => {
    setSelected(user);
    setMode(next);
    setActivity(null);
    setDetails(null);
    try {
      if (next === "view") setDetails(await usersApi.get(user.id));
      if (next === "activity") setActivity(await usersApi.activity(user.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load client information.");
    }
  };

  const mutate = async (work: () => Promise<ApiUser>) => {
    try {
      await work();
      setMode(null);
      setSelected(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action could not be completed.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client management"
        description="View client accounts, update profile information, and review account activity."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card className="p-4">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search client names, email addresses, phone numbers, or roles…"
          className="mb-4 max-w-md"
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>City / Location</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleUsers.map((user, index) => (
              <TableRow key={user.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {String((page - 1) * pageSize + index + 1).padStart(2, "0")}
                </TableCell>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell>{user.email ?? "—"}</TableCell>
                <TableCell>{user.phone ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={user.is_active ? "success" : "destructive"}>
                    {user.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[220px]">
                  <LocationDisplay
                    lat={user.residency_latitude}
                    lng={user.residency_longitude}
                    city={user.city}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      className="bg-blue-950 text-white hover:bg-blue-900"
                      onClick={() => void open(user, "view")}
                    >
                      View details
                    </Button>
                    {can("users.update") && (
                      <Button
                        size="sm"
                        className="bg-blue-600 text-white hover:bg-blue-700"
                        onClick={() => void open(user, "edit")}
                      >
                        Edit
                      </Button>
                    )}
                    {can("audit_logs.read") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-950 text-blue-950 hover:bg-blue-50 hover:text-blue-950"
                        onClick={() => void open(user, "activity")}
                      >
                        Activity
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!visibleUsers.length && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                  No clients match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {filtered.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            totalPages={totalPages}
            setPage={setPage}
            setPageSize={setPageSize}
          />
        )}
      </Card>
      <Dialog
        open={Boolean(selected && mode)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelected(null);
            setMode(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === "activity"
                ? "Activity history"
                : mode === "edit"
                  ? "Edit client"
                  : "Client details"}
            </DialogTitle>
          </DialogHeader>
          {selected && mode === "view" && (
            <Details
              user={details?.user ?? selected}
              details={details}
              can={can}
              banReason={banReason}
              setBanReason={setBanReason}
              mutate={mutate}
              openActivity={() => void open(selected, "activity")}
            />
          )}
          {selected && mode === "edit" && (
            <EditClient
              user={selected}
              save={(body) => mutate(() => usersApi.update(selected.id, body))}
            />
          )}
          {selected && mode === "activity" && <Activity activity={activity} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Details({
  user,
  details,
  can,
  banReason,
  setBanReason,
  mutate,
  openActivity,
}: {
  user: ApiUser;
  details: AdminUserDetails | null;
  can: (...permissions: string[]) => boolean;
  banReason: string;
  setBanReason: (value: string) => void;
  mutate: (work: () => Promise<ApiUser>) => Promise<void>;
  openActivity: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          ["Full name", user.full_name],
          ["Email", user.email],
          ["Phone", user.phone],
          ["Username", user.username],
          ["Role", user.role.name],
          ["Nationality", user.nationality],
          ["Last login", user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "—"],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-medium">{value || "—"}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 text-blue-900" />
          Location & City
        </p>
        <p className="mt-1 font-medium text-sm">
          <LocationDisplay
            lat={user.residency_latitude}
            lng={user.residency_longitude}
            city={user.city}
            fallback="No location provided"
          />
        </p>
      </div>

      {details && (
        <div className="grid grid-cols-2 gap-3">
          <Summary label="Active bookings" value={details.active_bookings.length} />
          <Summary label="Past bookings" value={details.past_bookings.length} />
          <Summary label="Active subscriptions" value={details.active_subscriptions.length} />
          <Summary label="Past subscriptions" value={details.past_subscriptions.length} />
        </div>
      )}
      {can("payments.read") && <CustomerPayments customerId={user.id} />}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="border-blue-950 text-blue-950 hover:bg-blue-50 hover:text-blue-950"
          onClick={openActivity}
        >
          <History className="mr-2 size-4" />
          Activity history
        </Button>
        {user.is_active && can("users.suspend") && (
          <Button
            className="bg-amber-500 text-white hover:bg-amber-600"
            onClick={() => void mutate(() => usersApi.suspend(user.id))}
          >
            Suspend
          </Button>
        )}
        {!user.is_active && can("users.reactivate") && (
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => void mutate(() => usersApi.reactivate(user.id))}
          >
            Reactivate
          </Button>
        )}
        {can("users.delete") && (
          <Button
            variant="destructive"
            onClick={() => {
              if (window.confirm(`Deactivate ${user.full_name}?`))
                void mutate(() => usersApi.deactivate(user.id));
            }}
          >
            Deactivate
          </Button>
        )}
      </div>
      {can("users.ban") && (
        <div className="rounded-lg border border-destructive/30 p-4">
          <Label>Ban reason</Label>
          <Input
            className="mt-2"
            value={banReason}
            onChange={(event) => setBanReason(event.target.value)}
            placeholder="Reason for banning this account"
          />
          <Button
            className="mt-3"
            variant="destructive"
            disabled={!banReason.trim()}
            onClick={() => void mutate(() => usersApi.ban(user.id, banReason))}
          >
            <ShieldBan className="mr-2 size-4" />
            Ban client
          </Button>
        </div>
      )}
      {can("users.unban") && !user.is_active && (
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => void mutate(() => usersApi.unban(user.id))}
        >
          Unban and reactivate
        </Button>
      )}
    </div>
  );
}

function CustomerPayments({ customerId }: { customerId: string }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    paymentsApi
      .customerPayments(customerId, { status: "successful", limit: 50 })
      .then((data) => {
        if (active) setPayments(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [customerId]);
  return (
    <section className="space-y-2 rounded-lg border p-4">
      <div>
        <h3 className="font-medium">Payments</h3>
        <p className="text-xs text-muted-foreground">Successful customer payments</p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading payments…</p>
      ) : payments.length ? (
        <div className="divide-y text-sm">
          {payments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="font-mono text-xs">
                  {payment.payment_number || payment.id.slice(0, 8).toUpperCase()} ·{" "}
                  {payment.booking_invoice || payment.booking_id.slice(0, 8).toUpperCase()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(payment.created_at).toLocaleString()} · {payment.provider}
                </p>
              </div>
              <p className="font-medium">
                {payment.currency} {Number(payment.amount).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No successful payments yet.</p>
      )}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function EditClient({
  user,
  save,
}: {
  user: ApiUser;
  save: (
    body: Partial<
      Pick<
        ApiUser,
        | "full_name"
        | "username"
        | "email"
        | "phone"
        | "city"
        | "nationality"
        | "residency_latitude"
        | "residency_longitude"
      >
    >
  ) => void;
}) {
  const [form, setForm] = useState({
    full_name: user.full_name || "",
    username: user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    city: user.city || "",
    nationality: user.nationality || "",
    residency_latitude: user.residency_latitude,
    residency_longitude: user.residency_longitude,
  });

  const handleLocationChange = (val: LocationPickerValue) => {
    setForm((prev) => ({
      ...prev,
      residency_latitude: val.latitude,
      residency_longitude: val.longitude,
      city: val.city || prev.city,
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const patch: Partial<
      Pick<
        ApiUser,
        | "full_name"
        | "username"
        | "email"
        | "phone"
        | "city"
        | "nationality"
        | "residency_latitude"
        | "residency_longitude"
      >
    > = {};

    if (form.full_name !== user.full_name) patch.full_name = form.full_name;
    if (form.username !== (user.username ?? "")) patch.username = form.username;
    if (form.email !== (user.email ?? "")) patch.email = form.email;
    if (form.phone !== (user.phone ?? "")) patch.phone = form.phone;
    if (form.city !== (user.city ?? "")) patch.city = form.city;
    if (form.nationality !== (user.nationality ?? "")) patch.nationality = form.nationality;
    if (form.residency_latitude !== user.residency_latitude)
      patch.residency_latitude = form.residency_latitude ?? undefined;
    if (form.residency_longitude !== user.residency_longitude)
      patch.residency_longitude = form.residency_longitude ?? undefined;

    if (Object.keys(patch).length > 0) {
      save(patch);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Full name</Label>
          <Input
            className="mt-1"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Username</Label>
          <Input
            className="mt-1"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            className="mt-1"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            className="mt-1"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <Label>City</Label>
          <Input
            className="mt-1"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="e.g. Nairobi"
          />
        </div>
        <div>
          <Label>Nationality</Label>
          <Input
            className="mt-1"
            value={form.nationality}
            onChange={(e) => setForm({ ...form, nationality: e.target.value })}
          />
        </div>
      </div>

      <div className="pt-2">
        <LocationPicker
          latitude={form.residency_latitude}
          longitude={form.residency_longitude}
          city={form.city}
          onChange={handleLocationChange}
          label="Client Residency & Map Pin"
          placeholder="Search client residence, estate, landmark…"
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit">Save changes</Button>
      </div>
    </form>
  );
}

function Activity({ activity }: { activity: UserActivity | null }) {
  if (!activity) return <p className="text-sm text-muted-foreground">Loading activity…</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Last sign-in:{" "}
        <span className="font-medium">
          {activity.last_login_at ? new Date(activity.last_login_at).toLocaleString() : "Not available"}
        </span>
      </p>
      <div className="max-h-80 divide-y overflow-y-auto rounded-md border">
        {activity.events.length ? (
          activity.events.map((event) => (
            <div key={event.id} className="p-3 text-sm">
              <div className="font-medium">{event.action}</div>
              <div className="text-xs text-muted-foreground">
                {event.actor_email ?? "System"} · {new Date(event.created_at).toLocaleString()}
              </div>
            </div>
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No recorded activity.</p>
        )}
      </div>
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  setPage,
  setPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  setPage: (page: number | ((current: number) => number)) => void;
  setPageSize: (pageSize: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => {
            setPageSize(Number(value));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[5, 10, 25, 50, 100].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} clients
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage((current) => current - 1)}
        >
          <ChevronLeft />
          Previous
        </Button>
        <span className="min-w-20 text-center text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page === totalPages}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
