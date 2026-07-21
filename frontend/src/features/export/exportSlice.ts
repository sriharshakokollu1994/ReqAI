import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../../services/apiClient';
import { ExportFormat, ExportJob } from '../../types';

// ─── State ────────────────────────────────────────────────────────────────────

interface ExportState {
  analysisId: string | null;
  jobs: Record<ExportFormat, ExportJob>;
}

const makeJob = (format: ExportFormat): ExportJob => ({
  format,
  isLoading:      false,
  error:          null,
  lastExportedAt: null,
});

const initialState: ExportState = {
  analysisId: null,
  jobs: {
    pdf:      makeJob('pdf'),
    docx:     makeJob('docx'),
    markdown: makeJob('markdown'),
    json:     makeJob('json'),
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MIME_TYPES: Record<ExportFormat, string> = {
  pdf:      'application/pdf',
  docx:     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  markdown: 'text/markdown',
  json:     'application/json',
};

const EXTENSIONS: Record<ExportFormat, string> = {
  pdf:      'pdf',
  docx:     'docx',
  markdown: 'md',
  json:     'json',
};

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href      = url;
  a.download  = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay to allow the download to start
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ─── Generic export thunk factory ─────────────────────────────────────────────

const createExportThunk = (format: ExportFormat) =>
  createAsyncThunk(
    `export/${format}`,
    async (analysisId: string, { rejectWithValue }) => {
      try {
        const response = await apiClient.get(`/export/${analysisId}/${format}`, {
          responseType: format === 'json' ? 'json' : 'blob',
        });

        let blob: Blob;
        if (format === 'json') {
          // apiClient parsed it as JSON; re-serialize for download
          blob = new Blob([JSON.stringify(response.data, null, 2)], {
            type: MIME_TYPES[format],
          });
        } else {
          blob = new Blob([response.data as ArrayBuffer], {
            type: MIME_TYPES[format],
          });
        }

        triggerDownload(blob, `analysis-${analysisId}.${EXTENSIONS[format]}`);
        return { format, exportedAt: new Date().toISOString() };
      } catch (err: any) {
        return rejectWithValue(
          err.response?.data?.error?.message ?? `Failed to export as ${format.toUpperCase()}`,
        );
      }
    },
  );

export const exportPdfThunk      = createExportThunk('pdf');
export const exportDocxThunk     = createExportThunk('docx');
export const exportMarkdownThunk = createExportThunk('markdown');
export const exportJsonThunk     = createExportThunk('json');

// Map format → its specific thunk (for addMatcher)
const exportThunks = [exportPdfThunk, exportDocxThunk, exportMarkdownThunk, exportJsonThunk] as const;

// ─── Slice ────────────────────────────────────────────────────────────────────

const exportSlice = createSlice({
  name: 'export',
  initialState,
  reducers: {
    setAnalysisId(state, action: PayloadAction<string | null>) {
      state.analysisId = action.payload;
    },
    clearJobs(state) {
      (Object.keys(state.jobs) as ExportFormat[]).forEach((fmt) => {
        state.jobs[fmt] = makeJob(fmt);
      });
    },
    clearExportError(state, action: PayloadAction<ExportFormat>) {
      state.jobs[action.payload].error = null;
    },
  },
  extraReducers: (builder) => {
    exportThunks.forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state, action) => {
          // action.meta.arg is the analysisId string; format is encoded in type
          const fmt = action.type.replace('export/', '').replace('/pending', '') as ExportFormat;
          state.jobs[fmt].isLoading = true;
          state.jobs[fmt].error     = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          const { format, exportedAt } = action.payload as { format: ExportFormat; exportedAt: string };
          state.jobs[format].isLoading      = false;
          state.jobs[format].lastExportedAt = exportedAt;
        })
        .addCase(thunk.rejected, (state, action) => {
          const fmt = action.type.replace('export/', '').replace('/rejected', '') as ExportFormat;
          state.jobs[fmt].isLoading = false;
          state.jobs[fmt].error     = action.payload as string;
        });
    });
  },
});

export const { setAnalysisId, clearJobs, clearExportError } = exportSlice.actions;
export default exportSlice.reducer;
