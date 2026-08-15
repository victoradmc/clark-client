import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { Session } from "../data/clarkApi";
import { logout } from "../data/clarkApi";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-[13.5px] font-semibold no-underline ${isActive ? "text-ink" : "text-muted"}`;

export default function AppShell({
  session,
  isAdmin,
  children,
}: {
  session: Session;
  isAdmin: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <nav className="border-border-soft sticky top-0 z-10 flex h-16 items-center gap-7 border-b bg-white px-8">
        <div className="mr-2 flex items-center gap-2">
          <div className="bg-brand h-[22px] w-[22px] rounded-[7px]" />
          <span className="text-[15px] font-bold tracking-[-0.01em]">
            Clark
          </span>
        </div>
        <NavLink to="/" end className={navLinkClass}>
          Lesson Hub
        </NavLink>
        <NavLink to="/upload" className={navLinkClass}>
          Upload Lesson
        </NavLink>
        <NavLink to="/upload-test" className={navLinkClass}>
          Upload Test
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" className={navLinkClass}>
            Admin
          </NavLink>
        )}
        <span className="flex-1" />
        <NavLink
          to="/profile"
          className="text-label rounded-full text-[13px] font-semibold no-underline hover:underline"
        >
          {session.user.email}
        </NavLink>
        <button
          type="button"
          onClick={() => void logout()}
          className="border-border text-label rounded-full border px-3.5 py-1.5 text-[13px] font-semibold"
        >
          Log out
        </button>
      </nav>
      <div className="flex-1 px-8 py-10">
        <div className="mx-auto max-w-[1080px]">{children}</div>
      </div>
    </div>
  );
}
