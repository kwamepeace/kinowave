import React from 'react';
import { motion } from 'motion/react';
import { Bookmark, Play } from 'lucide-react';
import { IptvChannel } from '../utils/m3uParser';
import { ChannelArtwork } from './ChannelArtwork';

interface ChannelCardProps {
  channel: IptvChannel;
  isActive: boolean;
  isSaved: boolean;
  viewMode?: 'grid' | 'epg';
  onSelect: (channel: IptvChannel) => void;
  onToggleSave: (channelId: string) => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  isActive,
  isSaved,
  viewMode = 'grid',
  onSelect,
  onToggleSave,
}) => {
  const remainingMinutes = Math.max(5, Math.round((100 - channel.programProgress) * 0.6));

  if (viewMode === 'epg') {
    return (
      <motion.article
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className={`group rounded-2xl bg-[#10141F] border p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
          isActive
            ? 'border-[#E11D48] bg-[#161320]'
            : 'border-white/[0.07] hover:border-white/20'
        }`}
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onSelect(channel)}
            aria-label={`Tune to ${channel.name}: ${channel.currentProgram}`}
            className="relative w-32 sm:w-40 aspect-video rounded-xl overflow-hidden shrink-0 cursor-pointer"
          >
            <ChannelArtwork
              channel={channel}
              showCallSign={false}
              className="w-full h-full group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="w-9 h-9 rounded-full bg-[#E11D48] text-white flex items-center justify-center shadow-md">
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
              <div
                className="h-full bg-[#E11D48]"
                style={{ width: `${channel.programProgress}%` }}
              />
            </div>
          </button>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{channel.category}</span>
              <span aria-hidden="true">·</span>
              <span>{channel.country}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">{channel.resolution}</span>
            </div>
            <h3 className="text-base font-bold text-white truncate">
              <button
                type="button"
                onClick={() => onSelect(channel)}
                className="text-left hover:text-[#FB7185] transition-colors cursor-pointer"
              >
                {channel.name}
              </button>
            </h3>
            <p className="text-xs text-slate-300 truncate">
              On Air: <span className="text-white font-medium">{channel.currentProgram}</span>
            </p>
            <p className="text-[11px] text-slate-400 truncate">Up Next: {channel.nextProgram}</p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06]">
          <button
            type="button"
            onClick={() => onSelect(channel)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-[#E11D48] text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isActive ? 'Playing Now' : 'Watch Stream'}
          </button>
          <button
            type="button"
            onClick={() => onToggleSave(channel.id)}
            aria-label={
              isSaved
                ? `Remove ${channel.name} from Watchlist`
                : `Save ${channel.name} to Watchlist`
            }
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <Bookmark
              className={`w-4 h-4 ${isSaved ? 'fill-[#E11D48] text-[#E11D48]' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative rounded-3xl overflow-hidden bg-[#10141F] border transition-all duration-200 flex flex-col justify-between ${
        isActive
          ? 'border-[#E11D48] ring-1 ring-[#E11D48]/60 shadow-xl shadow-[#E11D48]/10'
          : 'border-white/[0.08] hover:border-white/25 hover:-translate-y-1 shadow-lg shadow-black/40'
      }`}
    >
      {/* Top 16:9 Cinema Scene Preview Button */}
      <div className="relative aspect-video w-full overflow-hidden bg-[#080A10]">
        <button
          type="button"
          onClick={() => onSelect(channel)}
          aria-label={`Tune to ${channel.name}: ${channel.currentProgram}`}
          className="w-full h-full block text-left focus:outline-none cursor-pointer"
        >
          <ChannelArtwork
            channel={channel}
            className="w-full h-full group-hover:scale-105 transition-transform duration-500 ease-out"
          />

          {/* Lower-Third Program Title Overlay on Artwork */}
          <div className="absolute inset-x-0 bottom-0 p-3.5 pt-8 bg-gradient-to-t from-[#07090E] via-[#07090E]/75 to-transparent">
            <div className="flex items-center justify-between gap-2 text-[11px] text-white/75 font-mono-tabular mb-0.5">
              <span>{isActive ? 'ON AIR NOW' : 'LIVE STREAM'}</span>
              <span>{remainingMinutes}m left</span>
            </div>
            <div className="text-xs font-semibold text-white line-clamp-1">
              {channel.currentProgram}
            </div>
          </div>

          {/* Bottom Glowing Progress Strip */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
            <div
              className="h-full bg-gradient-to-r from-[#E11D48] to-[#FB7185]"
              style={{ width: `${channel.programProgress}%` }}
            />
          </div>

          {/* Center Glassmorphic Play Affordance */}
          <div
            className={`absolute inset-0 flex items-center justify-center bg-black/25 transition-opacity duration-200 ${
              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <span className="w-12 h-12 rounded-full bg-[#E11D48]/95 text-white flex items-center justify-center shadow-xl shadow-black/50 scale-95 group-hover:scale-100 transition-transform duration-200">
              <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden="true" />
            </span>
          </div>
        </button>

        {/* Watchlist Bookmark Button (44x44px hitbox for mobile touch compliance) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(channel.id);
          }}
          aria-label={
            isSaved
              ? `Remove ${channel.name} from Watchlist`
              : `Save ${channel.name} to Watchlist`
          }
          className="absolute top-2 right-2 min-h-[44px] min-w-[44px] rounded-2xl flex items-center justify-center text-white/90 hover:text-white bg-black/50 hover:bg-black/75 backdrop-blur-md border border-white/10 transition-colors cursor-pointer"
        >
          <Bookmark
            className={`w-4 h-4 ${isSaved ? 'fill-[#E11D48] text-[#E11D48]' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Card Body: Clean Unboxed Metadata + Channel Station Title + Up Next Footer */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3.5">
        <div className="space-y-1">
          {/* Unboxed Metadata with Typographic Separators (Zero-Pill Rule) */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-slate-300 font-medium">{channel.category}</span>
            <span aria-hidden="true">·</span>
            <span>{channel.country}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{(channel.bitrateKbps / 1000).toFixed(1)} Mbps</span>
          </div>

          <h3 className="text-base font-bold text-white leading-snug">
            <button
              type="button"
              onClick={() => onSelect(channel)}
              className="text-left hover:text-[#FB7185] transition-colors cursor-pointer"
            >
              {channel.name}
            </button>
          </h3>
        </div>

        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2 text-xs text-slate-400">
          <span className="truncate">Next: {channel.nextProgram}</span>
          <button
            type="button"
            onClick={() => onSelect(channel)}
            className="font-semibold text-white hover:text-[#FB7185] transition-colors shrink-0 cursor-pointer"
          >
            {isActive ? 'Tuning' : 'Tune In →'}
          </button>
        </div>
      </div>
    </motion.article>
  );
};
