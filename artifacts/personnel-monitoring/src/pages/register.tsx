import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCreatePersonnel } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { UploadCloud, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { motion } from "framer-motion";
import { OFFICES } from "@/contexts/department-context";

const registerSchema = z.object({
  lastName: z.string().min(1, "Last name is required"),
  firstName: z.string().min(1, "First name is required"),
  middleInitial: z.string().max(1, "Max 1 character").optional(),
  employeeId: z.string().min(1, "Employee ID is required"),
  department: z.string().min(1, "Department is required"),
  position: z.string().min(1, "Position is required"),
  vehiclePlate: z.string().optional(),
  createAccount: z.boolean().default(false),
  password: z.string().optional(),
  terms: z.boolean().refine(val => val === true, "You must agree to the terms")
}).refine(data => {
  if (data.createAccount && (!data.password || data.password.length < 6)) return false;
  return true;
}, {
  message: "Password is required and must be at least 6 characters if creating an account",
  path: ["password"]
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const [success, setSuccess] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createPersonnelMutation = useCreatePersonnel();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { createAccount: false, terms: false }
  });

  const watchCreateAccount = watch("createAccount");

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Photo must be under 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoPreview(ev.target?.result as string);
      setPhotoError(false);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = (data: RegisterFormValues) => {
    if (!photoPreview) {
      setPhotoError(true);
      return;
    }
    setServerError(null);
    setPhotoError(false);
    createPersonnelMutation.mutate({
      data: {
        lastName: data.lastName,
        firstName: data.firstName,
        middleInitial: data.middleInitial,
        employeeId: data.employeeId,
        department: data.department,
        position: data.position,
        vehiclePlate: data.vehiclePlate,
        photoUrl: photoPreview ?? undefined,
        createAccount: data.createAccount,
        password: data.createAccount ? data.password : undefined,
      }
    }, {
      onSuccess: () => { setSuccess(true); setTimeout(() => setLocation("/dashboard"), 2000); },
      onError: (err: any) => {
        const msg = err?.data?.error || err?.message || "Failed to create personnel.";
        setServerError(msg);
      }
    });
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Register Personnel</h2>
          <p className="text-gray-500 mt-2">Add a new staff member to the monitoring system.</p>
        </div>

        {success ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-green-50 border-2 border-green-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-lg"
          >
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="text-2xl font-bold text-green-800">Registration Successful!</h3>
            <p className="text-green-600 mt-2">The personnel record has been created. Redirecting to dashboard...</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Left Column - Photo Upload */}
            <div className="lg:col-span-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Facial Photo <span className="text-red-500">*</span></p>
                {photoError && (
                  <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" /> Required
                  </span>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`bg-white rounded-2xl border-dashed border-2 shadow-sm flex flex-col items-center justify-center h-72 hover:bg-gray-50 transition-colors cursor-pointer group overflow-hidden ${photoError ? "border-red-400 bg-red-50/30" : "border-gray-200 hover:border-primary/50"}`}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${photoError ? "bg-red-100" : "bg-gray-100"}`}>
                      <UploadCloud className={`w-9 h-9 transition-colors ${photoError ? "text-red-400" : "text-gray-400 group-hover:text-primary"}`} />
                    </div>
                    <p className="font-semibold text-gray-700">Upload Facial Photo</p>
                    <p className="text-xs text-gray-400 mt-2 text-center px-4">Click to select. Max 2MB.</p>
                  </>
                )}
              </div>
              {photoPreview && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPhotoPreview(null); }}
                  className="text-xs text-red-500 hover:text-red-700 underline text-center"
                >
                  Remove photo
                </button>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-700 space-y-1">
                    <p className="font-semibold">Photo Requirements</p>
                    <ul className="space-y-0.5 text-amber-600">
                      <li>• Clear, front-facing face</li>
                      <li>• Single person only</li>
                      <li>• Good lighting, no sunglasses</li>
                      <li>• Face clearly visible and unobstructed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Form Fields */}
            <div className="lg:col-span-8 bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
              {serverError && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200 font-medium">
                  {serverError}
                </div>
              )}

              <div className="space-y-8">
                {/* Name */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Personnel Name</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Input placeholder="Last Name" {...register("lastName")} />
                      {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
                    </div>
                    <div>
                      <Input placeholder="First Name" {...register("firstName")} />
                      {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
                    </div>
                    <div>
                      <Input placeholder="M.I." maxLength={1} {...register("middleInitial")} />
                    </div>
                  </div>
                </div>

                {/* Information */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Input placeholder="Employee ID" {...register("employeeId")} />
                      {errors.employeeId && <p className="text-red-500 text-xs mt-1">{errors.employeeId.message}</p>}
                    </div>
                    <div>
                      <select
                        {...register("department")}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="">Select Department / Sub-unit</option>
                        {OFFICES.map(office => (
                          <optgroup key={office.slug} label={`${office.code} — ${office.name}`}>
                            {office.units.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {errors.department && <p className="text-red-500 text-xs mt-1">{errors.department.message}</p>}
                    </div>
                    <div>
                      <Input placeholder="Position" {...register("position")} />
                      {errors.position && <p className="text-red-500 text-xs mt-1">{errors.position.message}</p>}
                    </div>
                    <div>
                      <Input placeholder="Vehicle Plate # (Optional)" {...register("vehiclePlate")} />
                    </div>
                  </div>
                </div>

                {/* Account Settings */}
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="mt-1 relative flex items-center justify-center">
                      <input type="checkbox" className="peer sr-only" {...register("createAccount")} />
                      <div className="w-5 h-5 border-2 border-gray-300 rounded bg-white peer-checked:bg-primary peer-checked:border-primary transition-colors"></div>
                      <svg className="absolute w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100" viewBox="0 0 14 10" fill="none">
                        <path d="M1 5L5 9L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 group-hover:text-primary transition-colors">Create System Account</p>
                      <p className="text-sm text-gray-500 mt-0.5">Allows this person to log in and view their department's monitoring data.</p>
                    </div>
                  </label>
                  {watchCreateAccount && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-4 pl-8">
                      <Input type="password" placeholder="Assign a secure password" {...register("password")} />
                      {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                    </motion.div>
                  )}
                </div>

                {/* Terms */}
                <div className="pt-4 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" {...register("terms")} />
                    <span className="text-sm font-medium text-gray-700">I agree to the terms and conditions and verify this information is accurate.</span>
                  </label>
                  {errors.terms && <p className="text-red-500 text-xs mt-1 ml-6">{errors.terms.message}</p>}
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="button" variant="outline" className="mr-4" onClick={() => setLocation("/dashboard")}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 shadow-green-600/20 text-white"
                    disabled={createPersonnelMutation.isPending}
                  >
                    {createPersonnelMutation.isPending ? "Registering..." : "Register Personnel"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  );
}
