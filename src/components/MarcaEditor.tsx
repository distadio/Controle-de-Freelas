import React, { useRef, useState } from 'react';
import { Marca, CORES_PADRAO, processarLogo, textoSobre, fundoDoLogo, rgbParaHex } from '../services/marcaService';

interface MarcaEditorProps {
    marca: Marca;
    onChange: (marca: Marca) => void;
    numero?: string; // nº exibido na prévia
}

const mesmaCor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const MarcaEditor: React.FC<MarcaEditorProps> = ({ marca, onChange, numero }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [processando, setProcessando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const enviarLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const arquivo = e.target.files?.[0];
        e.target.value = ''; // permite enviar o mesmo arquivo de novo
        if (!arquivo) return;
        setErro(null);
        setProcessando(true);
        try {
            const logo = await processarLogo(arquivo);
            // Já sugere a cor principal do logo; o usuário pode trocar abaixo
            onChange({ ...marca, ...logo, cor: logo.coresLogo?.[0] || marca.cor });
        } catch (err) {
            setErro((err as Error).message);
        } finally {
            setProcessando(false);
        }
    };

    const removerLogo = () => onChange({ cor: marca.cor, logo: null });

    const texto = rgbParaHex(textoSobre(marca.cor));
    const fundo = fundoDoLogo(marca);
    const coresLogo = marca.coresLogo || [];
    const personalizada = ![...coresLogo, ...CORES_PADRAO.map(c => c.cor)].some(c => mesmaCor(c, marca.cor));

    const Amostra: React.FC<{ cor: string; nome: string }> = ({ cor, nome }) => (
        <button
            type="button"
            onClick={() => onChange({ ...marca, cor })}
            title={nome}
            aria-label={`Cor ${nome}`}
            aria-pressed={mesmaCor(cor, marca.cor)}
            className={`w-9 h-9 rounded-full border-2 transition-transform ${mesmaCor(cor, marca.cor) ? 'border-white ring-2 ring-gray-800 scale-110' : 'border-white shadow'}`}
            style={{ background: cor }}
        />
    );

    return (
        <div className="space-y-4">
            {/* Prévia do cabeçalho da invoice (fundo branco como no PDF) */}
            <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm" style={{ background: '#ffffff' }}>
                <div className="flex items-center gap-2 px-3 py-3 min-h-[68px]" style={{ background: marca.cor, color: texto }}>
                    <div className="w-[30%]">
                        <p className="font-black text-base leading-none">INVOICE</p>
                        <p className="text-[9px] opacity-90 mt-1">Fatura de Serviços</p>
                    </div>
                    <div className="flex-1 flex justify-center min-w-0">
                        {marca.logo ? (
                            <img
                                src={marca.logo}
                                alt="Logo da empresa"
                                className="max-h-11 max-w-full object-contain"
                                style={fundo ? { background: rgbParaHex(fundo), padding: 4, borderRadius: 4 } : undefined}
                            />
                        ) : (
                            <span className="text-[10px] border border-dashed rounded px-2 py-1 opacity-80" style={{ borderColor: texto }}>seu logo aqui</span>
                        )}
                    </div>
                    <div className="w-[30%] text-right text-[9px] leading-tight">
                        <p className="font-bold text-[11px] whitespace-nowrap">Nº {numero || '0001'}</p>
                        <p className="opacity-90">Vencimento</p>
                    </div>
                </div>
                <div className="p-2 space-y-1">
                    <div className="h-2.5 rounded-sm" style={{ background: marca.cor }} />
                    <div className="h-1.5 rounded-sm" style={{ background: '#e5e7eb' }} />
                    <div className="h-1.5 w-2/3 rounded-sm" style={{ background: '#e5e7eb' }} />
                </div>
            </div>

            {/* Logo */}
            <div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={processando}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                    >
                        {processando ? 'Processando logo...' : marca.logo ? '🔄 Trocar logo' : '📤 Enviar logo'}
                    </button>
                    {marca.logo && (
                        <button type="button" onClick={removerLogo} className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
                            Remover
                        </button>
                    )}
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={enviarLogo}
                    />
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">PNG com fundo transparente fica melhor. JPG e JPEG também funcionam. O logo fica centralizado no cabeçalho.</p>
                {erro && <p className="text-xs text-red-600 font-semibold mt-1.5" role="alert">🚫 {erro}</p>}
            </div>

            {/* Cor do cabeçalho */}
            {coresLogo.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Cores do seu logo</p>
                    <div className="flex flex-wrap gap-2.5">
                        {coresLogo.map((c, i) => <Amostra key={c} cor={c} nome={`do logo ${i + 1}`} />)}
                    </div>
                </div>
            )}
            <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">{coresLogo.length > 0 ? 'Outras cores' : 'Cor da invoice'}</p>
                <div className="flex flex-wrap gap-2.5 items-center">
                    {CORES_PADRAO.map(c => <Amostra key={c.cor} cor={c.cor} nome={c.nome} />)}
                    <label
                        title="Escolher qualquer cor"
                        className={`relative w-9 h-9 rounded-full border-2 flex items-center justify-center cursor-pointer overflow-hidden ${personalizada ? 'border-white ring-2 ring-gray-800 scale-110' : 'border-dashed border-gray-400'}`}
                        style={personalizada ? { background: marca.cor } : undefined}
                    >
                        {!personalizada && <span className="text-base">🎨</span>}
                        <input
                            type="color"
                            value={marca.cor}
                            onChange={(e) => onChange({ ...marca, cor: e.target.value })}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            aria-label="Escolher qualquer cor"
                        />
                    </label>
                </div>
            </div>
        </div>
    );
};

export default MarcaEditor;
