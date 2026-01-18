import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { WarningCircleIcon } from '@phosphor-icons/react/dist/ssr';
import RawLogText from '@/components/common/RawLogText';
import type { PatchType } from 'shared/types';

export type LogEntry = Extract<
  PatchType,
  { type: 'STDOUT' } | { type: 'STDERR' }
>;

export interface VirtualizedProcessLogsProps {
  logs: LogEntry[];
  error: string | null;
  searchQuery: string;
  matchIndices: number[];
  currentMatchIndex: number;
}

type LogEntryWithKey = LogEntry & { key: string; originalIndex: number };

export function VirtualizedProcessLogs({
  logs,
  error,
  searchQuery,
  matchIndices,
  currentMatchIndex,
}: VirtualizedProcessLogsProps) {
  const { t } = useTranslation('tasks');
  const parentRef = useRef<HTMLDivElement>(null);
  const didInitScroll = useRef(false);
  const prevLogsLengthRef = useRef(0);
  const prevCurrentMatchRef = useRef<number | undefined>(undefined);
  const [atBottom, setAtBottom] = useState(true);

  // Add keys and original index to log entries
  const logsWithKeys: LogEntryWithKey[] = logs.map((entry, index) => ({
    ...entry,
    key: `log-${index}`,
    originalIndex: index,
  }));

  const virtualizer = useVirtualizer({
    count: logsWithKeys.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 10,
  });

  // Check if user is at bottom of scroll
  const checkAtBottom = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const threshold = 50;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setAtBottom(isAtBottom);
  }, []);

  // Initial scroll to bottom
  useEffect(() => {
    if (!didInitScroll.current && logs.length > 0) {
      didInitScroll.current = true;
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(logs.length - 1, { align: 'end' });
      });
    }
  }, [logs.length, virtualizer]);

  // Auto-scroll to bottom on new logs if user is at bottom
  useEffect(() => {
    const prev = prevLogsLengthRef.current;
    const grewBy = logs.length - prev;
    prevLogsLengthRef.current = logs.length;

    if (grewBy > 0 && atBottom && logs.length > 0) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(logs.length - 1, { align: 'end' });
      });
    }
  }, [logs.length, atBottom, virtualizer]);

  // Scroll to current match when it changes
  useEffect(() => {
    if (
      matchIndices.length > 0 &&
      currentMatchIndex >= 0 &&
      currentMatchIndex !== prevCurrentMatchRef.current
    ) {
      const logIndex = matchIndices[currentMatchIndex];
      virtualizer.scrollToIndex(logIndex, { align: 'center' });
      prevCurrentMatchRef.current = currentMatchIndex;
    }
  }, [currentMatchIndex, matchIndices, virtualizer]);

  if (logs.length === 0 && !error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-center text-muted-foreground text-sm">
          {t('processes.noLogsAvailable')}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-center text-destructive text-sm">
          <WarningCircleIcon className="size-icon-base inline mr-2" />
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div
        ref={parentRef}
        className="h-full overflow-auto"
        onScroll={checkAtBottom}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const data = logsWithKeys[virtualRow.index];
            const isMatch = matchIndices.includes(data.originalIndex);
            const isCurrentMatch =
              matchIndices[currentMatchIndex] === data.originalIndex;

            return (
              <div
                key={data.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <RawLogText
                  content={data.content}
                  channel={data.type === 'STDERR' ? 'stderr' : 'stdout'}
                  className="text-sm px-4 py-1"
                  linkifyUrls
                  searchQuery={isMatch ? searchQuery : undefined}
                  isCurrentMatch={isCurrentMatch}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
