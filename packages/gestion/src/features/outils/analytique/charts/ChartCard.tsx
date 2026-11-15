'use client';

import { Download, Ellipsis, Maximize2, Table as TableIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  cx,
} from '@eguardimmo/ui';
import { DataTable, Td, Th } from '../../kit';
import { displayCell, downloadCsv } from '../csv';
import type { Dataset } from '../csv';
import { ChartViewContext } from './chartParts';
import type { ChartView } from './chartParts';

export interface ChartCardProps {
  id: string;
  title: string;
  dataset: Dataset;
  csvName: string;
  legend?: ReactNode;
  note?: ReactNode;
  footer?: ReactNode;
  tableless?: boolean;
  className?: string;
  children: (view: ChartView) => ReactNode;
}

function DatasetTable({ title, dataset, visible }: { title: string; dataset: Dataset; visible: boolean }) {
  const table = (
    <DataTable caption={`Données : ${title}`} className={visible ? undefined : 'sr-only'}>
      <thead>
        <tr>
          {dataset.columns.map((column, index) => (
            <Th key={column} numeric={index > 0}>
              {column}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {dataset.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) =>
              cellIndex === 0 ? (
                <th key={cellIndex} scope="row" className="h-9 border-b border-line px-2 text-left font-medium whitespace-nowrap text-fg">
                  {displayCell(cell)}
                </th>
              ) : (
                <Td key={cellIndex} numeric>
                  {displayCell(cell)}
                </Td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
  return visible ? <div className="border-t border-line pt-2">{table}</div> : table;
}

export function ChartCard({
  id,
  title,
  dataset,
  csvName,
  legend,
  note,
  footer,
  tableless = false,
  className,
  children,
}: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  const [open, setOpen] = useState(false);
  const exportCsv = () => { downloadCsv(csvName, dataset); };

  return (
    <Card role="region" aria-labelledby={id} className={cx('px-4 py-3', className)}>
      <CardHeader className="flex-wrap">
        <CardTitle as="h2" id={id}>
          {title}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {legend}
          {note ? <span className="text-caption text-fg-subtle">{note}</span> : null}
          <span className="flex items-center gap-0.5">
            <IconButton label="Agrandir le visuel" icon={Maximize2} onClick={() => { setOpen(true); }} />
            <Menu>
              <MenuTrigger asChild>
                <IconButton label="Options du visuel" icon={Ellipsis} />
              </MenuTrigger>
              <MenuContent width="md">
                {tableless ? null : (
                  <MenuItem icon={TableIcon} onSelect={() => { setShowTable((current) => !current); }}>
                    {showTable ? 'Masquer le tableau de données' : 'Afficher le tableau de données'}
                  </MenuItem>
                )}
                <MenuItem icon={Download} onSelect={exportCsv}>
                  Exporter en CSV
                </MenuItem>
              </MenuContent>
            </Menu>
          </span>
        </div>
      </CardHeader>
      <ChartViewContext value={{ expanded: false }}>{children({ expanded: false })}</ChartViewContext>
      {tableless ? null : <DatasetTable title={title} dataset={dataset} visible={showTable} />}
      {footer}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={title} className="max-h-[92vh] w-[min(1100px,calc(100vw-32px))]">
          <div className="flex flex-col gap-3 overflow-y-auto p-4">
            {legend ? <div className="flex flex-wrap gap-3">{legend}</div> : null}
            <ChartViewContext value={{ expanded: true }}>{children({ expanded: true })}</ChartViewContext>
            {tableless ? null : <DatasetTable title={`${title} (agrandi)`} dataset={dataset} visible />}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
