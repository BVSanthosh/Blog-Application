import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/posts", label: "Explore" },
  { to: "/write", label: "Share" },
];

// NavLink tracks the active route itself; the old useState("select") never
// reset, so the underline stuck to whichever link was clicked last even after
// navigating elsewhere.
const linkClass = ({ isActive }) =>
  `text-white transition-opacity hover:opacity-80 ${isActive ? "underline underline-offset-4" : ""}`;

const NavBar = () => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="bg-primary-color p-4 h-16 w-full md:h-20 flex items-center justify-between px-4 md:px-8 lg:px-16 xl:px-32 2xl:px-64 relative z-20">
      <Link to="/" onClick={close} className="flex items-center gap-4">
        <img src="/logo.png" alt="btechlogs" className="w-40 max-h-10 object-contain" />
      </Link>

      {/* Mobile */}
      <div className="md:hidden">
        <button
          type="button"
          className="cursor-pointer text-3xl text-white leading-none"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "×" : "≡"}
        </button>

        {open && (
          <nav className="absolute top-16 left-0 w-full flex flex-col items-center gap-6 py-8 bg-primary-color shadow-lg text-lg font-medium">
            {links.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} onClick={close} className={linkClass}>
                {label}
              </NavLink>
            ))}
            {/* The mobile menu previously had no auth state at all: it always
                showed "Log In" and linked it to "/". */}
            <SignedOut>
              <Link to="/login" onClick={close}>
                <button type="button" className="py-2 px-4 rounded-3xl bg-blue-800 text-white">
                  Log In
                </button>
              </Link>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </nav>
        )}
      </div>

      {/* Desktop */}
      <nav className="hidden md:flex items-center gap-8 xl:gap-12 font-medium">
        {links.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            {label}
          </NavLink>
        ))}
        <SignedOut>
          <Link to="/login">
            <button type="button" className="py-2 px-4 rounded-3xl bg-blue-800 text-white">
              Log In
            </button>
          </Link>
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </nav>
    </header>
  );
};

export default NavBar;
