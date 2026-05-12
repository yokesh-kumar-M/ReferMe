"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardStore, Contact } from "@/store/dashboardStore";
import {
  Users, Plus, X, Link2, Mail, Phone, Building,
  Briefcase, Trash2, Edit3, Search, Copy, CheckCircle2,
  ExternalLink, User, MessageSquare
} from "lucide-react";

function ContactCard({ contact, onEdit, onDelete }: { contact: Contact; onEdit: () => void; onDelete: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (val: string, field: string) => {
    navigator.clipboard.writeText(val);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  };

  const initials = contact.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["bg-indigo-100 text-indigo-700", "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-blue-100 text-blue-700"];
  const colorIdx = contact.name.charCodeAt(0) % colors.length;

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm hover:shadow-md transition-all p-5 group">
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${colors[colorIdx]}`}>
          {initials || <User size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-zinc-800 truncate">{contact.name}</p>
          <p className="text-xs text-zinc-500">{contact.role} · {contact.company}</p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
            <Edit3 size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {contact.email && (
          <div className="flex items-center gap-2 group/item">
            <Mail size={13} className="text-zinc-400 shrink-0" />
            <span className="text-xs text-zinc-600 truncate flex-1">{contact.email}</span>
            <button onClick={() => copy(contact.email!, "email")}
              className="opacity-0 group-hover/item:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-700">
              {copied === "email" ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-2">
            <Phone size={13} className="text-zinc-400 shrink-0" />
            <span className="text-xs text-zinc-600">{contact.phone}</span>
          </div>
        )}
        {contact.linkedinUrl && (
          <div className="flex items-center gap-2">
            <Link2 size={13} className="text-zinc-400 shrink-0" />
            <a href={contact.linkedinUrl} target="_blank" rel="noreferrer"
              className="text-xs text-indigo-600 hover:text-indigo-800 truncate flex-1 hover:underline flex items-center gap-1">
              LinkedIn Profile <ExternalLink size={10} />
            </a>
          </div>
        )}
      </div>

      {contact.notes && (
        <div className="mt-3 pt-3 border-t border-zinc-50">
          <p className="text-xs text-zinc-400 flex items-start gap-1.5">
            <MessageSquare size={12} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{contact.notes}</span>
          </p>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-zinc-50 flex items-center justify-between">
        <span className="text-[10px] text-zinc-400">Added {new Date(contact.addedDate).toLocaleDateString()}</span>
        {contact.linkedJobIds.length > 0 && (
          <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
            {contact.linkedJobIds.length} job{contact.linkedJobIds.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function ContactModal({ contact, onClose, onSave }: {
  contact?: Contact; onClose: () => void;
  onSave: (data: Omit<Contact, "id" | "addedDate">) => void;
}) {
  const [form, setForm] = useState<Omit<Contact, "id" | "addedDate">>({
    name: contact?.name || "",
    email: contact?.email || "",
    phone: contact?.phone || "",
    linkedinUrl: contact?.linkedinUrl || "",
    company: contact?.company || "",
    role: contact?.role || "",
    notes: contact?.notes || "",
    linkedJobIds: contact?.linkedJobIds || [],
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-black text-zinc-900">{contact ? "Edit Contact" : "Add Contact"}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-3">
          {[
            { key: "name", label: "Name *", placeholder: "John Doe" },
            { key: "company", label: "Company", placeholder: "Acme Corp" },
            { key: "role", label: "Role", placeholder: "Recruiter" },
            { key: "email", label: "Email", placeholder: "john@acme.com" },
            { key: "phone", label: "Phone", placeholder: "+1 (555) 000-0000" },
            { key: "linkedinUrl", label: "LinkedIn URL", placeholder: "https://linkedin.com/in/..." },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</label>
              <input value={(form as unknown as Record<string, string>)[key] || ""} onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Notes</label>

            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} placeholder="Notes about this contact..."
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-600 hover:bg-zinc-50">Cancel</button>
            <button onClick={() => { if (form.name.trim()) { onSave(form); onClose(); } }}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors">Save</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ContactsPage() {
  const { contacts, addContact, updateContact, deleteContact } = useDashboardStore();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editContact, setEditContact] = useState<Contact | undefined>();
  const [search, setSearch] = useState("");

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase()) ||
    c.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-lg font-black text-zinc-900">Network & Contacts</h1>
          <p className="text-xs text-zinc-400 mt-0.5">{contacts.length} contacts — recruiters, hiring managers, referrals</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="pl-8 pr-4 py-2 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-indigo-400 outline-none w-48" />
          </div>
          <button onClick={() => { setEditContact(undefined); setShowModal(true); }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm shadow-indigo-500/20">
            <Plus size={16} /> Add Contact
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-zinc-400" />
          </div>
          <p className="text-sm font-bold text-zinc-600 mb-2">
            {search ? "No contacts found" : "No contacts yet"}
          </p>
          <p className="text-xs text-zinc-400 mb-5">
            {search ? "Try a different search term" : "Add recruiters and hiring managers to your network."}
          </p>
          {!search && (
            <button onClick={() => setShowModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">
              Add First Contact
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map(contact => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onEdit={() => { setEditContact(contact); setShowModal(true); }}
                onDelete={() => { if (confirm("Delete this contact?")) deleteContact(contact.id); }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <ContactModal
            contact={editContact}
            onClose={() => { setShowModal(false); setEditContact(undefined); }}
            onSave={data => {
              if (editContact) updateContact(editContact.id, data);
              else addContact(data);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
