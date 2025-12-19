'use client';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';

import { Greeting } from '@/components/chat/greeting';

import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from '@/components/ai-elements/message';

import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useChat } from '@ai-sdk/react';
import { ThumbsDown, ThumbsUp, CopyIcon, RefreshCcwIcon, SquareIcon } from 'lucide-react';

import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources';

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';

import { Skeleton } from '@/components/chat/skeleton';
import { useConversation } from '@/components/chat/conversation-context';

export const Chat = () => {
  
  const [input, setInput] = useState('');
  const [isOptimisticSubmitting, setIsOptimisticSubmitting] = useState(false);
  const { conversationId, setConversationId, requestOrderRefresh } = useConversation();
  // const [model, setModel] = useState<string>(models[0].value);
  const [webSearch, setWebSearch] = useState(false);
  const creationPromiseRef = useRef<Promise<string> | null>(null);
  const { messages, sendMessage, status, regenerate, stop } = useChat();
  const isAgentRunning = useMemo(
    () => status === 'streaming' || status === 'submitted',
    [status],
  );
  const showStopAction = false;

  const previousStatusRef = useRef(status);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    const wasProcessing =
      previousStatus === 'streaming' || previousStatus === 'submitted';
    const completedStatuses: Array<typeof status> = ['ready'];
    if (wasProcessing && completedStatuses.includes(status) && conversationId) {
      requestOrderRefresh();
    }
    previousStatusRef.current = status;
  }, [status, conversationId, requestOrderRefresh]);

  useEffect(() => {
    if (status === 'submitted' || status === 'streaming' || status === 'ready') {
      setIsOptimisticSubmitting(false);
    }
  }, [status]);

  // Track the final assistant message so we only show action buttons on the most recent reply.
  const lastAssistantMessageId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  const ensureConversationId = useCallback(async () => {
    if (conversationId) {
      return conversationId;
    }

    if (!creationPromiseRef.current) {
      const creationPromise = (async () => {
        const response = await fetch('/api/conversations', {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to create conversation');
        }

        const data = (await response.json()) as { id: string };
        setConversationId(data.id);
        return data.id;
      })();

      creationPromiseRef.current = creationPromise;

      creationPromise.finally(() => {
        creationPromiseRef.current = null;
      });
    }

    return creationPromiseRef.current!;
  }, [conversationId]);


  const handleSubmit = async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text?.trim());
    const hasAttachments = Boolean(message.files?.length);
    if (!(hasText || hasAttachments) || isAgentRunning) {
      return;
    }
    setIsOptimisticSubmitting(true);
    try {
      const ensuredConversationId = await ensureConversationId();
      sendMessage(
        { 
          text: message.text || 'Sent with attachments',
          files: message.files 
        },
        {
          body: {
            conversationId: ensuredConversationId,
          },
        },
      );
      setInput('');
    } catch (error) {
      setIsOptimisticSubmitting(false);
      console.error('Unable to start conversation', error);
    }
  };

  const handleRegenerate = useCallback(
    async (messageId?: string) => {
      try {
        const ensuredConversationId = await ensureConversationId();
        await regenerate({
          body: {
            conversationId: ensuredConversationId,
          },
          messageId,
        });
      } catch (error) {
        console.error('Unable to regenerate response', error);
      }
    },
    [ensureConversationId, regenerate],
  );
  
  return (
    <div className="relative h-[calc(100svh-64px)] w-full overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
        <Conversation className="h-full">
          <ConversationContent className='overflow-y-auto
            [&::-webkit-scrollbar]:w-2
            [&::-webkit-scrollbar-track]:rounded-full
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb]:bg-gray-300
            dark:[&::-webkit-scrollbar-track]:bg-neutral-700
            dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500'>

            {messages.length === 0 && ( <Greeting /> )}
            {messages.map((message) => {
              const sourceEntries =
                message.role === 'assistant'
                  ? [
                      // Direct source-url parts streamed by the backend.
                      ...message.parts
                        .filter((part) => part.type === 'source-url')
                        .map((part) => ({
                          url: (part as any).url as string,
                          title: ((part as any).title as string) ?? (part as any).url,
                        })),
                      // docsSearch tool outputs sometimes only surface sources on the tool part.
                      ...message.parts
                        .filter((part) => part.type === 'tool-docsSearch')
                        .flatMap((part) => {
                          const outputSources = Array.isArray((part as any).output?.sources)
                            ? (part as any).output.sources
                            : [];
                          return outputSources
                            .filter((source: any) => typeof source?.url === 'string')
                            .map((source: any) => ({
                              url: source.url as string,
                              title: (source.path as string) ?? source.url,
                            }));
                        }),
                    ]
                  : [];

              return (
                <div key={message.id}>

                  {sourceEntries.length > 0 && (
                    // Display a collapsible section containing every cited source.
                    <Sources>
                      <SourcesTrigger className='cursor-pointer' count={sourceEntries.length} />
                      <SourcesContent>
                        {sourceEntries.map((source, i) => (
                          <Source key={`${message.id}-${i}`} href={source.url} title={source.url.split("/").pop()} />
                        ))}
                      </SourcesContent>
                    </Sources>
                  )}
                  
                  {message.parts.map((part, i) => {
                    switch (part.type) {
                      case 'text':
                        return (
                          <Message key={`${message.id}-${i}`} from={message.role}>
                            <MessageContent>
                              <MessageResponse>
                                {part.text}
                              </MessageResponse>
                            </MessageContent>
                          {message.role === 'assistant' && message.id === lastAssistantMessageId && (
                            <MessageActions>
                              <MessageAction
                                onClick={() =>
                                  console.log('Feedback: Bad response')
                                }
                                label="No me sirve"
                              >
                                <ThumbsDown className="size-3" />
                              </MessageAction>
                              <MessageAction
                                onClick={() =>
                                  console.log('Feedback: Good response')
                                }
                                label="Buena respuesta!"
                              >
                                <ThumbsUp className="size-3" />
                              </MessageAction>
                              <MessageAction
                                onClick={() => {
                                  void handleRegenerate(message.id);
                                }}
                                label="Retry"
                              >
                                <RefreshCcwIcon className="size-3" />
                              </MessageAction>
                              <MessageAction
                                onClick={() =>
                                  navigator.clipboard.writeText(part.text)
                                }
                                label="Copy"
                              >
                                <CopyIcon className="size-3" />
                              </MessageAction>
                            </MessageActions>
                          )}
                        </Message>
                      );
                    case 'reasoning':
                      return (
                        <Reasoning
                          key={`${message.id}-${i}`}
                          className="w-full"
                          isStreaming={status === 'streaming' && message.id === messages.at(-1)?.id}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    default:
                      return null;
                  }
                })}
                </div>
              );
            })}
            {(status === 'submitted' ) && <Skeleton />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput onSubmit={handleSubmit} className="mt-4" globalDrop multiple>
          {/* <PromptInputHeader>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
          </PromptInputHeader> */}
          <PromptInputBody>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
              className='pt-5'
            />
          </PromptInputBody>
          <PromptInputFooter>

            
            <PromptInputSubmit
              className='ml-auto cursor-pointer'
              disabled={isAgentRunning || isOptimisticSubmitting}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};
