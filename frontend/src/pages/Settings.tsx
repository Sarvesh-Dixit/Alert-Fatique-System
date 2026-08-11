import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { user, organizations, currentOrg } = useAuth();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="card mb-4">
        <div className="font-semibold mb-3">Profile</div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="text-white/50">Name</div>
          <div>{user?.full_name}</div>
          <div className="text-white/50">Email</div>
          <div>{user?.email}</div>
          <div className="text-white/50">User ID</div>
          <div className="font-mono text-white/70">{user?.id}</div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="font-semibold mb-3">Current organization</div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="text-white/50">Name</div>
          <div>{currentOrg?.name}</div>
          <div className="text-white/50">Slug</div>
          <div className="font-mono text-white/70">{currentOrg?.slug}</div>
          <div className="text-white/50">Role</div>
          <div>{currentOrg?.role}</div>
          <div className="text-white/50">Organization ID</div>
          <div className="font-mono text-white/70">{currentOrg?.id}</div>
        </div>
      </div>

      <div className="card">
        <div className="font-semibold mb-3">Your organizations</div>
        <ul className="text-sm space-y-1">
          {organizations.map((o) => (
            <li key={o.id} className="flex justify-between">
              <span>{o.name}</span>
              <span className="text-white/40">{o.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
