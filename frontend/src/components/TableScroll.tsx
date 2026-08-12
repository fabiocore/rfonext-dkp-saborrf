import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Envolve uma <table> larga demais pra tela. Além da rolagem normal
 * (scrollbar/trackpad), mostra setas clicáveis fixas acima da tabela —
 * arrastar a scrollbar native/estilizada nem sempre funciona bem
 * dependendo do mouse/SO, e numa tabela com muitas linhas ela só fica
 * visível depois de rolar até o fim da lista. As setas resolvem os dois
 * problemas: sempre visíveis, sempre clicáveis.
 */
export function TableScroll({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => observer.disconnect();
  });

  function scrollByAmount(amount: number) {
    scrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  }

  return (
    <div>
      {(canScrollLeft || canScrollRight) && (
        <div className="table-scroll-arrows">
          <button
            type="button"
            onClick={() => scrollByAmount(-320)}
            disabled={!canScrollLeft}
            aria-label="Rolar tabela para a esquerda"
          >
            ← Rolar
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(320)}
            disabled={!canScrollRight}
            aria-label="Rolar tabela para a direita"
          >
            Rolar →
          </button>
        </div>
      )}
      <div className="table-scroll" ref={scrollRef} onScroll={updateArrows}>
        {children}
      </div>
    </div>
  );
}
