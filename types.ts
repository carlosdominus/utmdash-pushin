
export interface DataRow {
  [key: string]: any;
}

export interface DashboardData {
  headers: string[];
  rows: DataRow[];
  types: Record<string, 'number' | 'string'>;
  layoutType?: 'standard' | 'alternative';
}

export interface HistoryEntry {
  id: string;
  name: string;
  timestamp: number;
  data: DashboardData;
  stats: {
    vendas: number;
    faturamento: number;
  };
}

export interface FilterState {
  column: string;
  value: string | number;
}

export interface InsightResult {
  title: string;
  summary: string;
  recommendations: string[];
}

export type ViewMode = 'central' | 'utmdash' | 'graphs' | 'history';