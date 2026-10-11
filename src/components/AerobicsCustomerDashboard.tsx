import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  MusicNotes,
  Clock,
  CalendarDots,
  Users,
  ChalkboardTeacher,
  CheckCircle,
  Warning,
  XCircle,
  Sparkle,
  Info,
} from "@phosphor-icons/react";
import type { AerobicsGroup, Member, Trainer } from "../types";

const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_ABBR: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

interface AerobicsCustomerDashboardProps {
  member: Member;
  group?: AerobicsGroup;
  trainer?: Trainer;
  occupancy?: {
    enrolledCount: number;
    capacity: number;
    availableSpots: number;
    occupancyPercentage: number;
  };
}

/** Parses time slot string into start & end minutes with full separator tolerance. */
function parseTimeSlot(slot?: string): { startMinutes: number; endMinutes: number } | null {
  if (!slot || typeof slot !== "string") return null;
  const match = slot.trim().match(/^(\d{1,2}:\d{2})\s*(?:[-–—~]|\bto\b)\s*(\d{1,2}:\d{2})$/i);
  if (!match) return null;
  const [h1, m1] = match[1].split(":").map(Number);
  const [h2, m2] = match[2].split(":").map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return null;
  if (h1 < 0 || h1 > 23 || m1 < 0 || m1 > 59 || h2 < 0 || h2 > 23 || m2 < 0 || m2 > 59) return null;
  const startMinutes = h1 * 60 + m1;
  const endMinutes = h2 * 60 + m2;
  if (startMinutes >= endMinutes) return null;
  return { startMinutes, endMinutes };
}

function getDayName(date: Date): string {
  return WEEK_DAYS[(date.getDay() + 6) % 7];
}

export default function AerobicsCustomerDashboard({
  member,
  group,
  trainer,
  occupancy,
}: AerobicsCustomerDashboardProps) {
  // Edge Case 1: Member has no aerobicsGroupId assigned
  if (!member.aerobicsGroupId) {
    return (
      <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
            <Warning weight="fill" className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">No Aerobics Group Assigned</h3>
            <p className="text-zinc-400 text-sm mt-1">
              You are registered as an Aerobics customer, but you have not been assigned to an Aerobics group yet.
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Please contact reception to select or confirm your group schedule.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Edge Case 2: aerobicsGroupId exists but group was not found
  if (!group) {
    return (
      <div className="bg-zinc-900 border border-red-500/30 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-400/10 border border-red-400/20 flex items-center justify-center shrink-0">
            <XCircle weight="fill" className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Aerobics Group Unavailable</h3>
            <p className="text-zinc-400 text-sm mt-1">
              Your assigned group could not be found. Please contact gym management.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Parse time slot safely
  const parsedSlot = parseTimeSlot(group.timeSlot);

  // Compute live class status & next session
  const { sessionStatus, nextSessionText } = useMemo(() => {
    const now = new Date();
    const currentDay = getDayName(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isTodayClassDay = group.days.includes("All days") || group.days.includes(currentDay);

    let statusType: "IN_PROGRESS" | "TODAY_UPCOMING" | "TODAY_COMPLETED" | "NO_CLASS_TODAY" | "INVALID" = "NO_CLASS_TODAY";
    let countdownDetail = "";

    if (!parsedSlot) {
      statusType = "INVALID";
    } else if (isTodayClassDay) {
      if (currentMinutes >= parsedSlot.startMinutes && currentMinutes < parsedSlot.endMinutes) {
        statusType = "IN_PROGRESS";
      } else if (currentMinutes < parsedSlot.startMinutes) {
        statusType = "TODAY_UPCOMING";
        const diff = parsedSlot.startMinutes - currentMinutes;
        const hrs = Math.floor(diff / 60);
        const mins = diff % 60;
        countdownDetail = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
      } else {
        statusType = "TODAY_COMPLETED";
      }
    } else {
      statusType = "NO_CLASS_TODAY";
    }

    // Next upcoming session calculation
    let nextText = "Schedule unavailable";
    if (parsedSlot) {
      if (statusType === "TODAY_UPCOMING") {
        nextText = `Today · ${group.timeSlot}`;
      } else {
        // Look 1 to 7 days ahead
        for (let i = 1; i <= 7; i++) {
          const futureDate = new Date(now.getTime() + i * 86400000);
          const futureDay = getDayName(futureDate);
          if (group.days.includes("All days") || group.days.includes(futureDay)) {
            nextText = `${futureDay} · ${group.timeSlot}`;
            break;
          }
        }
      }
    }

    return {
      sessionStatus: { type: statusType, countdownDetail },
      nextSessionText: nextText,
    };
  }, [group.days, group.timeSlot, parsedSlot]);

  // Dynamic Occupancy (uses live database occupancy if provided, otherwise fallback to mock memberIds)
  const enrolledCount = occupancy !== undefined ? occupancy.enrolledCount : (group.memberIds ? group.memberIds.length : 0);
  const capacity = occupancy !== undefined ? occupancy.capacity : Math.max(0, group.capacity || 0);
  const availableSpots = occupancy !== undefined ? occupancy.availableSpots : Math.max(0, capacity - enrolledCount);
  const occupancyPct = occupancy !== undefined ? occupancy.occupancyPercentage : (capacity > 0 ? Math.min(100, Math.round((enrolledCount / capacity) * 100)) : 0);

  const currentDayName = getDayName(new Date());

  return (
    <div className="space-y-6">
      {/* 1. Live Hero Session Status */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-5">
          <MusicNotes className="w-36 h-36 text-fuchsia-400" />
        </div>

        {sessionStatus.type === "IN_PROGRESS" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-lime-400/20 text-lime-400 border border-lime-400/30 mb-2">
                <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                CLASS IN PROGRESS
              </div>
              <h3 className="text-xl font-black text-white">{group.name}</h3>
              <p className="text-zinc-400 text-sm mt-0.5">
                {group.timeSlot} · Coach {group.trainerName}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs text-lime-400 font-semibold block">Active Session</span>
              <span className="text-sm text-zinc-400">Class floor open</span>
            </div>
          </div>
        )}

        {sessionStatus.type === "TODAY_UPCOMING" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-fuchsia-400/20 text-fuchsia-400 border border-fuchsia-400/30 mb-2">
                <Sparkle weight="fill" className="w-3.5 h-3.5" />
                TODAY'S CLASS
              </div>
              <h3 className="text-xl font-black text-white">{group.name}</h3>
              <p className="text-zinc-400 text-sm mt-0.5">
                Scheduled for {group.timeSlot} · Coach {group.trainerName}
              </p>
            </div>
            <div className="text-left sm:text-right bg-zinc-800/60 rounded-xl px-4 py-2 border border-zinc-700/50">
              <span className="text-xs text-zinc-400 block">Starts in</span>
              <span className="text-lg font-black text-lime-400">{sessionStatus.countdownDetail}</span>
            </div>
          </div>
        )}

        {(sessionStatus.type === "TODAY_COMPLETED" || sessionStatus.type === "NO_CLASS_TODAY") && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 mb-2">
                <CalendarDots className="w-3.5 h-3.5" />
                {sessionStatus.type === "TODAY_COMPLETED" ? "SESSION COMPLETED TODAY" : "NO CLASS TODAY"}
              </div>
              <h3 className="text-xl font-bold text-white">{group.name}</h3>
              <p className="text-zinc-400 text-sm mt-0.5">
                Scheduled days: {group.days.join(", ")}
              </p>
            </div>
            <div className="text-left sm:text-right bg-zinc-800/40 rounded-xl px-4 py-2 border border-zinc-800">
              <span className="text-xs text-zinc-500 block">Next session</span>
              <span className="text-sm font-bold text-lime-400">{nextSessionText}</span>
            </div>
          </div>
        )}

        {sessionStatus.type === "INVALID" && (
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-red-400/20 text-red-400 border border-red-400/30 mb-2">
              <Warning className="w-3.5 h-3.5" />
              Schedule unavailable
            </div>
            <h3 className="text-lg font-bold text-white">{group.name}</h3>
            <p className="text-zinc-400 text-sm mt-1">Please contact gym management.</p>
          </div>
        )}
      </motion.div>

      {/* 2. Group Details & Weekly Schedule Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My Aerobics Group Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base flex items-center gap-2 text-white">
                <MusicNotes weight="fill" className="w-5 h-5 text-fuchsia-400" />
                My Aerobics Group
              </h3>
              <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-fuchsia-400/15 text-fuchsia-400 border border-fuchsia-400/20">
                Aerobics &amp; Dance
              </span>
            </div>

            <div className="text-xl font-black text-white mb-1">{group.name}</div>
            <div className="text-sm text-zinc-400 flex items-center gap-1.5 mb-4">
              <Clock className="w-4 h-4 text-lime-400" />
              <span>{group.timeSlot}</span>
            </div>

            {/* Occupancy Progress */}
            <div className="space-y-2 mt-4 pt-4 border-t border-zinc-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Group Capacity &amp; Occupancy</span>
                <span className="font-bold text-white tabular-nums">
                  {enrolledCount} / {capacity} members
                </span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-lime-400 transition-all duration-500"
                  style={{ width: `${occupancyPct}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] text-zinc-500">
                <span>{occupancyPct}% full</span>
                <span className="text-lime-400 font-medium">{availableSpots} spots available</span>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Schedule Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base flex items-center gap-2 text-white">
                <CalendarDots weight="fill" className="w-5 h-5 text-lime-400" />
                Weekly Schedule
              </h3>
              <span className="text-xs text-zinc-400 font-mono tabular-nums">{group.timeSlot}</span>
            </div>

            <p className="text-xs text-zinc-400 mb-4">
              Class meets on scheduled days. Your attendance and check-in window are aligned with this slot:
            </p>

            {/* 7-Day Visual Chips */}
            <div className="grid grid-cols-7 gap-1.5 text-center my-3">
              {WEEK_DAYS.map(dayName => {
                const isScheduled = group.days.includes("All days") || group.days.includes(dayName);
                const isToday = dayName === currentDayName;
                return (
                  <div
                    key={dayName}
                    className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
                      isScheduled
                        ? isToday
                          ? "bg-lime-400 text-zinc-950 font-black shadow-lg shadow-lime-400/20"
                          : "bg-fuchsia-400/15 text-fuchsia-300 border border-fuchsia-400/30 font-bold"
                        : isToday
                        ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                        : "bg-zinc-850/50 text-zinc-600 border border-zinc-800/60"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold tracking-tight">
                      {DAY_ABBR[dayName] || dayName.slice(0, 3)}
                    </span>
                    <span className="text-[12px] mt-0.5">
                      {isScheduled ? "●" : "·"}
                    </span>
                    {isToday && (
                      <span className={`text-[8px] uppercase tracking-tighter font-extrabold ${isScheduled ? "text-zinc-950" : "text-zinc-400"}`}>
                        Today
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-center text-xs">
            <span className="text-zinc-500">Upcoming class</span>
            <span className="font-semibold text-lime-400">{nextSessionText}</span>
          </div>
        </div>
      </div>

      {/* 3. Instructor Card & Class Guidelines */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Trainer Card */}
        <div className="md:col-span-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ChalkboardTeacher className="w-4 h-4 text-lime-400" />
            Class Instructor
          </h3>
          <div className="font-bold text-lg text-white">
            {trainer?.name || group.trainerName}
          </div>

          {trainer?.specialties && trainer.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {trainer.specialties.map(spec => (
                <span
                  key={spec}
                  className="bg-lime-400/10 text-lime-400 border border-lime-400/20 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                >
                  {spec}
                </span>
              ))}
            </div>
          )}

          {trainer?.bio && (
            <p className="text-xs text-zinc-400 mt-3 leading-relaxed border-t border-zinc-800 pt-3">
              {trainer.bio}
            </p>
          )}

          {trainer?.weeklyHours !== undefined && (
            <div className="text-[11px] text-zinc-500 mt-3">
              {trainer.weeklyHours} hours/week club coaching
            </div>
          )}
        </div>

        {/* Class Information & Guidelines */}
        <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-lime-400" />
              Class Information &amp; Schedule Policy
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Your assigned Aerobics group schedule determines your scheduled class access.
              Check-in at reception is authorized during your group&apos;s scheduled days and session window.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-400">
              <div className="bg-zinc-800/40 border border-zinc-800 rounded-xl p-3 flex items-start gap-2.5">
                <CheckCircle weight="fill" className="w-4 h-4 text-lime-400 mt-0.5 shrink-0" />
                <span>Access is authoritative for <strong>{group.name}</strong> on scheduled days ({group.days.join(", ")}).</span>
              </div>
              <div className="bg-zinc-800/40 border border-zinc-800 rounded-xl p-3 flex items-start gap-2.5">
                <CheckCircle weight="fill" className="w-4 h-4 text-lime-400 mt-0.5 shrink-0" />
                <span>Changing rooms and shower facilities available before and after class.</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-4 pt-3 border-t border-zinc-800">
            Need to change your aerobics group? Visit reception to switch between available schedule slots.
          </p>
        </div>
      </div>
    </div>
  );
}
