'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  Download,
  Printer,
  CheckCircle2,
  Calendar,
  CreditCard,
  Building,
  Car,
  X,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';

export default function InvoicesPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInvoices() {
      try {
        const res = await axios.get('/api/commuter/payments');
        if (res.data?.payments) {
          setPayments(res.data.payments);
        }
      } catch (err) {
        console.error('Failed to load invoices:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInvoices();
  }, []);

  const handlePrint = () => {
    window.print();
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
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center space-x-2">
              <FileText className="w-6 h-6 text-emerald-600" />
              <h1 className="text-2xl font-black text-slate-900">Payment & Invoice History</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Download tax invoices and receipts for corporate reimbursements
            </p>
          </div>
        </div>

        {/* Invoice List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {payments.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800">No Invoices Found</h4>
              <p className="text-xs text-slate-400 mt-1">
                Your payment receipts will appear here once you subscribe to a plan.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-6">Invoice #</th>
                    <th className="py-3.5 px-6">Plan / Route</th>
                    <th className="py-3.5 px-6">Date</th>
                    <th className="py-3.5 px-6">Amount</th>
                    <th className="py-3.5 px-6">Method</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-mono text-xs font-bold text-slate-900">
                        {p.invoiceNumber}
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-slate-900 font-semibold">{p.subscription?.plan?.name || 'Commute Pass'}</div>
                        <div className="text-xs text-slate-400">{p.subscription?.route?.name || 'Corridor Shuttle'}</div>
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-600">
                        {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-900">
                        ${p.amount.toFixed(2)}
                      </td>
                      <td className="py-4 px-6 text-xs">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Paid</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setSelectedInvoice(p)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-bold transition-all shadow-xs"
                        >
                          View Invoice
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Modal Preview */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto space-y-6">
            {/* Close Button */}
            <button
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Printable Invoice Template */}
            <div id="printable-invoice" className="space-y-6 text-slate-800">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-6">
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold">
                    <Car className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Smart Ride Technologies</h2>
                    <p className="text-xs text-slate-500">Corporate Mobility & Subscription Platform</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded">
                    TAX INVOICE
                  </span>
                  <div className="text-xs text-slate-500 mt-1 font-mono">{selectedInvoice.invoiceNumber}</div>
                </div>
              </div>

              {/* Billed To / Invoice Details */}
              <div className="grid grid-cols-2 gap-6 text-xs">
                <div>
                  <div className="font-bold text-slate-400 uppercase tracking-wider mb-1">Billed To:</div>
                  <div className="text-sm font-bold text-slate-900">{user?.name || 'Commuter'}</div>
                  <div className="text-slate-500">{user?.email}</div>
                  <div className="text-slate-500">{user?.phone || '+1 (555) 000-0000'}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-400 uppercase tracking-wider mb-1">Invoice Details:</div>
                  <div>Date: <strong>{new Date(selectedInvoice.createdAt).toLocaleDateString()}</strong></div>
                  <div>Payment Status: <strong className="text-emerald-600">PAID (Captured)</strong></div>
                  <div>Payment Gateway: <strong>Stripe / Razorpay Mock</strong></div>
                  <div className="font-mono text-[10px] text-slate-400 truncate">Ref: {selectedInvoice.transactionId}</div>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4">Route Corridor</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {selectedInvoice.subscription?.plan?.name || 'Monthly Commute Pass'}
                        <div className="text-[11px] text-slate-400">
                          Door-to-door morning & evening reserved AC seat
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {selectedInvoice.subscription?.route?.name || 'Corridor Route SR-101'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ${selectedInvoice.amount.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Calculation Breakdown */}
              <div className="flex justify-end text-xs space-y-1">
                <div className="w-60 space-y-1.5">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-800">${(selectedInvoice.amount * 0.95).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>GST / Sales Tax (5%):</span>
                    <span className="font-semibold text-slate-800">${(selectedInvoice.amount * 0.05).toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-sm text-slate-900">
                    <span>Total Paid:</span>
                    <span className="text-emerald-700">${selectedInvoice.amount.toFixed(2)} USD</span>
                  </div>
                </div>
              </div>

              {/* Footer notes */}
              <div className="pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
                Thank you for commuting with Smart Ride! This is a computer-generated tax invoice.
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all flex items-center space-x-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
