import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import {
  Loader2,
  Database,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  XIcon,
  Edit2,
  Trash2,
  Plus,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../lib/utils";
import { Textarea } from "./ui/textarea";

type ProjectIdentity = {
  conversationId?: string;
  ref?: string;
  title?: string;
};

type TableItem = { schema: string; name: string };

interface SupabaseBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectIdentity | null;
}

export function SupabaseBrowserDialog({
  open,
  onOpenChange,
  project,
}: SupabaseBrowserDialogProps) {
  const [loadingTables, setLoadingTables] = useState(false);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [filter, setFilter] = useState("");
  const [activeTable, setActiveTable] = useState<TableItem | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [creatingRow, setCreatingRow] = useState(false);
  const [rowData, setRowData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    row: any;
    primaryKey: string;
    primaryValue: any;
  } | null>(null);

  const filteredTables = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.schema.toLowerCase().includes(q) ||
        `${t.schema}.${t.name}`.toLowerCase().includes(q)
    );
  }, [tables, filter]);

  const fetchTables = async () => {
    if (!project) return;
    setLoadingTables(true);
    try {
      const url = new URL("/api/supabase/tables", window.location.origin);
      if (project.conversationId) {
        url.searchParams.set("conversationId", project.conversationId);
      } else if (project.ref) {
        url.searchParams.set("ref", project.ref);
      }
      const res = await fetch(url.toString(), {
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const js = await res.json();
        setTables(js.tables || []);
      }
    } catch {
    } finally {
      setLoadingTables(false);
    }
  };

  const fetchRows = async (tbl: TableItem, newOffset = 0, newLimit = limit) => {
    if (!project) return;
    setLoadingRows(true);
    try {
      const url = new URL("/api/supabase/rows", window.location.origin);
      if (project.conversationId) {
        url.searchParams.set("conversationId", project.conversationId);
      } else if (project.ref) {
        url.searchParams.set("ref", project.ref);
      }
      url.searchParams.set("schema", tbl.schema);
      url.searchParams.set("table", tbl.name);
      url.searchParams.set("limit", String(newLimit));
      url.searchParams.set("offset", String(newOffset));
      const res = await fetch(url.toString(), {
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const js = await res.json();
        setRows(js.rows || []);
        setTotal(js.total || 0);
        setLimit(js.limit || newLimit);
        setOffset(js.offset || newOffset);
      }
    } catch {
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    if (open) {
      setTables([]);
      setRows([]);
      setActiveTable(null);
      setFilter("");
      setOffset(0);
      fetchTables();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.conversationId, project?.ref]);

  const headers = useMemo(() => {
    if (!rows || rows.length === 0) return [] as string[];
    const set = new Set<string>();
    for (const r of rows) {
      Object.keys(r || {}).forEach((k) => set.add(k));
    }
    return Array.from(set);
  }, [rows]);

  // Detect primary key (common patterns: id, _id, or first column)
  const primaryKey = useMemo(() => {
    if (!rows || rows.length === 0) return "id";
    const firstRow = rows[0];
    const keys = Object.keys(firstRow || {});
    if (keys.includes("id")) return "id";
    if (keys.includes("_id")) return "_id";
    return keys[0] || "id";
  }, [rows]);

  const handleEdit = (row: any) => {
    setEditingRow(row);
    setRowData({ ...row });
  };

  const handleCreate = () => {
    setCreatingRow(true);
    const initialData: Record<string, any> = {};
    headers.forEach((h) => {
      if (h !== primaryKey) {
        initialData[h] = "";
      }
    });
    setRowData(initialData);
  };

  const handleSave = async () => {
    if (!activeTable || !project) return;
    setIsSaving(true);
    try {
      const url = new URL("/api/supabase/rows", window.location.origin);
      const method = editingRow ? "PUT" : "POST";
      const body: any = {
        conversationId: project.conversationId,
        ref: project.ref,
        schema: activeTable.schema,
        table: activeTable.name,
        data: { ...rowData },
      };

      if (editingRow) {
        body.primaryKey = primaryKey;
        body.primaryValue = editingRow[primaryKey];
      }

      const res = await fetch(url.toString(), {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEditingRow(null);
        setCreatingRow(false);
        setRowData({});
        // Refresh rows
        await fetchRows(activeTable, offset, limit);
      } else {
        const error = await res.json();
        alert(
          `Failed to ${editingRow ? "update" : "create"} row: ${
            error.error || "Unknown error"
          }`
        );
      }
    } catch (error: any) {
      alert(`Error: ${error.message || "Failed to save"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm || !activeTable || !project) return;
    setIsSaving(true);
    try {
      const url = new URL("/api/supabase/rows", window.location.origin);
      const res = await fetch(url.toString(), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: project.conversationId,
          ref: project.ref,
          schema: activeTable.schema,
          table: activeTable.name,
          primaryKey: deleteConfirm.primaryKey,
          primaryValue: deleteConfirm.primaryValue,
        }),
      });

      if (res.ok) {
        setDeleteConfirm(null);
        // Refresh rows
        await fetchRows(activeTable, offset, limit);
      } else {
        const error = await res.json();
        alert(`Failed to delete row: ${error.error || "Unknown error"}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message || "Failed to delete"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil((total || 0) / Math.max(1, limit)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal data-slot="dialog-portal">
        <DialogOverlay data-slot="dialog-overlay" className="bg-black/50" />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(
            "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid translate-x-[-50%] translate-y-[-50%] gap-4 rounded-3xl p-[2px] shadow-2xl shadow-black/40 duration-200 max-w-[95vw] w-[1800px] h-[90vh] bg-gradient-to-b from-white/15 via-white/5 to-transparent"
          )}
        >
          <div className="bg-background/70 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col h-full">
            <DialogHeader className="px-6 py-5 border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 shadow-lg shadow-primary/20">
                    <Database className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-semibold">
                      Database Browser
                    </DialogTitle>
                    {project?.title && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {project.title}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DialogClose
                    data-slot="dialog-close"
                    className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none h-8 w-8"
                  >
                    <XIcon className="size-4" />
                    <span className="sr-only">Close</span>
                  </DialogClose>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-hidden flex flex-col gap-4 p-6">
              <div className="grid grid-cols-12 gap-6 min-h-0 flex-1">
                {/* Sidebar: tables */}
                <div className="col-span-12 md:col-span-4 lg:col-span-3 flex flex-col">
                  <div className="space-y-3 flex-shrink-0">
                    <div className="relative">
                      <Input
                        placeholder="Search tables…"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="pl-9 bg-muted/30 border-border/60 focus:bg-muted/50 focus:border-primary/50"
                      />
                      <TableIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                      {filteredTables.length}{" "}
                      {filteredTables.length === 1 ? "table" : "tables"}
                    </div>
                  </div>
                  <div className="border border-border/60 rounded-xl overflow-hidden flex-1 min-h-0">
                    <ScrollArea className="h-full">
                      <div className="divide-y divide-border/50">
                        {loadingTables ? (
                          <div className="flex items-center justify-center h-40 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin mr-3" />
                            <span>Loading tables…</span>
                          </div>
                        ) : filteredTables.length === 0 ? (
                          <div className="p-6 text-center text-sm text-muted-foreground">
                            <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            {filter
                              ? "No tables match your search"
                              : "No tables found"}
                          </div>
                        ) : (
                          filteredTables.map((t) => {
                            const isActive =
                              activeTable?.schema === t.schema &&
                              activeTable?.name === t.name;
                            return (
                              <button
                                key={`${t.schema}.${t.name}`}
                                onClick={() => {
                                  setActiveTable(t);
                                  fetchRows(t, 0, limit);
                                }}
                                className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm transition-all duration-200 hover:bg-muted/50 ${
                                  isActive
                                    ? "bg-primary/10 border-l-2 border-l-primary"
                                    : ""
                                }`}
                              >
                                <div className="p-1.5 rounded-md bg-primary/10">
                                  <TableIcon className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-foreground font-medium truncate">
                                    {t.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {t.schema} schema
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                {/* Content: rows */}
                <div className="col-span-12 md:col-span-8 lg:col-span-9 flex flex-col min-h-0">
                  <div className="border border-border/60 rounded-xl overflow-hidden flex-1 flex flex-col bg-background/50 shadow-lg">
                    <div className="px-4 py-3 bg-gradient-to-r from-muted/40 via-muted/20 to-transparent border-b border-border/60 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {activeTable ? (
                          <>
                            <div className="p-1.5 rounded-md bg-primary/10">
                              <TableIcon className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold">
                                {activeTable.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {activeTable.schema} schema
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            Select a table to view its data
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {activeTable && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCreate}
                              className="bg-background/80 hover:bg-muted/50 border-border/60"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Row
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                fetchRows(activeTable, offset, limit)
                              }
                              disabled={loadingRows}
                              className="bg-background/80 hover:bg-muted/50 border-border/60"
                            >
                              {loadingRows ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Refreshing…
                                </>
                              ) : (
                                "Refresh"
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <ScrollArea className="flex-1 min-h-0">
                      {!activeTable ? (
                        <div className="h-[600px] flex flex-col items-center justify-center text-muted-foreground">
                          <Database className="w-16 h-16 mb-4 opacity-30" />
                          <p className="text-lg font-medium mb-2">
                            No table selected
                          </p>
                          <p className="text-sm">
                            Choose a table from the list to view its data
                          </p>
                        </div>
                      ) : loadingRows ? (
                        <div className="h-[600px] flex flex-col items-center justify-center text-muted-foreground">
                          <Loader2 className="w-8 h-8 animate-spin mb-4" />
                          <p>Loading rows…</p>
                        </div>
                      ) : rows.length === 0 ? (
                        <div className="h-[600px] flex flex-col items-center justify-center text-muted-foreground">
                          <Database className="w-12 h-12 mb-3 opacity-30" />
                          <p className="font-medium">No rows in this table</p>
                          <p className="text-sm mt-1">
                            The table exists but contains no data
                          </p>
                        </div>
                      ) : (
                        <table className="min-w-full text-sm">
                          <thead className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 shadow-sm">
                            <tr className="border-b-2 border-border/60">
                              {headers.map((h) => (
                                <th
                                  key={h}
                                  className="text-left font-semibold px-4 py-3 whitespace-nowrap bg-gradient-to-b from-muted/10 to-transparent"
                                >
                                  {h}
                                </th>
                              ))}
                              <th className="text-right font-semibold px-4 py-3 whitespace-nowrap bg-gradient-to-b from-muted/10 to-transparent w-24">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, idx) => (
                              <tr
                                key={idx}
                                className="border-b border-border/40 hover:bg-muted/40 transition-colors duration-150"
                              >
                                {headers.map((h) => (
                                  <td key={h} className="px-4 py-3 align-top">
                                    <div className="text-foreground/90 break-all">
                                      {formatCell(r[h])}
                                    </div>
                                  </td>
                                ))}
                                <td className="px-4 py-3 align-top">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEdit(r)}
                                      className="h-7 w-7 p-0 hover:bg-primary/10"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-primary" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setDeleteConfirm({
                                          row: r,
                                          primaryKey,
                                          primaryValue: r[primaryKey],
                                        })
                                      }
                                      className="h-7 w-7 p-0 hover:bg-destructive/10"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <ScrollBar orientation="vertical" className="w-2" />
                      <ScrollBar orientation="horizontal" className="h-2" />
                    </ScrollArea>

                    {/* Pagination */}
                    {activeTable && total > 0 && (
                      <div className="px-4 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {total}
                          </span>{" "}
                          total rows • page{" "}
                          <span className="font-medium text-foreground">
                            {page}
                          </span>{" "}
                          of{" "}
                          <span className="font-medium text-foreground">
                            {pageCount}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={offset <= 0 || loadingRows}
                            onClick={() =>
                              fetchRows(
                                activeTable,
                                Math.max(0, offset - limit),
                                limit
                              )
                            }
                            className="h-8 w-8"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                            {page} / {pageCount}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={offset + limit >= total || loadingRows}
                            onClick={() =>
                              fetchRows(
                                activeTable,
                                Math.min(total, offset + limit),
                                limit
                              )
                            }
                            className="h-8 w-8"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>

      {/* Edit/Create Row Dialog */}
      <Dialog
        open={!!editingRow || creatingRow}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRow(null);
            setCreatingRow(false);
            setRowData({});
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRow ? "Edit Row" : "Create New Row"}
            </DialogTitle>
            <DialogDescription>
              {activeTable && `${activeTable.schema}.${activeTable.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {headers.map((header) => {
              if (editingRow && header === primaryKey) {
                return (
                  <div key={header} className="space-y-2">
                    <Label>{header} (Primary Key)</Label>
                    <Input
                      value={rowData[header] || ""}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                );
              }
              const value = rowData[header];
              const isLongText =
                typeof value === "string" && value.length > 100;
              return (
                <div key={header} className="space-y-2">
                  <Label>{header}</Label>
                  {isLongText ? (
                    <Textarea
                      value={value || ""}
                      onChange={(e) =>
                        setRowData({ ...rowData, [header]: e.target.value })
                      }
                      className="min-h-[100px] font-mono text-sm"
                    />
                  ) : (
                    <Input
                      value={value || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Try to parse as number if it looks like one
                        const numVal =
                          val === ""
                            ? ""
                            : !isNaN(Number(val)) && val.trim() !== ""
                            ? Number(val)
                            : val;
                        setRowData({ ...rowData, [header]: numVal });
                      }}
                      placeholder={`Enter ${header}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingRow(null);
                setCreatingRow(false);
                setRowData({});
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : editingRow ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Row</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this row? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {deleteConfirm && (
            <div className="py-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  <strong>Primary Key:</strong> {deleteConfirm.primaryKey} ={" "}
                  {String(deleteConfirm.primaryValue)}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function formatCell(value: any) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export default SupabaseBrowserDialog;
