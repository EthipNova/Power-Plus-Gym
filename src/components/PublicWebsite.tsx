import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Barbell, Users, Lightning, ShieldCheck, Heart, Star, MapPin, Phone, Envelope, ArrowRight, CheckCircle, Clock, Flame, GraduationCap, MoonStars, MusicNotes, Sparkle } from "@phosphor-icons/react";
import { useGym, formatETB, sendEmail, planAppliesToCategory, planCategoryText, categoryLabelOf } from "../context/GymContext";
import type { CustomerCategory, Member } from "../types";

const CATEGORY_ICONS: Record<CustomerCategory, typeof Sparkle> = { REGULAR: Sparkle, STUDENT: GraduationCap, MUSLIM: MoonStars, AEROBICS: MusicNotes };
const SHOWCASE_IMAGE = "https://dala-prod-public-storage.s3.eu-west-1.amazonaws.com/attachments/74c3195e-a7cc-42d6-bc7d-af4a5309a248/1791041128283_Screenshot_2026-10-03_182425.webp";
import { toast } from "sonner";
import { registerCustomer } from "../services/registration";

export default function PublicWebsite({ onJoin }: { onJoin: (member: Member) => void | Promise<void> }) {
  const { state, dispatch } = useGym();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("p2");
  const [joinCategory, setJoinCategory] = useState<CustomerCategory>("REGULAR");
  const [showWomensHours, setShowWomensHours] = useState(false);
  const [joinForm, setJoinForm] = useState({ name: "", phone: "", email: "", studentId: "", institution: "" });
  const [joinPassword, setJoinPassword] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });

  const plansForCategory = state.plans.filter(p => p.active && planAppliesToCategory(p, joinCategory));

  const selectCategory = (category: CustomerCategory) => {
    setJoinCategory(category);
    const next = state.plans.find(p => p.active && planAppliesToCategory(p, category));
    if (next) setSelectedPlan(next.id);
  };

  const handleJoin = async () => {
    if (!joinForm.name || !joinForm.phone || !joinForm.email) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (joinPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    const plan = state.plans.find(p => p.id === selectedPlan) ?? plansForCategory[0];
    if (!plan) {
      toast.error("No membership is available for this category");
      return;
    }
    if (joinCategory === "STUDENT" && !joinForm.studentId) {
      toast.error("A student ID number is required for the Student category");
      return;
    }
    setIsJoining(true);
    try {
      const registered = await registerCustomer({ email: joinForm.email, password: joinPassword, fullName: joinForm.name, phone: joinForm.phone, planName: plan.name, planPrice: plan.price, durationDays: plan.durationDays });
      const newMember: Member = {
        id: registered.id,
        name: joinForm.name,
        phone: joinForm.phone,
        email: joinForm.email,
        memberId: registered.customerCode,
        planId: plan.id,
        joinDate: new Date().toISOString().split("T")[0],
        expiryDate: new Date(Date.now() + plan.durationDays * 86400000).toISOString().split("T")[0],
        status: "active",
        lastVisit: null,
        emergencyContact: "",
        emergencyPhone: "",
        medicalNotes: "",
        emailNotifications: true,
        balanceDue: 0,
        category: joinCategory,
        studentId: joinCategory === "STUDENT" ? joinForm.studentId : undefined,
        institution: joinCategory === "STUDENT" ? joinForm.institution : undefined,
        studentVerified: false,
      };
      await onJoin(newMember);
      sendEmail(state, dispatch, joinForm.email, joinForm.name, "Welcome to Power Plus Gym!", `Hi ${joinForm.name}, your ${plan.name} membership (${categoryLabelOf(state, joinCategory)} category) is active until ${newMember.expiryDate}.`, "welcome");
      toast.success(registered.membershipCreated
        ? `Welcome ${joinForm.name}! Your ${plan.name} membership is active.`
        : `Welcome ${joinForm.name}! Your customer account was created; membership setup is pending.`);
      setShowJoinModal(false);
      setJoinForm({ name: "", phone: "", email: "", studentId: "", institution: "" });
      setJoinPassword("");
    } catch (cause) {
      console.error("Join Us registration failed", cause);
      toast.error(cause instanceof Error ? cause.message : "Registration failed. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleContact = () => {
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      toast.error("Please fill in all required fields");
      return;
    }
    toast.success("Message sent! We will reply within 24 hours.");
    setContactForm({ name: "", email: "", message: "" });
  };

  const stats = [
    { label: "Active members", value: state.members.filter(m => m.status === "active").length, icon: Users },
    { label: "Monthly revenue", value: formatETB(state.payments.reduce((a, p) => a + p.amount, 0)), icon: Lightning },
    { label: "Equipment units", value: "50+", icon: Barbell },
    { label: "Years of experience", value: "8", icon: ShieldCheck },
  ];

  const facilities = [
    { name: "Free-weights zone", desc: "Olympic bars, dumbbells up to 60 kg, squat racks", icon: Barbell },
    { name: "Cardio floor", desc: "Treadmills, bikes and rowers with entertainment screens", icon: Flame },
    { name: "Group classes", desc: "HIIT, spin, yoga and CrossFit every single day", icon: Users },
    { name: "Recovery area", desc: "Sauna, steam room and cold plunge", icon: Heart },
    { name: "Personal coaching", desc: "Certified coaches building tailor-made programs", icon: Star },
    { name: "Nutrition bar", desc: "Protein shakes, prepared meals and supplements", icon: Lightning },
  ];

  if (showWomensHours) {
    return <WomensHoursPage rules={state.accessRules.filter(rule => rule.category === "MUSLIM" && rule.active)} trainers={state.trainers.filter(trainer => trainer.active)} onBack={() => setShowWomensHours(false)} />;
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white">
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-24 px-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(163,230,53,0.08),transparent_60%)]" />
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="inline-flex items-center gap-2 bg-lime-400/10 border border-lime-400/20 rounded-full px-4 py-1.5 text-lime-400 text-sm font-medium mb-6">
              <Lightning weight="fill" className="w-4 h-4" /> Addis Ababa's #1 gym
            </span>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none mb-4">
              Train hard.<br />
              <span className="text-lime-400">Stay strong.</span>
            </h1>
            <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-8">
              A premium gym with world-class equipment, expert coaches and a community that pushes you further.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => setShowJoinModal(true)} className="bg-lime-400 text-zinc-950 font-bold px-8 py-4 rounded-xl hover:bg-lime-300 transition-colors text-lg active:scale-[0.98]">
                Join now
              </button>
              <a href="#plans" className="border border-zinc-700 text-white font-semibold px-8 py-4 rounded-xl hover:border-lime-400/50 transition-colors text-lg text-center active:scale-[0.98]">
                See memberships
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-zinc-800/50 bg-zinc-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 py-12 px-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
              <s.icon weight="fill" className="w-8 h-8 text-lime-400 mx-auto mb-2" />
              <div className="text-2xl md:text-3xl font-black text-white">{s.value}</div>
              <div className="text-sm text-zinc-500 font-medium">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Training floor showcase */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative rounded-3xl overflow-hidden border border-zinc-800 bg-zinc-900">
            <img src={SHOWCASE_IMAGE} alt="Inside the Power Plus Gym training floor" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
            <div className="relative z-10 flex min-h-[20rem] md:min-h-[26rem] flex-col justify-end p-6 md:p-10">
              <span className="text-xs font-bold uppercase tracking-widest text-lime-400">Inside the club</span>
              <h3 className="text-2xl md:text-4xl font-black uppercase tracking-tight mt-2">Where the work happens</h3>
              <p className="text-zinc-300 text-sm md:text-base max-w-xl mt-2">Real iron, real coaching, real results — every session on our floor is built to move you forward.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Facilities Bento Grid */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4">World-class facilities</h2>
          <p className="text-zinc-400 mb-12 max-w-lg">Everything you need to train at the top of your game, all under one roof.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-stretch">
            {facilities.map((f, i) => (
              <motion.div key={f.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-lime-400/30 transition-colors group">
                <f.icon weight="fill" className="w-10 h-10 text-lime-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-2">{f.name}</h3>
                <p className="text-zinc-400 text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Member categories & access slots (Phase 2) */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4 text-center">Our member categories</h2>
          <p className="text-zinc-400 mb-12 text-center max-w-2xl mx-auto">Every profile enjoys its own rate card and its own access slots.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 items-stretch">
            {state.categoryLabels.map(cat => {
              const Icon = CATEGORY_ICONS[cat.category];
              const rules = state.accessRules.filter(r => r.category === cat.category && r.active);
              return (
                <motion.div key={cat.category} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} onClick={() => cat.category === "MUSLIM" && setShowWomensHours(true)} onKeyDown={e => { if (cat.category === "MUSLIM" && (e.key === "Enter" || e.key === " ")) setShowWomensHours(true); }} role={cat.category === "MUSLIM" ? "button" : undefined} tabIndex={cat.category === "MUSLIM" ? 0 : undefined} className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-lime-400/30 transition-colors ${cat.category === "MUSLIM" ? "cursor-pointer" : ""}`}>
                  <Icon weight="fill" className="w-9 h-9 text-lime-400 mb-3" />
                  <h3 className="text-lg font-bold mb-1">{cat.label}</h3>
                  <p className="text-zinc-400 text-sm mb-4">{cat.description}</p>
                  <div className="space-y-1">
                    {rules.map(r => (
                      <div key={r.id} className="text-xs text-zinc-500 flex items-start gap-2"><Clock className="w-3.5 h-3.5 text-lime-400 mt-0.5 shrink-0" /><span>{r.startTime} – {r.endTime} · {r.days.join(", ")}</span></div>
                    ))}
                    {rules.length === 0 && <span className="text-xs text-zinc-600">Free access during opening hours</span>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Memberships */}
      <section id="plans" className="scroll-mt-24 py-24 px-4 bg-zinc-900/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4 text-center">Our memberships</h2>
          <p className="text-zinc-400 mb-12 text-center">Pick the plan that fits your goals.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {state.plans.filter(p => p.active).map((plan, i) => (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl p-6 border ${i === 1 ? "border-lime-400 bg-zinc-900 shadow-lg shadow-lime-400/5" : "border-zinc-800 bg-zinc-950"}`}>
                {i === 1 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-lime-400 text-zinc-950 text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</span>}
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <div className="text-3xl font-black text-lime-400 mb-1">{formatETB(plan.price)}</div>
                <div className="text-sm text-zinc-500 mb-2">{plan.durationDays} days of access</div>
                <div className="text-xs text-lime-400/80 mb-4 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {planCategoryText(state, plan)}</div>
                <ul className="space-y-2 mb-6">
                  {plan.perks.map(perk => (
                    <li key={perk} className="flex items-center gap-2 text-sm text-zinc-300">
                      <CheckCircle weight="fill" className="w-4 h-4 text-lime-400" /> {perk}
                    </li>
                  ))}
                </ul>
                <button onClick={() => { setSelectedPlan(plan.id); setShowJoinModal(true); }}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-colors active:scale-[0.98] ${i === 1 ? "bg-lime-400 text-zinc-950 hover:bg-lime-300" : "bg-zinc-800 text-white hover:bg-zinc-700"}`}>
                  Choose this plan
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-12 text-center">Get in touch</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="flex items-start gap-4"><MapPin weight="fill" className="w-6 h-6 text-lime-400 mt-1" /><div><div className="font-bold">Address</div><div className="text-zinc-400">{state.settings.address}</div></div></div>
              <div className="flex items-start gap-4"><Phone weight="fill" className="w-6 h-6 text-lime-400 mt-1" /><div><div className="font-bold">Phone</div><div className="text-zinc-400">{state.settings.phone}</div></div></div>
              <div className="flex items-start gap-4"><Envelope weight="fill" className="w-6 h-6 text-lime-400 mt-1" /><div><div className="font-bold">E-mail</div><div className="text-zinc-400">{state.settings.email}</div></div></div>
              <div className="flex items-start gap-4"><Clock weight="fill" className="w-6 h-6 text-lime-400 mt-1" /><div><div className="font-bold">Opening hours</div><div className="text-zinc-400">Monday to Saturday: 05:00 AM – 11:00 PM<br />Sunday: 06:00 AM – 09:00 PM</div></div></div>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleContact(); }} className="space-y-4">
              <input value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Your name" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:border-lime-400/50 focus:outline-none" />
              <input value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} placeholder="E-mail address" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:border-lime-400/50 focus:outline-none" />
              <textarea value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })} placeholder="Your message" rows={4} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:border-lime-400/50 focus:outline-none resize-none" />
              <button type="submit" className="w-full bg-lime-400 text-zinc-950 font-bold py-3 rounded-xl hover:bg-lime-300 transition-colors active:scale-[0.98]">Send message</button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Barbell weight="fill" className="w-6 h-6 text-lime-400" />
            <span className="font-black text-lg uppercase">{state.settings.gymName}</span>
          </div>
          <p className="text-zinc-500 text-sm">&copy; 2025 {state.settings.gymName}. All rights reserved.</p>
        </div>
      </footer>

      {/* Join Modal */}
      <AnimatePresence>
        {showJoinModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowJoinModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="text-2xl font-black uppercase mb-2">Join {state.settings.gymName}</h3>
              <p className="text-sm text-zinc-500 mb-6">Choose your category: the plans shown adapt automatically.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-500 block mb-2">Member category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {state.categoryLabels.map(cat => (
                      <button key={cat.category} type="button" onClick={() => selectCategory(cat.category)} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${joinCategory === cat.category ? "bg-lime-400 text-zinc-950 border-lime-400" : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-lime-400/40"}`}>{cat.label}</button>
                    ))}
                  </div>
                </div>
                <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lime-400/50">
                  {plansForCategory.map(p => <option key={p.id} value={p.id}>{p.name} - {formatETB(p.price)}</option>)}
                </select>
                <input value={joinForm.name} onChange={e => setJoinForm({ ...joinForm, name: e.target.value })} placeholder="Full name" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50" />
                <input value={joinForm.phone} onChange={e => setJoinForm({ ...joinForm, phone: e.target.value })} placeholder="Phone number" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50" />
                <input value={joinForm.email} onChange={e => setJoinForm({ ...joinForm, email: e.target.value })} placeholder="E-mail address" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50" />
                <input type="password" value={joinPassword} onChange={e => setJoinPassword(e.target.value)} placeholder="Password (min. 6 characters)" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50" />
                {joinCategory === "STUDENT" && (
                  <div className="space-y-3 border border-blue-400/30 bg-blue-400/5 rounded-xl p-3">
                    <p className="text-xs text-blue-400">Student proof required — verified at reception before the reduced rate is activated.</p>
                    <input value={joinForm.studentId} onChange={e => setJoinForm({ ...joinForm, studentId: e.target.value })} placeholder="Student ID number *" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50" />
                    <input value={joinForm.institution} onChange={e => setJoinForm({ ...joinForm, institution: e.target.value })} placeholder="Institution" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50" />
                  </div>
                )}
                <button onClick={() => void handleJoin()} disabled={isJoining} className="w-full bg-lime-400 text-zinc-950 font-bold py-3 rounded-xl hover:bg-lime-300 transition-colors active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60">
                  {isJoining ? "Creating your account..." : "Complete my sign-up"} {!isJoining && <ArrowRight weight="bold" className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WomensHoursPage({ rules, trainers, onBack }: { rules: { id: string; startTime: string; endTime: string; days: string[]; description: string }[]; trainers: { id: string; name: string; specialties: string[]; bio?: string }[]; onBack: () => void }) {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white px-4 py-16 md:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <button onClick={onBack} className="text-sm text-zinc-400 hover:text-lime-400 transition-colors">← Back to member categories</button>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
          <div className="flex items-start gap-4">
            <MoonStars weight="fill" className="w-10 h-10 text-lime-400 shrink-0" />
            <div>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Women's Hours (Muslim)</h1>
              <p className="text-zinc-400 mt-3 max-w-2xl">A designated gym access option with dedicated hours and a welcoming training environment.</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Women's Hours</h2>
          <p className="text-sm text-zinc-400">Members selecting this existing category can use the access schedule configured by the gym.</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Schedule</h2>
          {rules.length === 0 ? <p className="text-sm text-zinc-500">No Women's Hours schedule is currently configured.</p> : (
            <div className="space-y-3">
              {rules.map(rule => <div key={rule.id} className="bg-zinc-800/50 rounded-xl p-4"><div className="flex flex-wrap justify-between gap-3 text-sm"><span className="font-semibold">{rule.days.join(", ")}</span><span className="text-lime-400 font-semibold">{rule.startTime} - {rule.endTime}</span></div>{rule.description && <p className="text-xs text-zinc-500 mt-2">{rule.description}</p>}</div>)}
            </div>
          )}
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Guidelines</h2>
          <p className="text-sm text-zinc-400">Please follow the configured access hours and gym rules during your session. Ask reception if you need help with access or membership details.</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Training team</h2>
          {trainers.length === 0 ? <p className="text-sm text-zinc-500">No active trainers are currently listed.</p> : <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{trainers.map(trainer => <div key={trainer.id} className="bg-zinc-800/50 rounded-xl p-4"><div className="font-semibold">{trainer.name}</div><div className="text-xs text-lime-400 mt-1">{trainer.specialties.join(" · ")}</div>{trainer.bio && <p className="text-xs text-zinc-500 mt-2">{trainer.bio}</p>}</div>)}</div>}
        </div>
      </div>
    </div>
  );
}