export interface SyncMarker {
  line: number;
  page: number;
  x: number;
  y: number;
}

export interface RawSyncMarkerEntry {
  value?: {
    line?: number;
    loc?: {
      page?: number;
      x?: string;
      y?: string;
    };
  };
}
