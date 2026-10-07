'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  MapPin,
  Plus,
  Compass,
  Clock,
  Car,
  Users,
  CheckCircle2,
  RefreshCw,
  X,
  AlertCircle,
} from 'lucide-react';
import AiSmartMobilityDashboard from '@/components/admin/ai-smart-mobility-dashboard';

export default function AdminRoutesPage() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Route Form
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    origin: '',
    destination: '',
    distanceKm: '22',
    estimatedMinutes: '45',
    morningStartTime: '08:15 AM',
    eveningStartTime: '06:15 PM',
    assignedDriverId: '',
    waypoints: [
      { stopName: 'Pickup Hub A', landmark: 'Main Gate', estimatedPickupTime: '08:15 AM', estimatedDropTime: '07:00 PM' },
      { stopName: 'Pickup Hub B', landmark: 'Metro Junction', estimatedPickupTime: '08:35 AM', estimatedDropTime: '06:40 PM' },
      { stopName: 'Destination Park', landmark: 'Tech Park Gate 1', estimatedPickupTime: '09:00 AM', estimatedDropTime: '06:15 PM' },
    ],
  });

  const loadData = async () => {
    try {
      const [routesRes, driversRes] = await Promise.all([
        axios.get('/api/routes'),
        axios.get('/api/admin/drivers'),
      ]);
      if (routesRes.data?.routes) setRoutes(routesRes.data.routes);
      if (driversRes.data?.drivers) setDrivers(driversRes.data.drivers.filter((d: any) => d.isVerified));
    } catch (err) {
      console.error('Failed to load routes/drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/routes', {
        ...formData,
        waypoints: formData.waypoints,
      });

      if (res.data?.success) {
        setToastMessage('New Corridor Route created successfully!');
        setIsCreateOpen(false);
        await loadData();
      }
    } catch (err: any) {
      setToastMessage(err.response?.data?.error || 'Failed to create route');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center space-x-2">
              <MapPin className="w-6 h-6 text-emerald-600" />
              <h1 className="text-2xl font-black text-slate-900">Route Network Manager</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configure tech corridors, dispatch schedules, intermediate stops, and captain assignments
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Corridor Route</span>
          </button>
        </div>

        {toastMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Routes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {routes.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2.5 py-1 rounded-lg">
                    {r.code}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {r.distanceKm} km • ~{r.estimatedMinutes}m
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900">{r.name}</h3>

                <div className="text-xs text-slate-600 space-y-1">
                  <div><strong>Origin:</strong> {r.origin}</div>
                  <div><strong>Destination:</strong> {r.destination}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Assigned Driver:</span>
                    <span className="font-semibold text-slate-800">{r.assignedDriver?.name || 'Unassigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vehicle:</span>
                    <span className="font-semibold text-slate-800">{r.assignedVehicle?.make || 'Fleet'} {r.assignedVehicle?.model || 'Shuttle'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Capacity:</span>
                    <span className="font-semibold text-emerald-700">{r.activeSubscriptionsCount || 0} / {r.assignedVehicle?.capacity || 4} Seats</span>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Stops ({r.waypoints?.length || 0})</div>
                  <div className="text-slate-500 truncate">
                    {r.waypoints?.map((w: any) => w.stopName).join(' ➔ ')}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">Timings: {r.morningStartTime} / {r.eveningStartTime}</span>
                <span className="text-emerald-700 font-bold">Active</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 🧠 AI-Based Smart Route & Demand Prediction (Phase 3 Step 5) */}
      <div className="mt-8">
        <AiSmartMobilityDashboard />
      </div>

      {/* Create Route Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-xl w-full p-8 shadow-2xl border border-slate-200 relative space-y-6 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">Create Tech Corridor Route</h3>
              <p className="text-xs text-slate-500">Configure new commuter corridor with origin, destination, and timings</p>
            </div>

            <form onSubmit={handleCreateRoute} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Route Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. OMR IT Highway Express"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Route Code</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g. SR-104"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Origin Terminal</label>
                  <input
                    type="text"
                    required
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    placeholder="e.g. Koramangala Sony Signal"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Destination Office</label>
                  <input
                    type="text"
                    required
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    placeholder="e.g. RMZ Ecoworld Bellandur"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Morning Dispatch</label>
                  <input
                    type="text"
                    value={formData.morningStartTime}
                    onChange={(e) => setFormData({ ...formData, morningStartTime: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Evening Return</label>
                  <input
                    type="text"
                    value={formData.eveningStartTime}
                    onChange={(e) => setFormData({ ...formData, eveningStartTime: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Distance (KM)</label>
                  <input
                    type="number"
                    value={formData.distanceKm}
                    onChange={(e) => setFormData({ ...formData, distanceKm: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Assigned Driver</label>
                  <select
                    value={formData.assignedDriverId}
                    onChange={(e) => setFormData({ ...formData, assignedDriverId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.user?.name} ({d.vehicles[0]?.make || 'Vehicle'} - {d.vehicles[0]?.licensePlate || 'Plate'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-all"
              >
                Create Corridor Route
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
