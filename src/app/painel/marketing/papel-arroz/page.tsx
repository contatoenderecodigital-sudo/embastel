"use client";

import { useMemo, useRef, useState } from "react";
import {
  AREA_UTIL_ALTURA_MM,
  AREA_UTIL_LARGURA_MM,
  DIAMETROS_CM,
  MARGEM_MM,
  calcularLayoutTags,
  medidaQuadrado,
  montarPromptPapelArroz,
  type Formato,
  type TamanhoQuadrado,
} from "@/lib/papelArroz";

type Modo = "topo" | "tags";

export default function PapelArrozPage() {
  const [modo, setModo] = useState<Modo>("topo");

  // ----------------------------------------------------------- arte comum
  const [imagem, setImagem] = useState<string | null>(null);
  const [tema, setTema] = useState("");
  const [nome, setNome] = useState("");
  const [idade, setIdade] = useState("");
  const [descricao, setDescricao] = useState("");
  const [promptGerado, setPromptGerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);

  // ------------------------------------------------------------ topo bolo
  const [formato, setFormato] = useState<Formato>("redondo");
  const [diametroCm, setDiametroCm] = useState(20);
  const [tamanhoQuadrado, setTamanhoQuadrado] = useState<TamanhoQuadrado>("20x25");

  // ---------------------------------------------------------------- tags
  const [tagDiametroCm, setTagDiametroCm] = useState(5);

  function carregarImagem(arquivo: File | undefined) {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => setImagem(String(leitor.result));
    leitor.readAsDataURL(arquivo);
  }

  function gerarPrompt() {
    if (!tema.trim()) return;
    const texto = montarPromptPapelArroz({
      tema,
      nome,
      idade,
      descricao,
      formato,
    });
    setPromptGerado(texto);
    setCopiado(false);
  }

  async function copiarPrompt() {
    if (!promptGerado) return;
    await navigator.clipboard.writeText(promptGerado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const layoutTags = useMemo(
    () => calcularLayoutTags(tagDiametroCm),
    [tagDiametroCm]
  );

  const medidaTopo = useMemo(() => {
    if (formato === "redondo") {
      const lado = diametroCm * 10;
      return { larguraMm: lado, alturaMm: lado };
    }
    return medidaQuadrado(tamanhoQuadrado);
  }, [formato, diametroCm, tamanhoQuadrado]);

  const cabeNaFolha =
    medidaTopo.larguraMm <= AREA_UTIL_LARGURA_MM &&
    medidaTopo.alturaMm <= AREA_UTIL_ALTURA_MM;

  const podeImprimir = Boolean(imagem) && (modo === "tags" || cabeNaFolha);

  return (
    <div className="space-y-6">
      {/* =============================== TELA (some na impressão) ========= */}
      <div className="tela-only space-y-6">
        <div>
          <h1 className="text-[25px] font-bold tracking-tight text-neutral-900">
            Papel de arroz
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Monta a folha A4 no tamanho exato pra imprimir e recortar. As medidas
            saem em centímetro de verdade na régua.
          </p>
        </div>

        <div className="flex w-fit gap-1 rounded-xl border border-neutral-200 bg-white p-1 text-sm font-medium shadow-sm">
          <button
            onClick={() => setModo("topo")}
            className={`rounded-lg px-4 py-1.5 transition-colors ${
              modo === "topo"
                ? "brand-gradient text-white shadow-sm"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            Topo de bolo
          </button>
          <button
            onClick={() => setModo("tags")}
            className={`rounded-lg px-4 py-1.5 transition-colors ${
              modo === "tags"
                ? "brand-gradient text-white shadow-sm"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            Tags redondas
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
          {/* ------------------------------------------------ formulário */}
          <div className="space-y-5">
            {/* imagem */}
            <div className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-[13px] font-bold text-neutral-900">
                1. A arte
              </h2>

              <input
                ref={inputArquivo}
                type="file"
                accept="image/*"
                onChange={(e) => carregarImagem(e.target.files?.[0])}
                className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-dark"
              />

              {imagem && (
                <div className="mt-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagem}
                    alt="Arte escolhida"
                    className="h-16 w-16 rounded-lg border border-neutral-200 object-cover"
                  />
                  <button
                    onClick={() => {
                      setImagem(null);
                      if (inputArquivo.current) inputArquivo.current.value = "";
                    }}
                    className="text-[12px] text-neutral-500 hover:text-red-600"
                  >
                    Trocar
                  </button>
                </div>
              )}

              {modo === "topo" && (
                <div className="mt-4 border-t border-neutral-100 pt-4">
                  <p className="text-[12px] text-neutral-500">
                    Não tem a arte pronta? Diz o tema que eu monto o texto pra
                    gerar a imagem num gerador de IA.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={tema}
                      onChange={(e) => setTema(e.target.value)}
                      placeholder="Ex: Homem-Aranha, Ursinho safári, Roblox"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                    <button
                      onClick={gerarPrompt}
                      disabled={!tema.trim()}
                      className="shrink-0 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-900 disabled:opacity-40"
                    >
                      Gerar texto
                    </button>
                  </div>

                  {promptGerado && (
                    <div className="mt-3 rounded-lg bg-neutral-50 p-3">
                      <p className="text-[12px] leading-relaxed text-neutral-700">
                        {promptGerado}
                      </p>
                      <button
                        onClick={copiarPrompt}
                        className="mt-2 text-[12px] font-semibold text-brand hover:underline"
                      >
                        {copiado ? "✓ Copiado" : "Copiar"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* dados da pessoa (só topo) */}
            {modo === "topo" && (
              <div className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
                <h2 className="mb-1 text-[13px] font-bold text-neutral-900">
                  2. Nome e idade
                </h2>
                <p className="mb-3 text-[12px] text-neutral-500">
                  Os dois são opcionais — tem gente que não quer nome nenhum na arte.
                </p>
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome (opcional)"
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <input
                    value={idade}
                    onChange={(e) => setIdade(e.target.value)}
                    placeholder="Idade (opcional)"
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>
                <input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descrição do que é pra ser (opcional)"
                  className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>
            )}

            {/* medidas */}
            <div className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-[13px] font-bold text-neutral-900">
                {modo === "topo" ? "3. Formato e tamanho" : "2. Tamanho da tag"}
              </h2>

              {modo === "topo" ? (
                <>
                  <div className="flex gap-2">
                    {(["redondo", "quadrado"] as Formato[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormato(f)}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                          formato === f
                            ? "border-brand bg-brand text-white"
                            : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {formato === "redondo" ? (
                    <div className="mt-4">
                      <label className="mb-1.5 block text-[12.5px] font-medium text-neutral-700">
                        Diâmetro do bolo
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {DIAMETROS_CM.map((cm) => (
                          <button
                            key={cm}
                            onClick={() => setDiametroCm(cm)}
                            className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                              diametroCm === cm
                                ? "border-brand bg-brand text-white"
                                : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                            }`}
                          >
                            {cm} cm
                          </button>
                        ))}
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="text-[12px] text-neutral-500">Outro:</span>
                        <input
                          type="number"
                          min={5}
                          max={28}
                          value={diametroCm}
                          onChange={(e) => setDiametroCm(Number(e.target.value))}
                          className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-brand"
                        />
                        <span className="text-[12px] text-neutral-500">cm</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(
                        [
                          ["20x25", "20 × 25 cm"],
                          ["folha", "Folha inteira (20 × 28,7 cm)"],
                        ] as Array<[TamanhoQuadrado, string]>
                      ).map(([valor, texto]) => (
                        <button
                          key={valor}
                          onClick={() => setTamanhoQuadrado(valor)}
                          className={`rounded-lg border px-4 py-2 text-[13px] font-medium transition-colors ${
                            tamanhoQuadrado === valor
                              ? "border-brand bg-brand text-white"
                              : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                          }`}
                        >
                          {texto}
                        </button>
                      ))}
                    </div>
                  )}

                  {!cabeNaFolha && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                      {diametroCm} cm não cabe numa A4 — o máximo que a impressora
                      alcança é {(AREA_UTIL_LARGURA_MM / 10).toFixed(0)} cm de
                      largura.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {[3, 4, 5, 6, 7].map((cm) => (
                      <button
                        key={cm}
                        onClick={() => setTagDiametroCm(cm)}
                        className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                          tagDiametroCm === cm
                            ? "border-brand bg-brand text-white"
                            : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        {cm} cm
                      </button>
                    ))}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[12px] text-neutral-500">Outro:</span>
                    <input
                      type="number"
                      min={1}
                      max={15}
                      step={0.5}
                      value={tagDiametroCm}
                      onChange={(e) => setTagDiametroCm(Number(e.target.value))}
                      className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-brand"
                    />
                    <span className="text-[12px] text-neutral-500">cm</span>
                  </div>

                  <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2.5 text-[12.5px] text-neutral-700">
                    Cabem <b className="font-bold">{layoutTags.total} tags</b> na
                    folha — {layoutTags.porLinha} por linha × {layoutTags.linhas}{" "}
                    linhas, com 3 mm entre elas pra dar folga no recorte.
                  </p>
                </>
              )}
            </div>

            {/* imprimir */}
            <button
              onClick={() => window.print()}
              disabled={!podeImprimir}
              className="brand-gradient w-full rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand/20 transition-transform hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0"
            >
              {imagem ? "Imprimir folha A4" : "Escolha a arte primeiro"}
            </button>

            <p className="text-[11.5px] leading-relaxed text-neutral-400">
              Na janela de impressão: papel <b>A4</b>, margens <b>nenhuma</b> e
              escala <b>100%</b> (nunca &quot;ajustar à página&quot; — é o que
              estraga a medida). Confira com a régua na primeira vez.
            </p>
          </div>

          {/* -------------------------------------------------- pré-visão */}
          <div className="lg:w-[280px]">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Como vai sair na folha
            </p>
            <div
              className="relative overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-inner"
              style={{ width: 280, height: (280 * 297) / 210 }}
            >
              {imagem && (
                <PreviaFolha
                  modo={modo}
                  imagem={imagem}
                  escala={280 / 210}
                  medidaTopo={medidaTopo}
                  formato={formato}
                  layoutTags={layoutTags}
                />
              )}
              {!imagem && (
                <div className="flex h-full items-center justify-center px-6 text-center text-[11.5px] text-neutral-400">
                  A folha aparece aqui quando você escolher a arte
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ====================== FOLHA REAL (só aparece na impressão) ====== */}
      <div className="folha-impressao">
        {imagem && modo === "topo" && (
          <div
            style={{
              width: `${medidaTopo.larguraMm}mm`,
              height: `${medidaTopo.alturaMm}mm`,
              borderRadius: formato === "redondo" ? "50%" : undefined,
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagem}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}

        {imagem && modo === "tags" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${layoutTags.porLinha}, ${layoutTags.diametroMm}mm)`,
              gap: "3mm",
              paddingLeft: `${layoutTags.offsetXMm}mm`,
              paddingTop: `${layoutTags.offsetYMm}mm`,
            }}
          >
            {Array.from({ length: layoutTags.total }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: `${layoutTags.diametroMm}mm`,
                  height: `${layoutTags.diametroMm}mm`,
                  borderRadius: "50%",
                  overflow: "hidden",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagem}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        /* A folha de impressão fica fora da tela enquanto ninguém imprime —
           não dá pra só escondê-la, porque o navegador precisa dela montada
           com as medidas em mm pra calcular o papel certo. */
        .folha-impressao {
          position: absolute;
          left: -10000px;
          top: 0;
        }

        @media print {
          @page {
            size: A4;
            /* Margem zero aqui e ${MARGEM_MM}mm de padding na folha: assim a
               medida do desenho é a real, e a borda que a impressora não
               alcança não come pedaço da arte. */
            margin: 0;
          }
          .tela-only,
          aside,
          nav {
            display: none !important;
          }
          main {
            padding: 0 !important;
            max-width: none !important;
          }
          .folha-impressao {
            position: static;
            left: auto;
            width: ${AREA_UTIL_LARGURA_MM}mm;
            height: ${AREA_UTIL_ALTURA_MM}mm;
            padding: ${MARGEM_MM}mm;
            display: flex;
            align-items: flex-start;
            justify-content: center;
          }
          .folha-impressao img {
            /* Sem isso o navegador economiza tinta e a arte sai lavada. */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PreviaFolha({
  modo,
  imagem,
  escala,
  medidaTopo,
  formato,
  layoutTags,
}: {
  modo: Modo;
  imagem: string;
  escala: number;
  medidaTopo: { larguraMm: number; alturaMm: number };
  formato: Formato;
  layoutTags: ReturnType<typeof calcularLayoutTags>;
}) {
  // A prévia é a folha inteira reduzida: tudo que está em mm vira pixel
  // multiplicado pela mesma escala, então o que se vê é fiel à proporção.
  const mm = (v: number) => v * escala;

  if (modo === "topo") {
    return (
      <div
        className="absolute"
        style={{
          left: mm(MARGEM_MM),
          top: mm(MARGEM_MM),
          width: mm(AREA_UTIL_LARGURA_MM),
          height: mm(AREA_UTIL_ALTURA_MM),
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: mm(medidaTopo.larguraMm),
            height: mm(medidaTopo.alturaMm),
            borderRadius: formato === "redondo" ? "50%" : 2,
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagem}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute"
      style={{
        left: mm(MARGEM_MM + layoutTags.offsetXMm),
        top: mm(MARGEM_MM + layoutTags.offsetYMm),
        display: "grid",
        gridTemplateColumns: `repeat(${layoutTags.porLinha}, ${mm(layoutTags.diametroMm)}px)`,
        gap: mm(3),
      }}
    >
      {Array.from({ length: layoutTags.total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: mm(layoutTags.diametroMm),
            height: mm(layoutTags.diametroMm),
            borderRadius: "50%",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagem}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      ))}
    </div>
  );
}
