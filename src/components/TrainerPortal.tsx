import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChalkboardTeacher, CalendarDots, Users, Clock, MapPin, Lightning, CheckCircle, Circle, X, NotePencil, Phone, Envelope, IdentificationBadge, TrendUp, ClipboardText } from "@phosphor-icons/react";
import { useGym, generateId, addAudit } from "../context/GymContext";
import type { GymClass, TrainerClientNote } from "../types";
import { toast } from "sonner";

type Tab = "schedule" | "trainees" | "profile";
type Range = "today" | "all";

const CATEGORY_STYLES: Record<string, string> = {
  HIIT: "bg-red-400/10 text-red-400 border-red-400/20",
  Strength: "bg-lime-400/10 text-lime-400 border-lime-400/20",
  Yoga: "bg-purple-400/10 text-purple-400 border-purple-400/20",
  Cardio: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  Boxing: "bg-orange-400/10 text-orange-400 border-orange-400/20",
  Spin: "bg-cyan-400/10 text-cyan-400 border-cyan-400/20",
};

export default function TrainerPortal() {
  const { state } = useGym();
  const [tab, setTab] = useState<Tab>("schedule");
  const [range, setRange] = useState<Range>("all");
  const [rosterClass, setRosterClass] = useState<GymClass | null>(null);

  const trainer = state.trainers.find(t => t.id === state.currentUser?.trainerId);

  const todayName = useMemo(() => new Date().toLocaleDateString("en-US", { weekday: "long" }), []);

  const myClasses = useMemo(() => {
    if (!trainer) return [];
    const list = state.classes.filter(c => c.trainerId === trainer.id);
    return range === "today" ? list.filter(c => c.dayOfWeek === todayName) : list;
  }, [trainer, state.classes, range, todayName]);

  const enrolledFor = (classId: string) => state.classAttendees.filter(a => a.classId === classId);
  const presentFor = (classId: string) => enrolledFor(classId).filter(a => a.attended).length;

  if (!trainer) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <ChalkboardTeacher className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No Trainer Profile</h2>
          <p className="text-zinc-500">Please log in as a trainer to access this portal.</p>
        </div>
      </div>
    );
  }

  const totalClasses = state.classes.filter(c => c.trainerId === trainer.id).length;
  const totalRoster = new Set(state.classAttendees.filter(a => state.classes.some(c => c.id === a.classId && c.trainerId === trainer.id)).map(a => a.memberId)).size;

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <ChalkboardTeacher weight="fill" className="w-6 h-6 text-lime-400" />
          <h1 className="text-2xl font-black uppercase tracking-tight">Trainer Portal</h1>
        </div>
        <p className="text-zinc-500 text-sm mb-8">Welcome back, {trainer.name}. Manage your classes, trainees and schedule.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "My Classes", value: String(totalClasses), icon: CalendarDots },
            { label: "Active Trainees", value: String(trainer.clientIds.length), icon: Users },
            { label: "Weekly Hours", value: String(trainer.weeklyHours), icon: Clock },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="bg-lime-400/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                <s.icon weight="fill" className="w-5 h-5 text-lime-400" />
              </div>
              <div className="text-2xl font-black">{s.value}</div>
              <div className="text-sm text-zinc-500">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {(["schedule", "trainees", "profile"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${tab === t ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>{t === "schedule" ? "My Schedule" : t === "trainees" ? "My Trainees" : "My Profile"}</button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {tab === "schedule" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {(["today", "all"] as const).map(r => (
                    <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${range === r ? "bg-lime-400/20 text-lime-400 border border-lime-400/30" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800"}`}>{r === "today" ? "Today" : "This Week"}</button>
                  ))}
                </div>
                {myClasses.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                    <CalendarDots className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                    <p className="text-zinc-500">No classes scheduled {range === "today" ? "for today" : "this week"}.</p>
                  </div>
                ) : myClasses.map((c, i) => {
                  const enrolled = enrolledFor(c.id).length;
                  const present = presentFor(c.id);
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-bold text-lg">{c.title}</h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${CATEGORY_STYLES[c.category] || "bg-zinc-800 text-zinc-300 border-zinc-700"}`}>{c.category}</span>
                          </div>
                          <p className="text-zinc-500 text-sm mb-3">{c.description}</p>
                          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-zinc-400">
                            <span className="flex items-center gap-1.5"><CalendarDots className="w-4 h-4 text-lime-400" />{c.dayOfWeek}</span>
                            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-lime-400" />{c.time}</span>
                            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-lime-400" />{c.room}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-start md:items-end gap-2">
                          <div className="text-sm text-zinc-400"><span className="font-bold text-white">{enrolled}</span> / {c.capacity} enrolled</div>
                          <div className="w-32 bg-zinc-800 rounded-full h-2 overflow-hidden"><div className="h-full bg-lime-400 rounded-full transition-all" style={{ width: `${Math.min(100, (enrolled / c.capacity) * 100)}%` }} /></div>
                          <div className="text-xs text-lime-400 font-semibold">{present} present today</div>
                          <button onClick={() => setRosterClass(c)} className="mt-1 bg-lime-400 text-zinc-950 px-4 py-2 rounded-xl font-bold text-sm hover:bg-lime-300 transition-colors active:scale-[0.97]">Take Attendance</button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {tab === "trainees" && <TraineesView trainerId={trainer.id} totalRoster={totalRoster} />}
            {tab === "profile" && <ProfileView trainer={trainer} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {rosterClass && <RosterDrawer gymClass={rosterClass} onClose={() => setRosterClass(null)} />}
      </AnimatePresence>
    </div>
  );
}

function RosterDrawer({ gymClass, onClose }: { gymClass: GymClass; onClose: () => void }) {
  const { state, dispatch } = useGym();
  const attendees = state.classAttendees.filter(a => a.classId === gymClass.id);

  const toggle = (memberId: string, name: string, wasAttended: boolean) => {
    dispatch({ type: "TOGGLE_ATTENDANCE", payload: { classId: gymClass.id, memberId } });
    addAudit(dispatch, "Attendance Updated", gymClass.trainerName, `${name} marked ${wasAttended ? "absent" : "present"} for ${gymClass.title}`);
    toast.success(`${name} marked ${wasAttended ? "absent" : "present"}`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-zinc-900 border-l border-zinc-800 p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2"><ClipboardText className="w-5 h-5 text-lime-400" /> Attendance</h3>
            <p className="text-sm text-zinc-500 mt-1">{gymClass.title} · {gymClass.dayOfWeek} {gymClass.time}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"><X className="w-5 h-5 text-zinc-400" /></button>
        </div>
        {attendees.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500">No members enrolled in this class yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-zinc-400">{attendees.filter(a => a.attended).length} / {attendees.length} present</span>
              <span className="text-xs text-lime-400 font-semibold">{Math.round((attendees.filter(a => a.attended).length / attendees.length) * 100)}%</span>
            </div>
            {attendees.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3 hover:border-zinc-600 transition-colors">
                <div>
                  <div className="font-semibold text-sm">{a.memberName}</div>
                  <div className="text-xs text-zinc-500">{a.memberPhone}</div>
                </div>
                <button onClick={() => toggle(a.memberId, a.memberName, a.attended)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${a.attended ? "bg-lime-400/20 text-lime-400 hover:bg-lime-400/30" : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"}`}>
                  {a.attended ? <CheckCircle weight="fill" className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  {a.attended ? "Present" : "Absent"}
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function TraineesView({ trainerId, totalRoster }: { trainerId: string; totalRoster: number }) {
  const { state, dispatch } = useGym();
  const trainer = state.trainers.find(t => t.id === trainerId);
  const [selected, setSelected] = useState<string | null>(trainer?.clientIds[0] ?? null);
  const [focus, setFocus] = useState("");
  const [notes, setNotes] = useState("");

  if (!trainer) return null;

  const clients = state.members.filter(m => trainer.clientIds.includes(m.id));
  const clientNotes = state.trainerNotes.filter(n => n.trainerId === trainerId && n.memberId === selected);

  const addNote = () => {
    if (!selected || !focus.trim() || !notes.trim()) { toast.error("Add a workout focus and note"); return; }
    const note: TrainerClientNote = { id: generateId("n"), trainerId, memberId: selected, date: new Date().toISOString().split("T")[0], workoutFocus: focus.trim(), notes: notes.trim() };
    dispatch({ type: "ADD_TRAINER_NOTE", payload: note });
    addAudit(dispatch, "Trainer Note Added", trainer.name, `Logged session for ${state.members.find(m => m.id === selected)?.name}`);
    toast.success("Session note saved");
    setFocus(""); setNotes("");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-2">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Users className="w-5 h-5 text-lime-400" /> Assigned Trainees <span className="text-xs text-zinc-500 font-normal">({totalRoster} in classes)</span></h3>
        {clients.map(c => (
          <button key={c.id} onClick={() => setSelected(c.id)} className={`w-full text-left rounded-xl p-3 border transition-colors ${selected === c.id ? "bg-lime-400/10 border-lime-400/40" : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"}`}>
            <div className="font-semibold text-sm">{c.name}</div>
            <div className="text-xs text-zinc-500">{c.memberId} · {c.phone}</div>
          </button>
        ))}
        {clients.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <Users className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">No personal-training clients assigned.</p>
          </div>
        )}
      </div>

      <div className="md:col-span-2 space-y-4">
        {selected && (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              {(() => {
                const m = state.members.find(mm => mm.id === selected);
                if (!m) return null;
                return (
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-lime-400/10 rounded-full flex items-center justify-center"><Users className="w-5 h-5 text-lime-400" /></div>
                      <div>
                        <div className="font-bold text-lg">{m.name}</div>
                        <div className="text-sm text-zinc-500">{m.memberId} · member since {m.joinDate}</div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="flex items-center gap-1.5 text-zinc-400"><Phone className="w-4 h-4 text-lime-400" />{m.phone}</div>
                      <div className="flex items-center gap-1.5 text-zinc-400"><Envelope className="w-4 h-4 text-lime-400" />{m.email}</div>
                    </div>
                  </div>
                );
              })()}
              {(() => {
                const m = state.members.find(mm => mm.id === selected);
                return m?.medicalNotes && m.medicalNotes !== "None" ? (
                  <div className="mt-3 bg-red-400/10 border border-red-400/20 text-red-300 rounded-xl px-3 py-2 text-xs flex items-center gap-2"><TrendUp className="w-4 h-4 shrink-0" /> Medical note: {m.medicalNotes}</div>
                ) : null;
              })()}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <h4 className="font-bold flex items-center gap-2"><NotePencil className="w-5 h-5 text-lime-400" /> Log Session Note</h4>
              <input value={focus} onChange={e => setFocus(e.target.value)} placeholder="Workout focus (e.g. Squat form, conditioning)" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50 focus:ring-1 focus:ring-lime-400/30 transition-colors" />
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Coach notes, progress, next steps..." rows={3} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50 focus:ring-1 focus:ring-lime-400/30 resize-none transition-colors" />
              <button onClick={addNote} className="bg-lime-400 text-zinc-950 font-bold py-2.5 px-5 rounded-xl hover:bg-lime-300 transition-colors active:scale-[0.98]">Save Note</button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h4 className="font-bold mb-3 flex items-center gap-2"><Lightning className="w-5 h-5 text-lime-400" /> Session History</h4>
              {clientNotes.length === 0 ? (
                <div className="text-center py-4">
                  <NotePencil className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">No notes logged for this trainee yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clientNotes.map(n => (
                    <div key={n.id} className="border-l-2 border-lime-400/40 pl-3">
                      <div className="flex justify-between text-sm"><span className="font-semibold">{n.workoutFocus}</span><span className="text-zinc-500 text-xs">{n.date}</span></div>
                      <p className="text-sm text-zinc-400 mt-0.5">{n.notes}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProfileView({ trainer }: { trainer: { id: string; name: string; email: string; phone: string; specialties: string[]; bio?: string; active: boolean; weeklyHours: number } }) {
  const { state } = useGym();
  const classes = state.classes.filter(c => c.trainerId === trainer.id);
  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-lime-400/10 rounded-full flex items-center justify-center"><ChalkboardTeacher weight="fill" className="w-8 h-8 text-lime-400" /></div>
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">{trainer.name} {trainer.active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime-400/20 text-lime-400 font-bold">ACTIVE</span>}</h3>
            <p className="text-zinc-500 text-sm">{trainer.bio || "Personal trainer at Power Plus Gym."}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-zinc-400"><Envelope className="w-4 h-4 text-lime-400" />{trainer.email}</div>
          <div className="flex items-center gap-2 text-zinc-400"><Phone className="w-4 h-4 text-lime-400" />{trainer.phone}</div>
          <div className="flex items-center gap-2 text-zinc-400"><IdentificationBadge className="w-4 h-4 text-lime-400" />Trainer ID: {trainer.id.toUpperCase()}</div>
          <div className="flex items-center gap-2 text-zinc-400"><Clock className="w-4 h-4 text-lime-400" />{trainer.weeklyHours} hrs / week</div>
        </div>
        <div className="mt-4">
          <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Specialties</div>
          <div className="flex flex-wrap gap-2">
            {trainer.specialties.map(s => <span key={s} className={`text-xs px-3 py-1.5 rounded-full border font-semibold ${CATEGORY_STYLES[s] || "bg-zinc-800 text-zinc-300 border-zinc-700"}`}>{s}</span>)}
          </div>
        </div>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h4 className="font-bold mb-3">Weekly Teaching Load</h4>
        <div className="space-y-2">
          {classes.map(c => (
            <div key={c.id} className="flex justify-between items-center py-2 border-b border-zinc-800/50 text-sm last:border-b-0">
              <span className="flex items-center gap-2"><span className="w-2 h-2 bg-lime-400 rounded-full" />{c.title}</span>
              <span className="text-zinc-500">{c.dayOfWeek} · {c.time}</span>
            </div>
          ))}
          {classes.length === 0 && (
            <div className="text-center py-4">
              <CalendarDots className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">No classes assigned.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
