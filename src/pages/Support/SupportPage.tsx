import React, { useState } from 'react';
import { mockStore } from '../../services/mockDataStore';
import { SupportTicket } from '../../types/skynav';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Drawer } from '../../components/common/Drawer';
import { HelpCircle, MessageSquare, Send, User } from 'lucide-react';

export const SupportPage: React.FC = () => {
  const [tickets, setTickets] = useState(mockStore.getTickets());
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');

  const columns: Column<SupportTicket>[] = [
    { header: 'Ticket ID', accessor: 'id', sortable: true },
    { header: 'Customer', accessor: 'customerName', sortable: true },
    { header: 'Order ID', accessor: (r) => r.orderId || 'General', sortable: true },
    { header: 'Issue Summary', accessor: 'issue', sortable: true },
    {
      header: 'Priority',
      accessor: (r) => (
        <span
          className={`font-bold px-2 py-0.5 rounded text-[10px] ${
            r.priority === 'Critical'
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              : 'bg-slate-800 text-slate-300'
          }`}
        >
          {r.priority}
        </span>
      ),
      sortable: true,
    },
    {
      header: 'Status',
      accessor: (r) => <StatusBadge status={r.status} size="sm" />,
      sortable: true,
    },
    {
      header: 'Actions',
      accessor: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTicket(r);
          }}
          className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800"
        >
          View Thread
        </button>
      ),
    },
  ];

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    selectedTicket.messages.push({
      sender: 'admin',
      senderName: 'John Doe (Ops Admin)',
      text: replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    setReplyText('');
    setTickets([...mockStore.getTickets()]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-cyan-400" /> Customer Support & Helpdesk
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Resolve delivery precision inquiries, delayed drops, and customer support tickets
          </p>
        </div>
      </div>

      <DataTable
        title="Support Tickets Queue"
        columns={columns}
        data={tickets}
        searchPlaceholder="Search Ticket ID, Customer, Issue..."
        searchField={(t) => `${t.id} ${t.customerName} ${t.issue}`}
        onRowClick={(row) => setSelectedTicket(row)}
      />

      {/* Ticket Thread Drawer */}
      {selectedTicket && (
        <Drawer
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          title={`Ticket — #${selectedTicket.id}`}
          subtitle={`Customer: ${selectedTicket.customerName} • Issue: ${selectedTicket.issue}`}
        >
          <div className="space-y-4 text-xs text-slate-200">
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {selectedTicket.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl max-w-[85%] space-y-1 ${
                    msg.sender === 'admin'
                      ? 'ml-auto bg-cyan-600/20 border border-cyan-500/30 text-slate-100'
                      : 'bg-slate-950 border border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>{msg.senderName}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <p className="text-xs">{msg.text}</p>
                </div>
              ))}
            </div>

            {/* Reply Form */}
            <form onSubmit={handleSendReply} className="flex gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type response to customer..."
                className="flex-1 rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-cyan-600 px-4 py-2 font-bold text-white hover:bg-cyan-500 shadow-lg shadow-cyan-600/30"
              >
                Send
              </button>
            </form>
          </div>
        </Drawer>
      )}
    </div>
  );
};
