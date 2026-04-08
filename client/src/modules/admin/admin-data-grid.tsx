import { useCallback, useMemo, useState } from 'react';
import DataEditor, {
  type GridColumn,
  type GridCell,
  type EditableGridCell,
  GridCellKind,
  type Item,
} from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';

export interface ColumnDef {
  key: string;
  title: string;
  width?: number;
  kind?: GridCellKind;
  readonly?: boolean;
}

interface AdminDataGridProps {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  onCellEdited?: (rowIndex: number, colKey: string, newValue: unknown) => void;
  onRowAdded?: () => void;
  onRowDeleted?: (rowIndex: number) => void;
}

export default function AdminDataGrid({
  columns,
  rows,
  onCellEdited,
}: AdminDataGridProps) {
  const [searchText, _setSearchText] = useState('');
  // TODO: setSearchText will be wired to toolbar search input in Phase 1-3
  void _setSearchText;

  const gridColumns: GridColumn[] = useMemo(
    () =>
      columns.map((col) => ({
        id: col.key,
        title: col.title,
        width: col.width ?? 150,
      })),
    [columns],
  );

  const filteredRows = useMemo(() => {
    if (!searchText) return rows;
    const lower = searchText.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((v) =>
        String(v ?? '').toLowerCase().includes(lower),
      ),
    );
  }, [rows, searchText]);

  const getContent = useCallback(
    ([col, row]: Item): GridCell => {
      const colDef = columns[col];
      const rowData = filteredRows[row];
      if (!colDef || !rowData) {
        return { kind: GridCellKind.Text, data: '', displayData: '', allowOverlay: false };
      }

      const value = rowData[colDef.key];
      const displayValue = value === null || value === undefined
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
        return {
          kind: GridCellKind.Boolean,
          data: Boolean(value),
          allowOverlay: false,
        };
      }

      return {
        kind: GridCellKind.Text,
        data: displayValue,
        displayData: displayValue,
        allowOverlay: !colDef.readonly,
      };
    },
    [columns, filteredRows],
  );

  const onCellEditedHandler = useCallback(
    ([col, row]: Item, newValue: EditableGridCell) => {
      if (!onCellEdited) return;
      const colDef = columns[col];
      if (!colDef || colDef.readonly) return;

      let value: unknown;
      if (newValue.kind === GridCellKind.Number) {
        value = newValue.data;
      } else if (newValue.kind === GridCellKind.Boolean) {
        value = newValue.data;
      } else if (newValue.kind === GridCellKind.Text) {
        value = newValue.data;
      }

      onCellEdited(row, colDef.key, value);
    },
    [columns, onCellEdited],
  );

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', padding: 8 }}>
      <div style={{ position: 'absolute', inset: 8 }}>
        <DataEditor
          columns={gridColumns}
          rows={filteredRows.length}
          getCellContent={getContent}
          onCellEdited={onCellEditedHandler}
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
  );
}
