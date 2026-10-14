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
  fetchRegularProfile,
  updateRegularProfile,
  type RegularCustomerProfile,
  type RegularProfileState,
  type UpdateProfilePayload,
} from "../services/regularProfileService";
import { toast } from "sonner";

const CARD = "bg-zinc-900 border border-zinc-800 rounded-2xl p-6";
const INPUT = "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-400/50 text-sm";
const READONLY_FIELD = "w-full bg-zinc-800/40 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-300 text-sm flex items-center justify-between";

interface RegularProfileViewProps {
  customerId: string;
  onProfileUpdated?: () => void;
}

export default function RegularProfileView({ customerId, onProfileUpdated }: RegularProfileViewProps) {
  const [state, setState] = useState<RegularProfileState>({ status: "loading" });

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

    fetchRegularProfile(customerId)
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
        console.error("[RegularProfileView] Error loading profile:", err);
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

    const result = await updateRegularProfile(customerId, payload);
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
          <h3 className="text-lg font-bold text-white">Profile Not Found</h3>
          <p className="text-sm text-zinc-500">{state.message}</p>
        </div>
      </div>
    );
  }

  // 4. Success State
  const profile = state.data;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Read-Only Account & Membership Identity Overview */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-lime-400/10 border border-lime-400/20 flex items-center justify-center text-lime-400">
              <ShieldCheck weight="fill" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Account Details</h3>
              <p className="text-xs text-zinc-400">Managed gym membership credentials</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-lime-400/15 text-lime-400 border border-lime-400/25">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
            {profile.status}
          </span>
        </div>

        <div className="space-y-3 pt-2">
          {/* Customer Code */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
              Customer Code
            </label>
            <div className={READONLY_FIELD}>
              <span className="font-mono font-bold text-white flex items-center gap-2">
                <IdentificationBadge weight="fill" className="w-4 h-4 text-lime-400" />
                {profile.customerCode}
              </span>
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Assigned ID
              </span>
            </div>
          </div>

          {/* Membership Category */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
              Customer Category
            </label>
            <div className={READONLY_FIELD}>
              <span className="font-semibold text-white capitalize">
                {profile.customerType.toLowerCase()}
              </span>
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Fixed Category
              </span>
            </div>
          </div>

          {/* Registration Date */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
              Member Since
            </label>
            <div className={READONLY_FIELD}>
              <span className="font-medium text-white flex items-center gap-2">
                <Calendar weight="fill" className="w-4 h-4 text-zinc-400" />
                {profile.joinDate}
              </span>
              <span className="text-[11px] text-zinc-500">Club joined date</span>
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
              Email Address
            </label>
            <div className={READONLY_FIELD}>
              <span className="font-medium text-white flex items-center gap-2 truncate">
                <Envelope weight="fill" className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="truncate">{profile.email || "Not specified"}</span>
              </span>
              <span className="text-[11px] text-zinc-500 shrink-0">Account login</span>
            </div>
          </div>
        </div>
      </div>

      {/* Editable Personal Information Form */}
      <div className={CARD}>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-10 h-10 rounded-xl bg-lime-400/10 border border-lime-400/20 flex items-center justify-center text-lime-400">
            <User weight="fill" className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Personal Information</h3>
            <p className="text-xs text-zinc-400">Editable contact and profile records in Supabase</p>
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="mt-4 p-3.5 rounded-xl bg-lime-400/10 border border-lime-400/25 flex items-center gap-3 text-sm text-lime-300">
            <CheckCircle weight="fill" className="w-5 h-5 text-lime-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {saveErrorMsg && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-400/10 border border-red-400/25 flex items-center gap-3 text-sm text-red-300">
            <XCircle weight="fill" className="w-5 h-5 text-red-400 shrink-0" />
            <span>{saveErrorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 mt-5">
          {/* First & Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                First Name <span className="text-lime-400">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="e.g. Hana"
                className={INPUT}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Last Name <span className="text-lime-400">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="e.g. Girma"
                className={INPUT}
                required
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
              <Phone weight="fill" className="w-3.5 h-3.5 text-lime-400" />
              Phone Number <span className="text-lime-400">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 0944556677"
              className={INPUT}
              required
            />
            <span className="text-[11px] text-zinc-500 mt-1 block">
              Used for account recovery and gym access verification.
            </span>
          </div>

          {/* Date of Birth & Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
                <Calendar weight="fill" className="w-3.5 h-3.5 text-zinc-400" />
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
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
                <GenderIntersex weight="bold" className="w-3.5 h-3.5 text-zinc-400" />
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
              </select>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
              <MapPin weight="fill" className="w-3.5 h-3.5 text-zinc-400" />
              Residential Address
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. Bole Sub City, Woreda 03"
              className={INPUT}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-lime-400/10 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>Saving to Supabase...</span>
                </>
              ) : (
                <>
                  <FloppyDisk weight="bold" className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-start gap-3 text-xs text-zinc-400">
        <Info weight="fill" className="w-4 h-4 text-lime-400 shrink-0 mt-0.5" />
        <p>
          Need to change your assigned gym category or membership plan? Contact the club reception desk or management staff.
        </p>
      </div>
    </div>
  );
}
