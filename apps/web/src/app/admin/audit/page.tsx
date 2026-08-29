"use client";

import React, { useState } from "react";
import {
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Input,
  SearchIcon,
  Badge,
  Pagination,
  FileTextIcon
} from "@skynav/ui";
import { DEMO_AUDIT_LOGS } from "@/lib/demo-data";

export default function AdminAuditLogsPage() {
  const [search, setSearch] = useState("");

  const filtered = DEMO_AUDIT_LOGS.filter(
    (log) =>
      log.actor.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.resource.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Security & Compliance Audit Trail</h2>
        <p className="text-xs text-slate-400 mt-1">
          Cryptographically timestamped audit log of all flight authorizations, operator overrides, and tenant events.
        </p>
      </div>

      <Card variant="glass" className="p-4">
        <Input
          placeholder="Filter audit entries by actor, action type, or target resource..."
          leftIcon={<SearchIcon size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <Card variant="glass" className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp (UTC)</TableHead>
              <TableHead>Actor / Identity</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target Resource</TableHead>
              <TableHead>Tenant ID</TableHead>
              <TableHead>Payload Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-mono text-[11px] text-slate-400">{log.timestamp}</TableCell>
                <TableCell className="font-mono font-medium text-slate-200">{log.actor}</TableCell>
                <TableCell>
                  <Badge variant="primary" size="sm">
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono font-semibold text-cyan-300">{log.resource}</TableCell>
                <TableCell className="font-mono text-[10px] text-slate-400">{log.organizationId.slice(0, 8)}...</TableCell>
                <TableCell className="font-mono text-[10px] text-slate-400 max-w-xs truncate">
                  {log.details}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Pagination
          currentPage={1}
          totalPages={1}
          totalItems={filtered.length}
          pageSize={10}
          onPageChange={() => {}}
        />
      </Card>
    </div>
  );
}
