import { useState, useEffect, useCallback } from "react";
import {
  User,
  IdentificationBadge,
  Phone,
  Envelope,
  Calendar,
  MapPin,
  Lock,
  CheckCircle,
  XCircle,
  ArrowClockwise,
  FloppyDisk,
  Info,
  ShieldCheck,
  GenderIntersex,
} from "@phosphor-icons/react";
import {
  fetchAerobicsProfile,
  updateAerobicsProfile,
  type AerobicsCustomerProfile,
  type AerobicsProfileState,
  type UpdateProfilePayload,
} from "../services/aerobicsProfileService";
import { toast } from "sonner";

const CARD = "bg-zinc-900 border border-zinc-800 rounded-2xl p-6";
const INPUT = "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50 text-sm";
const READONLY_FIELD = "w-full bg-zinc-800/40 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-300 text-sm flex items-center justify-between";

interface AerobicsProfileViewProps {
  customerId: string;
  onProfileUpdated?: () => void;
}

export default function AerobicsProfileView({ customerId, onProfileUpdated }: AerobicsProfileViewProps) {
  const [state, setState] = useState<AerobicsProfileState>({ status: "loading" });

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");

  // Action states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  const loadProfile = useCallback(() => {
    setState({ status: "loading" });
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    fetchAerobicsProfile(customerId)
      .then(res => {
        setState(res);
        if (res.status === "success") {
          const p = res.data;
          setFirstName(p.firstName || "");
          setLastName(p.lastName || "");
          setPhone(p.phone || "");
          setDateOfBirth(p.dateOfBirth || "");
          setGender(p.gender || "");
          setAddress(p.address || "");
        }
      })
      .catch(err => {
        console.error("[AerobicsProfileView] Error loading profile:", err);
        setState({
          status: "error",
          error: "Failed to connect to the database. Please check your internet connection.",
        });
      });
  }, [customerId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    if (!firstName.trim()) {
      setSaveErrorMsg("First name is required.");
      return;
    }

    if (!lastName.trim()) {
      setSaveErrorMsg("Last name is required.");
      return;
    }

    if (!phone.trim()) {
      setSaveErrorMsg("Phone number is required.");
      return;
    }

    setIsSaving(true);

    const payload: UpdateProfilePayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      address: address.trim() || null,
    };

    const result = await updateAerobicsProfile(customerId, payload);
    setIsSaving(false);

    if (!result.success) {
      setSaveErrorMsg(result.error || "Failed to update profile. Please try again.");
      toast.error(result.error || "Profile update failed");
      return;
    }

    // Update local state with the returned fresh profile from Supabase
    if (result.data) {
      const p = result.data;
      setFirstName(p.firstName || "");
      setLastName(p.lastName || "");
      setPhone(p.phone || "");
      setDateOfBirth(p.dateOfBirth || "");
      setGender(p.gender || "");
      setAddress(p.address || "");
      setState({ status: "success", data: p });
    }

    setSaveSuccessMsg("Your profile has been saved successfully in Supabase!");
    toast.success("Profile updated successfully");
    onProfileUpdated?.();
  };

  // 1. Loading State
  if (state.status === "loading") {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-10 h-10 border-4 border-lime-400/20 border-t-lime-400 rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-base font-bold text-white">Loading Profile...</h3>
        <p className="text-xs text-zinc-500 mt-1">Retrieving customer records from Supabase</p>
      </div>
    );
  }

  // 2. Error State
  if (state.status === "error") {
    return (
      <div className="max-w-lg mx-auto">
        <div className={`${CARD} text-center space-y-4`}>
          <div className="w-12 h-12 rounded-full bg-red-400/10 border border-red-400/20 flex items-center justify-center mx-auto">
            <XCircle weight="fill" className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Unable to Load Profile</h3>
          <p className="text-sm text-zinc-400">{state.error}</p>
          <button
            onClick={loadProfile}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors inline-flex items-center gap-2 mx-auto"
          >
            <ArrowClockwise weight="bold" className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // 3. Customer Not Found State
  if (state.status === "not_found") {
    return (
      <div className="max-w-lg mx-auto">
        <div className={`${CARD} text-center space-y-3`}>
          <User className="w-12 h-12 text-zinc-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">Customer Not Found</h3>
          <p className="text-sm text-zinc-500">{state.message}</p>
        </div>
      </div>
    );
  }

  const profile = state.data;
  const formattedJoinDate = profile.joinDate
    ? new Date(profile.joinDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* SECTION A: Membership / Account Information (Strictly READ-ONLY) */}
      <div className={`${CARD} space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IdentificationBadge className="w-5 h-5 text-lime-400" />
            <h3 className="font-bold text-lg text-white">Membership Information</h3>
          </div>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 flex items-center gap-1">
            <Lock weight="bold" className="w-3 h-3 text-zinc-500" />
            Read-Only
          </span>
        </div>

        <p className="text-xs text-zinc-400">
          Official account credentials managed by PowerPlus Gym administration.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <span className="text-xs text-zinc-500 block mb-1">Member ID</span>
            <div className={READONLY_FIELD}>
              <span className="font-bold text-white">{profile.customerCode}</span>
              <Lock weight="bold" className="w-3.5 h-3.5 text-zinc-600" />
            </div>
          </div>

          <div>
            <span className="text-xs text-zinc-500 block mb-1">Customer Category</span>
            <div className={READONLY_FIELD}>
              <span className="font-bold text-lime-400">{profile.customerType}</span>
              <Lock weight="bold" className="w-3.5 h-3.5 text-zinc-600" />
            </div>
          </div>

          <div>
            <span className="text-xs text-zinc-500 block mb-1">Account Status</span>
            <div className={READONLY_FIELD}>
              <span className="font-semibold text-lime-400 uppercase text-xs tracking-wider">
                {profile.status}
              </span>
              <ShieldCheck weight="fill" className="w-4 h-4 text-lime-400" />
            </div>
          </div>

          <div>
            <span className="text-xs text-zinc-500 block mb-1">Joined Date</span>
            <div className={READONLY_FIELD}>
              <span className="font-medium text-zinc-200 text-xs">{formattedJoinDate}</span>
              <Calendar className="w-3.5 h-3.5 text-zinc-600" />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION B: Personal Information (EDITABLE) */}
      <form onSubmit={handleSave} className={`${CARD} space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-lime-400" />
            <h3 className="font-bold text-lg text-white">Personal Information</h3>
          </div>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-lime-400/10 text-lime-300 border border-lime-400/30">
            Editable
          </span>
        </div>

        <p className="text-xs text-zinc-400">
          Update your contact details and personal information below.
        </p>

        {/* First & Last Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5 font-medium">
              First Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="First name"
              required
              className={INPUT}
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1.5 font-medium">
              Last Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Last name"
              required
              className={INPUT}
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="text-xs text-zinc-400 block mb-1.5 font-medium">
            Phone Number <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 0988990011"
              required
              className={INPUT}
            />
            <Phone className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3.5" />
          </div>
        </div>

        {/* Date of Birth & Gender */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5 font-medium">
              Date of Birth
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={e => setDateOfBirth(e.target.value)}
              className={INPUT}
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1.5 font-medium">
              Gender
            </label>
            <select
              value={gender}
              onChange={e => setGender(e.target.value)}
              className={INPUT}
            >
              <option value="">Select Gender</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="text-xs text-zinc-400 block mb-1.5 font-medium">
            Address / Residence
          </label>
          <textarea
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Street or neighborhood address"
            rows={2}
            className={`${INPUT} resize-none`}
          />
        </div>

        {/* SECTION C: Email & Authentication (READ-ONLY) */}
        <div className="pt-2 border-t border-zinc-800 space-y-2">
          <label className="text-xs text-zinc-400 block font-medium">
            Registered Email
          </label>
          <div className={READONLY_FIELD}>
            <span className="text-zinc-300 font-mono text-xs">
              {profile.email || "No email registered"}
            </span>
            <Lock weight="bold" className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
          </div>
          <p className="text-[11px] text-zinc-500 flex items-start gap-1.5 leading-relaxed pt-0.5">
            <Info weight="fill" className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
            Email and login credentials will be managed through Supabase Auth authentication.
          </p>
        </div>

        {/* Feedback Banners */}
        {saveSuccessMsg && (
          <div className="bg-lime-400/10 border border-lime-400/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-lime-300">
            <CheckCircle weight="fill" className="w-4 h-4 text-lime-400 shrink-0 mt-0.5" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {saveErrorMsg && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-300">
            <XCircle weight="fill" className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{saveErrorMsg}</span>
          </div>
        )}

        {/* Submit / Save Button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-lime-400 text-zinc-950 font-bold py-3.5 rounded-xl hover:bg-lime-300 transition-colors disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 text-sm shadow-lg shadow-lime-400/10"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
              Saving to Supabase...
            </>
          ) : (
            <>
              <FloppyDisk weight="bold" className="w-4 h-4" />
              Save Profile
            </>
          )}
        </button>
      </form>
    </div>
  );
}
