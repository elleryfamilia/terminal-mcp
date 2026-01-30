/**
 * Recordings Manager Component
 *
 * Displays recent recordings and allows managing them.
 */

import { useEffect, useState, useCallback } from 'react';
import type { RecordingInfo } from '../../types/electron';

interface RecordingsState {
  recordings: RecordingInfo[];
  outputDir: string;
  loading: boolean;
}

export function RecordingsManager() {
  const [state, setState] = useState<RecordingsState>({
    recordings: [],
    outputDir: '',
    loading: true,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Load recordings on mount
  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const result = await window.terminalAPI.recordingsList();
      setState({
        recordings: result.recordings,
        outputDir: result.outputDir,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to load recordings:', error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleOpenFolder = useCallback(async () => {
    if (state.outputDir) {
      // Open the directory itself (show in Finder/Explorer)
      await window.terminalAPI.recordingsOpenFolder(state.outputDir);
    }
  }, [state.outputDir]);

  const handleOpenRecording = useCallback(async (filePath: string) => {
    await window.terminalAPI.recordingsOpenFolder(filePath);
  }, []);

  const handleDelete = useCallback(async (filePath: string) => {
    const result = await window.terminalAPI.recordingsDelete(filePath);
    if (result.success) {
      setDeleteConfirm(null);
      await loadRecordings();
    }
  }, []);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return '--:--';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (state.loading) {
    return (
      <div className="recordings-manager">
        <div className="recordings-loading">Loading recordings...</div>
      </div>
    );
  }

  return (
    <div className="recordings-manager">
      {/* Output directory row */}
      <div className="recordings-dir-row">
        <span className="recordings-dir-label">Output folder:</span>
        <code className="recordings-dir-path">{state.outputDir}</code>
        <button
          type="button"
          className="recordings-btn recordings-btn-small"
          onClick={handleOpenFolder}
          title="Open in Finder"
        >
          Open
        </button>
      </div>

      {/* Recordings list */}
      <div className="recordings-list-container">
        {state.recordings.length === 0 ? (
          <div className="recordings-empty">No recordings yet</div>
        ) : (
          <div className="recordings-list">
            {state.recordings.map((recording) => (
              <div key={recording.filePath} className="recording-item">
                <div className="recording-info">
                  <span className="recording-name" title={recording.filename}>
                    {recording.filename}
                  </span>
                  <div className="recording-meta">
                    <span className="recording-date">{formatDate(recording.createdAt)}</span>
                    <span className="recording-duration">{formatDuration(recording.duration)}</span>
                    <span className="recording-size">{formatSize(recording.size)}</span>
                  </div>
                </div>
                <div className="recording-actions">
                  <button
                    type="button"
                    className="recordings-btn recordings-btn-icon"
                    onClick={() => handleOpenRecording(recording.filePath)}
                    title="Show in Finder"
                  >
                    <span className="icon-folder">📂</span>
                  </button>
                  {deleteConfirm === recording.filePath ? (
                    <>
                      <button
                        type="button"
                        className="recordings-btn recordings-btn-danger"
                        onClick={() => handleDelete(recording.filePath)}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="recordings-btn recordings-btn-small"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="recordings-btn recordings-btn-icon"
                      onClick={() => setDeleteConfirm(recording.filePath)}
                      title="Delete recording"
                    >
                      <span className="icon-delete">🗑️</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
