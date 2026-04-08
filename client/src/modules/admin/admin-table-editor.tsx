import { useCallback, useEffect, useMemo, useState } from 'react';
import DataEditor, {
  type GridColumn,
  type GridCell,
  GridCellKind,
  type Item,
} from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';
import { useAdminTable, useAdminCreate, useAdminUpdate, useAdminDelete } from '../../api/admin';
import { useUndoRedo } from './use-undo-redo';
import type { ColumnDef } from './admin-data-grid';
import AdminEditModal from './admin-edit-modal';

interface AdminTableEditorProps {
  title: string;
  tableName: string;
  columns: ColumnDef[];
  pkColumn: string;
}

export default function AdminTableEditor({ title, tableName, columns, pkColumn }: AdminTableEditorProps) {
  const { data, isLoading, error } = useAdminTable(tableName);
  const createMutation = useAdminCreate(tableName);
  const updateMutation = useAdminUpdate(tableName);
  const deleteMutation = useAdminDelete(tableName);
  const { pushAction, undo, redo, canUndo, canRedo } = useUndoRedo();
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);

  const rows = useMemo(() => {
    const allRows = data?.rows ?? [];
    if (!searchText) return allRows;
    const lower = searchText.toLowerCase();
    return allRows.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(lower)),
    );
  }, [data?.rows, searchText]);

  const gridColumns: GridColumn[] = useMemo(
    () => columns.map((col) => ({ id: col.key, title: col.title, width: col.width ?? 150 })),
    [columns],
  );

  const getContent = useCallback(
    ([col, row]: Item): GridCell => {
      const colDef = columns[col];
      const rowData = rows[row];
      if (!colDef || !rowData) {
        return { kind: GridCellKind.Text, data: '', displayData: '', allowOverlay: false };
      }

      const value = rowData[colDef.key];
      const displayValue =
        value === null || value === undefined
          ? ''
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);

      const kind = colDef.kind ?? GridCellKind.Text;

      if (kind === GridCellKind.Number) {
        return {
          kind: GridCellKind.Number,
          data: Number(value) || 0,
          displayData: displayValue,
          allowOverlay: !colDef.readonly,
        };
      }
      if (kind === GridCellKind.Boolean) {
        return { kind: GridCellKind.Boolean, data: Boolean(value), allowOverlay: false };
      }
      return {
        kind: GridCellKind.Text,
        data: displayValue,
        displayData: displayValue,
        allowOverlay: !colDef.readonly,
      };
    },
    [columns, rows],
  );

  const onCellActivated = useCallback(
    ([_col, row]: Item) => {
      const rowData = rows[row];
      if (!rowData) return;
      setEditingRow({ ...rowData });
      setIsCreateMode(false);
      setIsModalOpen(true);
    },
    [rows],
  );

  const handleAdd = useCallback(() => {
    setEditingRow(null);
    setIsCreateMode(true);
    setIsModalOpen(true);
  }, []);

  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const applyUndoRedo = useCallback(
    async (action: import('./useUndoRedo').UndoAction, direction: 'undo' | 'redo') => {
      if (action.type === 'update') {
        const data = direction === 'undo' ? action.prevData : action.nextData;
        updateMutation.mutate({ id: action.id, data });
      } else if (action.type === 'create' && direction === 'undo') {
        deleteMutation.mutate(action.id);
      } else if (action.type === 'delete' && direction === 'undo') {
        createMutation.mutate(action.prevData);
      } else if (action.type === 'create' && direction === 'redo') {
        createMutation.mutate(action.nextData);
      } else if (action.type === 'delete' && direction === 'redo') {
        deleteMutation.mutate(action.id);
      }
    },
    [updateMutation, deleteMutation, createMutation],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo(applyUndoRedo);
        } else {
          undo(applyUndoRedo);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, applyUndoRedo]);

  const handleDelete = useCallback(() => {
    if (selectedRow === null) return;
    const rowData = rows[selectedRow];
    if (!rowData) return;
    const pk = String(rowData[pkColumn]);
    if (confirm(`"${pk}" 항목을 삭제하시겠습니까?`)) {
      deleteMutation.mutate(pk);
      setSelectedRow(null);
    }
  }, [selectedRow, rows, pkColumn, deleteMutation]);

  const handleModalSave = useCallback(
    (rowData: Record<string, unknown>) => {
      if (isCreateMode) {
        // Create mode: assign ID and save
        const newRow: Record<string, unknown> = { ...rowData };
        newRow[pkColumn] = crypto.randomUUID();
        if (!newRow['createdAt'] && columns.some((c) => c.key === 'createdAt')) {
          newRow['createdAt'] = Date.now();
        }
        createMutation.mutate(newRow);
      } else if (editingRow) {
        // Edit mode: compute changed fields and update
        const changedFields: Record<string, unknown> = {};
        for (const col of columns) {
          if (rowData[col.key] !== editingRow[col.key]) {
            changedFields[col.key] = rowData[col.key];
          }
        }
        if (Object.keys(changedFields).length > 0) {
          const pk = String(editingRow[pkColumn]);
          // prevData = old values, nextData = new values
          const prevData: Record<string, unknown> = {};
          for (const key of Object.keys(changedFields)) {
            prevData[key] = editingRow[key];
          }
          pushAction({
            tableName,
            type: 'update',
            id: pk,
            prevData,
            nextData: changedFields,
          });
          updateMutation.mutate({ id: pk, data: changedFields });
        }
      }
      setIsModalOpen(false);
      setEditingRow(null);
    },
    [isCreateMode, editingRow, columns, pkColumn, createMutation, updateMutation, tableName, pushAction],
  );

  const isSaving = updateMutation.isPending || createMutation.isPending || deleteMutation.isPending;

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#9ca3af', fontSize: 13 }}>로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#dc2626', fontSize: 13 }}>오류: {(error as Error).message}</p>
      </div>
    );
  }

  const gridTheme = {
    baseFontStyle: '12px Inter, system-ui',
    headerFontStyle: '600 11px Inter, system-ui',
    editorFontSize: '12px',
    cellHorizontalPadding: 8,
    cellVerticalPadding: 4,
    lineHeight: 20,
    headerHeight: 30,
    roundingRadius: 0,
    bgHeader: '#f8fafc',
    bgCell: '#fff',
    textHeader: '#374151',
    textDark: '#111827',
    borderColor: '#e5e7eb',
    bgHeaderHovered: '#f1f5f9',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid #e5e7eb',
        background: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{title}</h2>
          <span style={{
            fontSize: 10,
            color: '#6b7280',
            background: '#f3f4f6',
            padding: '2px 7px',
            borderRadius: 4,
          }}>
            {rows.length}
          </span>
          {isSaving && (
            <span style={{ fontSize: 10, color: '#2563eb' }}>저장 중...</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="text"
            placeholder="검색..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              border: '1px solid #e5e7eb',
              borderRadius: 4,
              outline: 'none',
              width: 140,
              background: '#fafafa',
              color: '#111827',
            }}
          />
          <button onClick={handleAdd} disabled={createMutation.isPending} style={{ ...toolBtn, padding: '4px 8px', fontSize: 11 }}>
            추가
          </button>
          <button
            onClick={handleDelete}
            disabled={selectedRow === null || deleteMutation.isPending}
            style={{
              ...toolBtn,
              padding: '4px 8px',
              fontSize: 11,
              color: '#dc2626',
              opacity: (selectedRow === null || deleteMutation.isPending) ? 0.3 : 1,
            }}
          >
            삭제
          </button>
          <div style={{ width: 1, height: 16, background: '#e5e7eb', margin: '0 2px' }} />
          <button
            onClick={() => undo(applyUndoRedo)}
            disabled={!canUndo}
            style={{ ...toolBtn, padding: '4px 8px', fontSize: 11, opacity: canUndo ? 1 : 0.3 }}
            title="Ctrl+Z"
          >
            되돌리기
          </button>
          <button
            onClick={() => redo(applyUndoRedo)}
            disabled={!canRedo}
            style={{ ...toolBtn, padding: '4px 8px', fontSize: 11, opacity: canRedo ? 1 : 0.3 }}
            title="Ctrl+Shift+Z"
          >
            다시실행
          </button>
        </div>
      </header>

      {/* Grid — use absolute positioning to give DataEditor explicit dimensions */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, padding: 8 }}>
        <div style={{ position: 'absolute', inset: 8 }}>
          <DataEditor
            columns={gridColumns}
            rows={rows.length}
            getCellContent={getContent}
            onCellActivated={onCellActivated}
            onGridSelectionChange={(sel) => {
              if (sel.current?.cell) {
                setSelectedRow(sel.current.cell[1]);
              }
            }}
            smoothScrollX
            smoothScrollY
            rowMarkers="clickable-number"
            getCellsForSelection={true}
            keybindings={{ search: true }}
            theme={gridTheme}
            rowHeight={28}
            width="100%"
            height="100%"
          />
        </div>
      </div>

      {/* Edit Modal */}
      <AdminEditModal
        columns={columns}
        row={editingRow}
        isOpen={isModalOpen}
        isCreateMode={isCreateMode}
        onSave={handleModalSave}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRow(null);
        }}
      />
    </div>
  );
}

const toolBtn: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 500,
  color: '#374151',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 5,
  cursor: 'pointer',
};
