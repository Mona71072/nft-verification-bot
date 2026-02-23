import { createContext, useContext } from 'react';

type NavigateFn = (path: string) => void;

const ScxtNavContext = createContext<NavigateFn | null>(null);

export function ScxtNavProvider({
  children,
  onNavigate,
}: {
  children: React.ReactNode;
  onNavigate: NavigateFn;
}) {
  return (
    <ScxtNavContext.Provider value={onNavigate}>
      {children}
    </ScxtNavContext.Provider>
  );
}

export function useScxtNav(): NavigateFn | undefined {
  return useContext(ScxtNavContext) ?? undefined;
}
