import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Barbell, User, Users, ShieldCheck, Envelope, SignOut, Lock, X, CheckCircle, Warning, Bell, ChalkboardTeacher } from "@phosphor-icons/react";
import { Toaster } from "sonner";
import { GymProvider, useGym, useT, sendEmail, addAudit, generateId } from "./context/GymContext";
import type { AuthUser, Member } from "./types";
import { DEMO_CREDENTIALS } from "./constants";
import { LANGUAGES } from "./i18n/translations";
import PublicWebsite from "./components/PublicWebsite";
import AdminPortal from "./components/AdminPortal";
import StaffPortal from "./components/StaffPortal";
import MemberPortal from "./components/MemberPortal";
import TrainerPortal from "./components/TrainerPortal";
import { toast } from "sonner";

const EMAIL_STATUS_LABELS: Record<string, string> = { queued: "Queued", sent: "Sent", delivered: "Delivered", opened: "Opened", failed: "Failed" };
const EMAIL_TYPE_LABELS: Record<string, string> = { welcome: "Welcome", receipt: "Receipt", reminder: "Reminder", expiry: "Expiry", marketing: "Announcement" };

const normalizePath = (p: string) => {
  const clean = p.split("?")[0].split("#")[0].replace(/\/+$/, "").toLowerCase();
  return clean === "" ? "/" : clean;
};

const getInitialPath = () => {
  if (typeof window === "undefined") return "/";
  return normalizePath(window.location.pathname);
};

function AppShell() {
  const { state, dispatch } = useGym();
  const t = useT();
  const [path, setPath] = useState<string>(getInitialPath);
  const [page, setPage] = useState<"public" | "portal">(() => {
    const initial = getInitialPath();
    return initial === "/staff" ? "portal" : "public";
  });
  const [showLogin, setShowLogin] = useState(false);
  const [showEmailLog, setShowEmailLog] = useState(false);

  const navigate = (to: string, replace = false) => {
    const target = normalizePath(to);
    if (typeof window !== "undefined") {
      const current = normalizePath(window.location.pathname);
      if (current !== target) {
        if (replace) {
          window.history.replaceState({}, "", target);
        } else {
          window.history.pushState({}, "", target);
        }
      }
    }
    setPath(target);
  };

  useEffect(() => {
    const handlePopState = () => {
      const p = normalizePath(window.location.pathname);
      setPath(p);
      if (p === "/staff") {
        setPage("portal");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleLogin = (role: "owner" | "staff" | "member" | "trainer") => {
    const creds = DEMO_CREDENTIALS[role];
    const user: AuthUser = { id: creds.id, name: creds.name, role };
    if (role === "member") user.memberId = creds.id;
    if (role === "trainer") user.trainerId = creds.id;
    dispatch({ type: "SET_USER", payload: user });
    setShowLogin(false);
    setPage("portal");
    if (role === "staff") {
      navigate("/staff");
    } else if (path === "/staff") {
      navigate("/");
    }
    toast.success(t("app.welcome", { name: creds.name }));
  };

  const handleLogout = () => {
    dispatch({ type: "SET_USER", payload: null });
    setPage("public");
    navigate("/");
    toast(t("app.loggedOut"));
  };

  const handleJoin = (member: Member) => {
    dispatch({ type: "ADD_MEMBER", payload: member });
    dispatch({ type: "SET_USER", payload: { id: member.id, name: member.name, role: "member", memberId: member.id } });
    setPage("portal");
    navigate("/");
    toast.success(t("app.joined", { name: member.name }));
  };

  const closeLogin = () => {
    setShowLogin(false);
    if (!state.currentUser) {
      setPage("public");
    }
  };

  // Open the login modal when the portal is requested without an authenticated user.
  // /staff has its own inline login page, so no modal is needed there.
  useEffect(() => {
    if (path === "/staff") {
      if (state.currentUser && state.currentUser.role !== "staff" && state.currentUser.role !== "owner") {
        toast.error("Staff access required");
        navigate("/", true);
      }
    } else if (page === "portal" && !state.currentUser) {
      setShowLogin(true);
    }
  }, [path, page, state.currentUser]);

  const handleStaffLogin = () => {
    handleLogin("staff");
  };

  const currentView = () => {
    if (path === "/staff") {
      if (state.currentUser && (state.currentUser.role === "staff" || state.currentUser.role === "owner")) {
        return <StaffPortal />;
      }
      // Dedicated staff login page (inline, not a modal)
      return (
        <div className="min-h-[80dvh] flex items-center justify-center px-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-400/20 rounded-full flex items-center justify-center">
                <Users weight="fill" className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase text-white">{t("app.role.staff")} {t("app.loginTitle")}</h2>
                <p className="text-sm text-zinc-500">{t("app.role.staffDesc")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6 bg-zinc-800/50 rounded-xl p-3">
              <Lock className="w-4 h-4" /> {t("app.loginHint")}
            </div>
            <button onClick={handleStaffLogin} className="w-full bg-blue-500 hover:bg-blue-400 border border-blue-400/30 rounded-xl p-4 flex items-center gap-4 transition-colors text-left active:scale-[0.98]">
              <div className="w-12 h-12 bg-blue-400/20 rounded-full flex items-center justify-center"><Users weight="fill" className="w-6 h-6 text-blue-400" /></div>
              <div><div className="font-bold text-white">{t("app.role.staff")}</div><div className="text-sm text-blue-200/70">{t("app.role.staffDesc")}</div></div>
            </button>
          </motion.div>
        </div>
      );
    }

    if (page === "public") return <PublicWebsite onJoin={handleJoin} />;
    if (!state.currentUser) return <PublicWebsite onJoin={handleJoin} />;
    switch (state.currentUser.role) {
      case "owner": return <AdminPortal />;
      case "staff": return <StaffPortal />;
      case "member": return <MemberPortal />;
      case "trainer": return <TrainerPortal />;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 scroll-smooth">
      {/* Main navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setPage("public"); navigate("/"); }}>
            <Barbell weight="fill" className="w-7 h-7 text-lime-400" />
            <span className="font-black text-lg uppercase tracking-tight text-white hidden sm:block">{state.settings.gymName}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1" role="group" aria-label={t("app.language")}>
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => dispatch({ type: "SET_LANGUAGE", payload: lang.code })}
                  title={lang.label}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${state.language === lang.code ? "bg-lime-400 text-zinc-950" : "text-zinc-400 hover:text-white"}`}
                >
                  {lang.short}
                </button>
              ))}
            </div>
            {state.currentUser ? (
              <>
                <button
                  onClick={() => {
                    if (state.currentUser?.role === "staff") {
                      navigate("/staff");
                    } else {
                      setPage("portal");
                      navigate("/");
                    }
                  }}
                  className="text-sm text-zinc-400 hover:text-white hidden sm:flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Dashboard"
                >
                  {state.currentUser.role === "owner" && <ShieldCheck className="w-4 h-4 text-lime-400" />}
                  {state.currentUser.role === "staff" && <Users className="w-4 h-4 text-blue-400" />}
                  {state.currentUser.role === "member" && <User className="w-4 h-4 text-yellow-400" />}
                  {state.currentUser.role === "trainer" && <ChalkboardTeacher className="w-4 h-4 text-amber-400" />}
                  {state.currentUser.name}
                </button>
                <button onClick={() => setShowEmailLog(true)} className="relative p-2 text-zinc-400 hover:text-white transition-colors">
                  <Envelope className="w-5 h-5" />
                  {state.emailLogs.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-lime-400 text-zinc-950 text-[10px] font-bold rounded-full flex items-center justify-center">{state.emailLogs.length}</span>}
                </button>
                <button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-red-400 transition-colors" title={t("app.logout")}><SignOut className="w-5 h-5" /></button>
              </>
            ) : (
              <>
                <button onClick={() => { setShowLogin(true); setPage("portal"); }} className="bg-lime-400 text-zinc-950 px-4 py-2 rounded-xl font-bold text-sm hover:bg-lime-300 transition-colors active:scale-[0.97]">
                  {t("app.portalAccess")}
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main content - offset below the fixed navigation bar so sections never render underneath it */}
      <main className="relative pt-16 md:pt-[4.5rem]">
        {currentView()}
      </main>

      {/* Login modal */}
      <AnimatePresence>
        {showLogin && !state.currentUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={closeLogin}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black uppercase">{t("app.loginTitle")}</h3>
                <button onClick={closeLogin}><X className="w-5 h-5 text-zinc-400" /></button>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6 bg-zinc-800/50 rounded-xl p-3">
                <Lock className="w-4 h-4" /> {t("app.loginHint")}
              </div>
              <div className="space-y-3">
                <button onClick={() => handleLogin("owner")} className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl p-4 flex items-center gap-4 transition-colors text-left active:scale-[0.98]">
                  <div className="w-12 h-12 bg-lime-400/20 rounded-full flex items-center justify-center"><ShieldCheck weight="fill" className="w-6 h-6 text-lime-400" /></div>
                  <div><div className="font-bold">{t("app.role.owner")}</div><div className="text-sm text-zinc-500">{t("app.role.ownerDesc")}</div></div>
                </button>

                <button onClick={() => handleLogin("trainer")} className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl p-4 flex items-center gap-4 transition-colors text-left active:scale-[0.98]">
                  <div className="w-12 h-12 bg-amber-400/20 rounded-full flex items-center justify-center"><ChalkboardTeacher weight="fill" className="w-6 h-6 text-amber-400" /></div>
                  <div><div className="font-bold">{t("app.role.trainer")}</div><div className="text-sm text-zinc-500">{t("app.role.trainerDesc")}</div></div>
                </button>
                <button onClick={() => handleLogin("member")} className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl p-4 flex items-center gap-4 transition-colors text-left active:scale-[0.98]">
                  <div className="w-12 h-12 bg-yellow-400/20 rounded-full flex items-center justify-center"><User weight="fill" className="w-6 h-6 text-yellow-400" /></div>
                  <div><div className="font-bold">{t("app.role.member")}</div><div className="text-sm text-zinc-500">{t("app.role.memberDesc")}</div></div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* E-mail log */}
      <AnimatePresence>
        {showEmailLog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={() => setShowEmailLog(false)}>
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-zinc-900 border-l border-zinc-800 p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2"><Envelope className="w-5 h-5 text-lime-400" /> {t("app.emailLog")}</h3>
                <button onClick={() => setShowEmailLog(false)}><X className="w-5 h-5 text-zinc-400" /></button>
              </div>
              <div className="space-y-4">
                {state.emailLogs.slice().reverse().map(email => (
                  <div key={email.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold text-sm">{email.subject}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${email.status === "opened" ? "bg-lime-400/20 text-lime-400" : email.status === "delivered" ? "bg-blue-400/20 text-blue-400" : email.status === "failed" ? "bg-red-400/20 text-red-400" : "bg-zinc-600/20 text-zinc-400"}`}>{EMAIL_STATUS_LABELS[email.status] || email.status}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mb-2">{t("app.recipient")}: {email.toName} &lt;{email.to}&gt;</div>
                    <div className="text-xs text-zinc-400 line-clamp-2">{email.body}</div>
                    <div className="flex justify-between items-center mt-3 text-xs text-zinc-600">
                      <span>{EMAIL_TYPE_LABELS[email.type] || email.type}</span>
                      <span>{new Date(email.sentAt).toLocaleString("en-US")}</span>
                    </div>
                  </div>
                ))}
                {state.emailLogs.length === 0 && <p className="text-zinc-500 text-center py-8">{t("app.noEmails")}</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster position="top-right" toastOptions={{ style: { background: "#18181b", border: "1px solid #27272a", color: "#fff" } }} />
    </div>
  );
}

export default function App() {
  return (
    <GymProvider>
      <AppShell />
    </GymProvider>
  );
}