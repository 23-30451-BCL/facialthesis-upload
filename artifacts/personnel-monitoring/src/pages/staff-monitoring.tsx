import React, { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useDepartment } from "@/contexts/department-context";
import { format } from "date-fns";
import { Search, Camera, WifiOff, Clock, Users, Trash2, LayoutDashboard, Video, Settings, LogIn, LogOut as LogOutIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

interface Personnel {
  id: number;
  lastName: string;
  firstName: string;
  middleInitial: string | null;
  employeeId: string;
  department: string;
  position: string;
  photoUrl: string | null;
  vehiclePlate: string | null;
  hasAccount: boolean;
  createdAt: string;
}

interface AttendanceLog {
  id: number;
  employeeId: string;
  name: string;
  department: string;
  vehiclePlate: string | null;
  logType: string;
  timestamp: string;
}

const POLL_INTERVAL = 5000;
const CAMERA_URL_KEY = "bsu_camera_feed_url";

export default function StaffMonitoring() {
  const { user } = useAuth();
  const { selectedDept } = useDepartment();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";

  const [searchTerm, setSearchTerm] = useState("");
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [logsError, setLogsError] = useState(false);
  const [personnelLoading, setPersonnelLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"logs" | "roster" | "camera">("logs");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [cameraUrl, setCameraUrl] = useState(() => localStorage.getItem(CAMERA_URL_KEY) || "");
  const [cameraUrlInput, setCameraUrlInput] = useState(() => localStorage.getItem(CAMERA_URL_KEY) || "");
  const [showCameraSettings, setShowCameraSettings] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const deptForFetch = isAdmin ? selectedDept : null;

  const fetchPersonnel = async () => {
    setPersonnelLoading(true);
    try {
      const url = deptForFetch
        ? `/api/personnel?department=${encodeURIComponent(deptForFetch)}`
        : "/api/personnel";
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) setPersonnel(await res.json());
    } finally {
      setPersonnelLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const url = deptForFetch
        ? `/api/logs?department=${encodeURIComponent(deptForFetch)}`
        : "/api/logs";
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        setLogs(await res.json());
        setLastUpdated(new Date());
        setLogsError(false);
      } else {
        setLogsError(true);
      }
    } catch {
      setLogsError(true);
    }
  };

  useEffect(() => {
    if (isAdmin && !selectedDept) return;
    fetchPersonnel();
    fetchLogs();
    intervalRef.current = setInterval(fetchLogs, POLL_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [selectedDept]);

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/personnel/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      setPersonnel(prev => prev.filter(p => p.id !== id));
      setDeleteConfirm(null);
    }
  };

  const saveCameraUrl = () => {
    setCameraUrl(cameraUrlInput);
    localStorage.setItem(CAMERA_URL_KEY, cameraUrlInput);
    setShowCameraSettings(false);
    setCameraError(false);
  };

  const filteredLogs = logs.filter(l =>
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.employeeId.includes(searchTerm)
  );

  const filteredPersonnel = personnel.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.employeeId.includes(searchTerm)
  );

  if (isAdmin && !selectedDept) {
    return (
      <AppLayout>
        <div className="h-[calc(100vh-12rem)] flex flex-col items-center justify-center text-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <LayoutDashboard className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">No Sub-unit Selected</h2>
            <p className="text-gray-500 mt-2 max-w-sm">
              Please go to the Dashboard, choose an office, then select a sub-unit to view its personnel and attendance data.
            </p>
          </div>
          <button
            onClick={() => setLocation("/dashboard")}
            className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 h-[calc(100vh-10rem)]">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Camera className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isAdmin ? selectedDept : "My Department"} — Staff Monitoring
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-gray-500">
                  Live · updates every 5s
                  {lastUpdated && ` · Last: ${format(lastUpdated, "HH:mm:ss")}`}
                </span>
              </div>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name or ID..."
              className="pl-9 h-10 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${activeTab === "logs" ? "bg-primary text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            <Clock className="inline w-4 h-4 mr-1.5 -mt-0.5" />
            Attendance Logs
            {activeTab === "logs" && (
              <span className="ml-2 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">{logs.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("roster")}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${activeTab === "roster" ? "bg-primary text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            <Users className="inline w-4 h-4 mr-1.5 -mt-0.5" />
            Personnel Roster
            {activeTab === "roster" && (
              <span className="ml-2 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">{personnel.length}</span>
            )}
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("camera")}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${activeTab === "camera" ? "bg-primary text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              <Video className="inline w-4 h-4 mr-1.5 -mt-0.5" />
              Camera Feed
            </button>
          )}
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0">

          {/* Attendance Logs Tab */}
          {activeTab === "logs" && (
            <div className="overflow-auto flex-1">
              {logsError ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-gray-400 gap-3">
                  <WifiOff className="w-10 h-10" />
                  <p className="font-medium">Could not load attendance logs.</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-gray-400 gap-3">
                  <Camera className="w-10 h-10" />
                  <p className="font-medium text-gray-600">No attendance logs yet for {isAdmin ? selectedDept : "your department"}.</p>
                  <p className="text-sm text-center max-w-sm">
                    Start the facial recognition service on your local machine to begin logging attendance.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-5 font-bold text-gray-600 text-xs uppercase tracking-wider">Name</th>
                      <th className="py-3 px-5 font-bold text-gray-600 text-xs uppercase tracking-wider">Employee ID</th>
                      <th className="py-3 px-5 font-bold text-gray-600 text-xs uppercase tracking-wider">Department</th>
                      <th className="py-3 px-5 font-bold text-gray-600 text-xs uppercase tracking-wider">Vehicle Plate</th>
                      <th className="py-3 px-5 font-bold text-gray-600 text-xs uppercase tracking-wider">Date & Time</th>
                      <th className="py-3 px-5 font-bold text-gray-600 text-xs uppercase tracking-wider">Log Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLogs.map((log) => {
                      const isTimeIn = log.logType === "TIME_IN";
                      const dt = new Date(log.timestamp);
                      return (
                        <tr key={log.id} className={`hover:bg-blue-50/30 transition-colors`}>
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isTimeIn ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {log.name.charAt(0)}
                              </div>
                              <p className="font-semibold text-gray-900 text-sm">{log.name}</p>
                            </div>
                          </td>
                          <td className="py-3 px-5 font-mono text-sm text-gray-600">{log.employeeId}</td>
                          <td className="py-3 px-5">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">{log.department}</span>
                          </td>
                          <td className="py-3 px-5">
                            {log.vehiclePlate
                              ? <span className="px-2 py-0.5 rounded bg-yellow-100 border border-yellow-200 text-yellow-800 font-mono text-xs font-bold tracking-widest">{log.vehiclePlate}</span>
                              : <span className="text-gray-400 text-sm italic">N/A</span>}
                          </td>
                          <td className="py-3 px-5 text-sm text-gray-700 whitespace-nowrap">
                            {format(dt, "MM/dd/yyyy")}
                            <span className="ml-2 font-mono text-gray-500">{format(dt, "HH:mm:ss")}</span>
                          </td>
                          <td className="py-3 px-5">
                            {isTimeIn ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                                <LogIn className="w-3 h-3" />
                                TIME IN
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                                <LogOutIcon className="w-3 h-3" />
                                TIME OUT
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Personnel Roster Tab */}
          {activeTab === "roster" && (
            <div className="overflow-auto flex-1">
              {personnelLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : filteredPersonnel.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-gray-400 gap-2">
                  <Users className="w-10 h-10" />
                  <p className="font-medium">No personnel found.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-5 font-bold text-gray-600 text-xs uppercase tracking-wider">Name</th>
                      <th className="py-3 px-5 font-bold text-gray-600 text-xs uppercase tracking-wider">Employee ID</th>
                      <th className="py-3 px-5 font-bold text-gray-600 text-xs uppercase tracking-wider">Position</th>
                      <th className="py-3 px-5 font-bold text-gray-600 text-xs uppercase tracking-wider">Vehicle Plate #</th>
                      {isAdmin && <th className="py-3 px-5 font-bold text-gray-600 text-xs uppercase tracking-wider text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPersonnel.map((person) => (
                      <tr key={person.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3">
                            {person.photoUrl ? (
                              <img src={person.photoUrl} alt={person.firstName} className="w-9 h-9 rounded-full object-cover shadow-sm" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                                {person.firstName.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">
                                {person.lastName}, {person.firstName} {person.middleInitial ? `${person.middleInitial}.` : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-5 font-mono text-sm text-gray-700">{person.employeeId}</td>
                        <td className="py-3 px-5 text-sm text-gray-700">{person.position}</td>
                        <td className="py-3 px-5">
                          {person.vehiclePlate
                            ? <span className="px-2 py-0.5 rounded bg-yellow-100 border border-yellow-200 text-yellow-800 font-mono text-xs font-bold tracking-widest">{person.vehiclePlate}</span>
                            : <span className="text-gray-400 text-sm italic">N/A</span>}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-5 text-center">
                            {deleteConfirm === person.id ? (
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handleDelete(person.id)} className="px-2.5 py-1 bg-red-600 text-white text-xs rounded-lg font-semibold hover:bg-red-700">
                                  Confirm
                                </button>
                                <button onClick={() => setDeleteConfirm(null)} className="px-2.5 py-1 bg-gray-200 text-gray-700 text-xs rounded-lg font-semibold hover:bg-gray-300">
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteConfirm(person.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Camera Feed Tab (Admin only) */}
          {activeTab === "camera" && isAdmin && (
            <div className="flex-1 flex flex-col p-6 gap-4 min-h-0">
              <div className="flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Live IP Camera Feed</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Configure your camera's HTTP stream URL to monitor recognition activity in real time.</p>
                </div>
                <button
                  onClick={() => setShowCameraSettings(!showCameraSettings)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  {cameraUrl ? "Change URL" : "Configure"}
                </button>
              </div>

              {showCameraSettings && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex-shrink-0">
                  <p className="text-sm font-semibold text-blue-800 mb-1">Camera HTTP/MJPEG Stream URL</p>
                  <p className="text-xs text-blue-600 mb-3">
                    Enter the HTTP stream URL from your Hikvision camera. Examples:<br />
                    <code className="bg-blue-100 px-1 rounded font-mono">http://admin:password@192.168.1.64/Streaming/channels/1/httpPreview</code><br />
                    <code className="bg-blue-100 px-1 rounded font-mono mt-1 inline-block">http://192.168.1.64:8080/video</code>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cameraUrlInput}
                      onChange={e => setCameraUrlInput(e.target.value)}
                      placeholder="http://admin:password@192.168.1.64/Streaming/channels/1/httpPreview"
                      className="flex-1 h-9 px-3 rounded-lg border border-blue-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      onClick={saveCameraUrl}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      Save & Apply
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 bg-gray-900 rounded-2xl overflow-hidden flex flex-col items-center justify-center relative min-h-[280px]">
                {!cameraUrl ? (
                  <div className="text-center text-gray-400 p-8">
                    <Video className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="font-semibold text-lg">No Camera Configured</p>
                    <p className="text-sm mt-2 opacity-70 max-w-sm">
                      Click "Configure" above and enter your IP camera's HTTP stream URL to view the live feed here.
                    </p>
                  </div>
                ) : cameraError ? (
                  <div className="text-center text-gray-400 p-8">
                    <WifiOff className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="font-semibold text-lg text-red-400">Stream Unavailable</p>
                    <p className="text-sm mt-2 opacity-70 max-w-sm">
                      Could not load the camera stream. Make sure the camera is powered on and your device is connected to the same network.
                    </p>
                    <button
                      onClick={() => setCameraError(false)}
                      className="mt-4 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg text-sm hover:bg-gray-600 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <>
                    <img
                      key={cameraUrl}
                      src={cameraUrl}
                      alt="Live camera feed"
                      className="w-full h-full object-contain"
                      onError={() => setCameraError(true)}
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm pointer-events-none">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      LIVE
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
