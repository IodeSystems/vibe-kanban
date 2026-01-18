import { useEffect, useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import DisplayConversationEntry from '../NormalizedConversation/DisplayConversationEntry';
import { useEntries } from '@/contexts/EntriesContext';
import {
  AddEntryType,
  PatchTypeWithKey,
  useConversationHistory,
} from '@/hooks/useConversationHistory';
import { Loader2 } from 'lucide-react';
import { TaskWithAttemptStatus } from 'shared/types';
import type { WorkspaceWithSession } from '@/types/attempt';
import { ApprovalFormProvider } from '@/contexts/ApprovalFormContext';

interface VirtualizedListProps {
  attempt: WorkspaceWithSession;
  task?: TaskWithAttemptStatus;
}

const VirtualizedList = ({ attempt, task }: VirtualizedListProps) => {
  const [entries, setEntriesState] = useState<PatchTypeWithKey[]>([]);
  const [loading, setLoading] = useState(true);
  const { setEntries, reset } = useEntries();
  const parentRef = useRef<HTMLDivElement>(null);
  const didInitScroll = useRef(false);
  const prevEntriesLengthRef = useRef(0);
  const [atBottom, setAtBottom] = useState(true);
  const addTypeRef = useRef<AddEntryType>('initial');

  useEffect(() => {
    setLoading(true);
    setEntriesState([]);
    didInitScroll.current = false;
    prevEntriesLengthRef.current = 0;
    reset();
  }, [attempt.id, reset]);

  const onEntriesUpdated = useCallback(
    (
      newEntries: PatchTypeWithKey[],
      addType: AddEntryType,
      newLoading: boolean
    ) => {
      addTypeRef.current = addType;
      setEntriesState(newEntries);
      setEntries(newEntries);

      if (loading) {
        setLoading(newLoading);
      }
    },
    [setEntries, loading]
  );

  useConversationHistory({ attempt, onEntriesUpdated });

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimate for conversation entries (they vary in size)
    overscan: 5,
  });

  // Check if user is at bottom of scroll
  const checkAtBottom = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const threshold = 100;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setAtBottom(isAtBottom);
  }, []);

  // Initial scroll to bottom once data appears
  useEffect(() => {
    if (!didInitScroll.current && entries.length > 0 && !loading) {
      didInitScroll.current = true;
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(entries.length - 1, { align: 'end' });
      });
    }
  }, [entries.length, loading, virtualizer]);

  // Auto-scroll on new entries if at bottom
  useEffect(() => {
    const prev = prevEntriesLengthRef.current;
    const grewBy = entries.length - prev;
    prevEntriesLengthRef.current = entries.length;

    if (grewBy > 0 && atBottom && entries.length > 0 && didInitScroll.current) {
      const addType = addTypeRef.current;
      if (addType === 'running' || addType === 'plan') {
        requestAnimationFrame(() => {
          virtualizer.scrollToIndex(entries.length - 1, { align: 'end' });
        });
      }
    }
  }, [entries.length, atBottom, virtualizer]);

  return (
    <ApprovalFormProvider>
      <div
        ref={parentRef}
        className="flex-1 h-full overflow-auto"
        onScroll={checkAtBottom}
      >
        <div className="h-2" /> {/* Header spacer */}
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const data = entries[virtualRow.index];

            if (data.type === 'STDOUT') {
              return (
                <div
                  key={`l-${data.patchKey}`}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <p>{data.content}</p>
                </div>
              );
            }
            if (data.type === 'STDERR') {
              return (
                <div
                  key={`l-${data.patchKey}`}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <p>{data.content}</p>
                </div>
              );
            }
            if (data.type === 'NORMALIZED_ENTRY') {
              return (
                <div
                  key={`l-${data.patchKey}`}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <DisplayConversationEntry
                    expansionKey={data.patchKey}
                    entry={data.content}
                    executionProcessId={data.executionProcessId}
                    taskAttempt={attempt}
                    task={task}
                  />
                </div>
              );
            }

            return null;
          })}
        </div>
        <div className="h-2" /> {/* Footer spacer */}
      </div>
      {loading && (
        <div className="float-left top-0 left-0 w-full h-full bg-primary flex flex-col gap-2 justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Loading History</p>
        </div>
      )}
    </ApprovalFormProvider>
  );
};

export default VirtualizedList;
