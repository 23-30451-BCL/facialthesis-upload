import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Crown,
  Globe2,
  GraduationCap,
  Wallet,
  FlaskConical,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { OFFICES, type Office } from "@/contexts/department-context";

interface DeptStat { department: string; total: number; }

const OFFICE_CONFIG: Record<string, { icon: React.ElementType; gradient: string; accent: string }> = {
  OC:     { icon: Crown,         gradient: "from-red-500 to-red-700",         accent: "bg-red-50 border-red-200 text-red-700" },
  VCDEA:  { icon: Globe2,        gradient: "from-amber-500 to-amber-700",     accent: "bg-amber-50 border-amber-200 text-amber-700" },
  VCAA:   { icon: GraduationCap, gradient: "from-blue-500 to-blue-700",       accent: "bg-blue-50 border-blue-200 text-blue-700" },
  VCAF:   { icon: Wallet,        gradient: "from-emerald-500 to-emerald-700", accent: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  VCRDES: { icon: FlaskConical,  gradient: "from-purple-500 to-purple-700",   accent: "bg-purple-50 border-purple-200 text-purple-700" },
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<DeptStat[]>([]);

  useEffect(() => {
    fetch("/api/stats", { credentials: "include" })
      .then(r => r.json())
      .then(data => setStats(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const getOfficeTotal = (office: Office) =>
    stats
      .filter(s => office.units.includes(s.department))
      .reduce((sum, s) => sum + (s.total || 0), 0);

  const handleSelect = (office: Office) => {
    setLocation(`/office/${office.slug}`);
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-bold text-gray-500 tracking-[0.25em] uppercase">Offices</p>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Select an Office</h1>
          <p className="text-gray-500 mt-2">
            Choose an office to view its sub-units and attendance data.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {OFFICES.map((office, index) => {
            const cfg = OFFICE_CONFIG[office.code];
            const Icon = cfg.icon;
            const total = getOfficeTotal(office);

            return (
              <motion.button
                key={office.slug}
                onClick={() => handleSelect(office)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.06 }}
                className="group text-left w-full bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 hover:border-gray-200 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
              >
                {/* Gradient top bar */}
                <div className={`bg-gradient-to-r ${cfg.gradient} h-2 w-full`} />

                <div className="p-6 flex flex-col gap-4 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.accent}`}>
                      {office.code}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-900 group-hover:text-primary transition-colors leading-snug">
                      {office.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-2">
                      {office.units.length} sub-units
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.accent}`}>
                      {total} personnel
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all duration-200" />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="mt-8 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Admin Actions</h3>
          <div className="flex flex-wrap gap-3">
            <motion.a
              href="/register"
              onClick={(e) => { e.preventDefault(); setLocation("/register"); }}
              whileHover={{ scale: 1.02 }}
              className="px-5 py-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl font-semibold transition-colors text-sm"
            >
              + Register New Personnel
            </motion.a>
            <motion.a
              href="/accounts"
              onClick={(e) => { e.preventDefault(); setLocation("/accounts"); }}
              whileHover={{ scale: 1.02 }}
              className="px-5 py-2.5 bg-secondary/10 text-secondary hover:bg-secondary hover:text-white rounded-xl font-semibold transition-colors text-sm"
            >
              Manage User Accounts
            </motion.a>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
