"use client";

import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface TerminalRef {
  getTerminal: () => any;
  clear: () => void;
  write: (data: string) => void;
}

export interface TerminalProps {
  className?: string;
  readonly?: boolean;
  id: string;
  onTerminalReady?: (terminal: any) => void;
}

const getTerminalTheme = () => ({
  background: "#1e1e1e",
  foreground: "#d4d4d4",
  cursor: "#ffffff",
  cursorAccent: "#000000",
  selectionBackground: "#3a3d41",
  black: "#000000",
  red: "#f48771",
  green: "#a9dc76",
  yellow: "#ffd866",
  blue: "#78dce8",
  magenta: "#ab9df2",
  cyan: "#7dcfff",
  white: "#fcfcfa",
  brightBlack: "#5b5e66",
  brightRed: "#ff6188",
  brightGreen: "#a9dc76",
  brightYellow: "#fc9867",
  brightBlue: "#78dce8",
  brightMagenta: "#ab9df2",
  brightCyan: "#7dcfff",
  brightWhite: "#ffffff",
});

export const Terminal = memo(
  forwardRef<TerminalRef, TerminalProps>(
    ({ className, readonly, id, onTerminalReady }, ref) => {
      const terminalElementRef = useRef<HTMLDivElement>(null);
      const terminalRef = useRef<any>(null);
      const fitAddonRef = useRef<any>(null);
      const [isMounted, setIsMounted] = useState(false);

      useEffect(() => {
        setIsMounted(true);
      }, []);

      useEffect(() => {
        if (!isMounted || typeof window === "undefined") return;

        const element = terminalElementRef.current!;

        // Dynamic import to avoid SSR issues
        Promise.all([
          import("@xterm/xterm").then((mod) => mod.Terminal),
          import("@xterm/addon-fit").then((mod) => mod.FitAddon),
        ])
          .then(([XTerm, FitAddon]) => {
            const fitAddon = new FitAddon();
            fitAddonRef.current = fitAddon;

            const terminal = new XTerm({
              cursorBlink: true,
              convertEol: true,
              disableStdin: readonly,
              theme: getTerminalTheme(),
              fontSize: 13,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              scrollback: 1000,
              rightClickSelectsWord: true,
            });

            terminalRef.current = terminal;

            try {
              terminal.loadAddon(fitAddon);
              terminal.open(element);

              // Wait for renderer to be ready before fitting and notifying
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    try {
                      fitAddon.fit();
                      onTerminalReady?.(terminal);
                    } catch (e) {
                      console.error(`Failed to fit terminal [${id}]:`, e);
                      onTerminalReady?.(terminal); // Still notify even if fit fails
                    }
                  }, 50);
                });
              });
            } catch (error) {
              console.error(`Failed to initialize terminal [${id}]:`, error);
            }

            const resizeObserver = new ResizeObserver(() => {
              try {
                fitAddon.fit();
              } catch (error) {
                console.error(`Resize error [${id}]:`, error);
              }
            });

            resizeObserver.observe(element);
          })
          .catch((error) => {
            console.error("Failed to load terminal:", error);
          });

        return () => {
          try {
            if (terminalRef.current) {
              terminalRef.current.dispose();
            }
          } catch (error) {
            console.error(`Cleanup error [${id}]:`, error);
          }
        };
      }, [id, onTerminalReady, readonly, isMounted]);

      useImperativeHandle(ref, () => ({
        getTerminal: () => terminalRef.current,
        clear: () => terminalRef.current?.clear(),
        write: (data: string) => terminalRef.current?.write(data),
      }));

      if (!isMounted) {
        return (
          <div className={className}>
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Loading terminal...
            </div>
          </div>
        );
      }

      return <div className={className} ref={terminalElementRef} />;
    }
  )
);

Terminal.displayName = "Terminal";
