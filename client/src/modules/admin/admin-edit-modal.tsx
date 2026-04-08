import { useEffect, useState } from 'react';
import { GridCellKind } from '@glideapps/glide-data-grid';
import type { ColumnDef } from './admin-data-grid';
import FacilityShapeSelector from './facility-shape-selector';

interface AdminEditModalProps {
  columns: ColumnDef[];
  row: Record<string, unknown> | null;
  isOpen: boolean;
  isCreateMode: boolean;
  onSave: (rowData: Record<string, unknown>) => void;
  onClose: () => void;
}

export default function AdminEditModal({
  columns,
  row,
  isOpen,
  isCreateMode,
  onSave,
  onClose,
}: AdminEditModalProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen && row) {
      setFormData({ ...row });
    } else if (isOpen && isCreateMode) {
      const newData: Record<string, unknown> = {};
      for (const col of columns) {
        if (!col.readonly) {
          if (col.kind === GridCellKind.Number) newData[col.key] = 0;
          else if (col.kind === GridCellKind.Boolean) newData[col.key] = false;
          else newData[col.key] = '';
        }
      }
      setFormData(newData);
    }
  }, [isOpen, row, isCreateMode, columns]);

  const handleChange = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(formData);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const title = isCreateMode ? '항목 추가' : '항목 수정';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 6,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
          maxWidth: 560,
          maxHeight: '80vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#111827',
              margin: 0,
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              color: '#9ca3af',
              cursor: 'pointer',
              padding: 0,
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Form Content */}
        <div
          style={{
            padding: '16px',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
            }}
          >
            {columns.map((col) => {
              const value = formData[col.key];
              const isReadonly = col.readonly;
              const isJson = col.key.toLowerCase().includes('json');
              const isShapeJson = col.key === 'shapeJson';
              const kind = col.kind ?? GridCellKind.Text;

              return (
                <div
                  key={col.key}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    gridColumn: isJson ? '1 / -1' : 'auto',
                  }}
                >
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: '#374151',
                    }}
                  >
                    {col.title}
                  </label>

                  {isShapeJson ? (
                    <FacilityShapeSelector
                      selectedCells={Array.isArray(value) ? value : undefined}
                      onSelect={(cells) => handleChange(col.key, cells)}
                    />
                  ) : isJson ? (
                    <textarea
                      value={
                        typeof value === 'object'
                          ? JSON.stringify(value, null, 2)
                          : String(value ?? '')
                      }
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          handleChange(col.key, parsed);
                        } catch {
                          handleChange(col.key, e.target.value);
                        }
                      }}
                      disabled={isReadonly}
                      style={{
                        padding: '6px 8px',
                        fontSize: 11,
                        fontFamily: 'monospace',
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        outline: 'none',
                        background: isReadonly ? '#f3f4f6' : '#fff',
                        color: '#111827',
                        minHeight: '80px',
                        resize: 'vertical',
                      }}
                    />
                  ) : kind === GridCellKind.Number ? (
                    <input
                      type="number"
                      value={value ?? 0}
                      onChange={(e) =>
                        handleChange(col.key, Number(e.target.value))
                      }
                      disabled={isReadonly}
                      style={{
                        padding: '6px 8px',
                        fontSize: 11,
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        outline: 'none',
                        background: isReadonly ? '#f3f4f6' : '#fff',
                        color: '#111827',
                      }}
                    />
                  ) : kind === GridCellKind.Boolean ? (
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) =>
                        handleChange(col.key, e.target.checked)
                      }
                      disabled={isReadonly}
                      style={{
                        width: 18,
                        height: 18,
                        cursor: isReadonly ? 'not-allowed' : 'pointer',
                        accentColor: '#2563eb',
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(value ?? '')}
                      onChange={(e) => handleChange(col.key, e.target.value)}
                      disabled={isReadonly}
                      style={{
                        padding: '6px 8px',
                        fontSize: 11,
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        outline: 'none',
                        background: isReadonly ? '#f3f4f6' : '#fff',
                        color: '#111827',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 500,
              color: '#374151',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 4,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 500,
              color: '#fff',
              background: '#2563eb',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
