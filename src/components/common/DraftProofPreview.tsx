import React from 'react';
import { CheckCircle2, Maximize2, Upload, Trash2, Eye, FileCheck } from 'lucide-react';
import { useObjectUrl } from '../../hooks/useObjectUrl';

export interface DraftProofPreviewProps {
  taskId: string;
  taskTitle: string;
  file: File;
  onChangeFile: () => void;
  onDeleteFile: () => void;
  onOpenPreview: (data: {
    url: string;
    title: string;
    filename: string;
    size: string;
    isDraft: boolean;
    onChangeFile: () => void;
    onDeleteFile: () => void;
  }) => void;
}

/**
 * Displays a staged screenshot preview with memoized object URL management and full zoom inspection.
 */
export const DraftProofPreview: React.FC<DraftProofPreviewProps> = ({
  taskTitle,
  file,
  onChangeFile,
  onDeleteFile,
  onOpenPreview,
}) => {
  const previewUrl = useObjectUrl(file);
  const sizeLabel = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

  const openModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!previewUrl) return;
    onOpenPreview({
      url: previewUrl,
      title: taskTitle,
      filename: file.name,
      size: sizeLabel,
      isDraft: true,
      onChangeFile,
      onDeleteFile,
    });
  };

  return (
    <div className="w-full border-2 border-emerald-400 bg-emerald-50/70 rounded-2xl p-4 md:p-5 flex flex-col gap-3.5 shadow-sm transition-all">
      {/* Staged Proof Top Metadata Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200/80 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-800">Proof Screenshot Loaded</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-extrabold border border-emerald-300">Draft</span>
            </div>
            <p className="text-xs text-zinc-800 font-bold truncate max-w-xs md:max-w-md mt-0.5" title={file.name}>
              {file.name}
            </p>
          </div>
        </div>

        {/* Preview Controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={openModal}
            className="text-xs font-bold text-indigo-700 hover:text-indigo-950 bg-white hover:bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Open 350% pan & zoom high-resolution preview modal"
          >
            <Maximize2 size={13} /> Fullscreen Zoom
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChangeFile();
            }}
            className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-white hover:bg-zinc-100 px-3 py-1.5 rounded-xl border border-zinc-200 transition-colors flex items-center gap-1 shadow-xs"
            title="Select a different screenshot"
          >
            <Upload size={13} /> Change
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFile();
            }}
            className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl border border-red-200 transition-colors flex items-center gap-1.5 shadow-xs"
            title="Remove screenshot if wrong"
          >
            <Trash2 size={13} /> Remove
          </button>
        </div>
      </div>

      {/* High-Clarity In-Card Live Preview Viewport */}
      <div
        onClick={openModal}
        className="relative w-full max-h-72 md:max-h-80 rounded-xl overflow-hidden border-2 border-emerald-300 bg-zinc-900/5 flex items-center justify-center cursor-pointer group/preview shadow-inner p-2"
        title="Click to inspect proof in 350% zoom & rotate modal"
      >
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Staged proof preview"
            className="max-h-64 md:max-h-72 w-auto max-w-full rounded-lg object-contain transition-transform duration-200 group-hover/preview:scale-[1.01]"
          />
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-2 backdrop-blur-[1px]">
          <Eye size={18} /> Click to Inspect with 350% Zoom & Pan
        </div>
        <div className="absolute bottom-3 right-3 bg-zinc-900/75 text-white text-[10px] font-semibold px-2.5 py-1 rounded-md backdrop-blur-xs flex items-center gap-1 shadow-sm">
          <span>{sizeLabel}</span>
        </div>
      </div>

      {/* Academic Verification Checklist Alert */}
      <div className="bg-white/90 border border-emerald-300/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-900">
        <FileCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold">Ready for Submission</p>
          <p className="text-[11px] text-emerald-800/90 leading-relaxed">
            Click the image preview above to zoom up to 350% and verify legibility before submitting.
          </p>
        </div>
      </div>
    </div>
  );
};
