import React from 'react';

interface PrivacyPolicyModalProps {
    isOpen: boolean;
    onAccept: () => void;
}

const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onAccept }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
            <div 
                className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] transition-transform duration-300 transform scale-95 animate-modal-in"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex items-center justify-center rounded-t-2xl flex-shrink-0">
                    <h3 className="text-lg font-bold text-center">
                        Política de Privacidade
                    </h3>
                </header>
                
                <div className="p-4 flex-shrink-0 border-b">
                    <p className="text-sm text-gray-700 text-center font-medium">
                        Ao acessar o aplicativo você concorda com a política de privacidade
                    </p>
                </div>

                <div className="overflow-y-auto flex-1 px-6 py-4">
                    <div className="prose prose-sm max-w-none">
                        <h1 className="text-xl font-bold mb-4">Política de Privacidade</h1>
                        <p className="text-xs text-gray-600 mb-6">Última atualização: 30 de novembro de 2025</p>
                        
                        <p className="text-sm text-gray-700 mb-4">
                            Esta Política de Privacidade descreve como o <strong>Pulo do Gato EAD</strong> ("nós", "nosso" ou "aplicativo"), uma empresa dedicada à gestão de agendas para freelancers, coleta, usa, armazena e protege as informações pessoais dos usuários ("você" ou "usuário") do nosso aplicativo de controle de freelas.
                        </p>

                        <h2 className="text-lg font-bold mt-6 mb-3">1. Informações que Coletamos</h2>
                        
                        <h3 className="text-base font-semibold mt-4 mb-2">1.1 Informações Fornecidas pelo Usuário</h3>
                        <ul className="list-disc pl-5 mb-4 text-sm text-gray-700 space-y-1">
                            <li><strong>Dados de Cadastro:</strong> Nome, e-mail, telefone e outras informações fornecidas durante o registro</li>
                            <li><strong>Dados Profissionais:</strong> Informações sobre serviços prestados, horários de disponibilidade e preferências de agenda</li>
                            <li><strong>Dados de Agendamentos:</strong> Informações sobre compromissos, clientes e histórico de atendimentos</li>
                            <li><strong>Credenciais de Integração:</strong> Informações de autenticação para Google Drive e Google Agenda, necessárias para sincronização em tempo real de agendamentos</li>
                        </ul>

                        <h3 className="text-base font-semibold mt-4 mb-2">1.2 Informações Coletadas Automaticamente</h3>
                        <ul className="list-disc pl-5 mb-4 text-sm text-gray-700 space-y-1">
                            <li><strong>Dados de Uso:</strong> Informações sobre como você utiliza o aplicativo, incluindo páginas visitadas e funcionalidades utilizadas</li>
                            <li><strong>Dados do Dispositivo:</strong> Tipo de dispositivo, sistema operacional, identificadores únicos e informações de rede</li>
                            <li><strong>Dados de Localização:</strong> Informações de localização aproximada baseadas no endereço IP (se aplicável)</li>
                            <li><strong>Dados de Integração:</strong> Informações técnicas de conexão com APIs do Google para sincronização de agendas e arquivos</li>
                        </ul>

                        <h2 className="text-lg font-bold mt-6 mb-3">2. Como Utilizamos Suas Informações</h2>
                        <p className="text-sm text-gray-700 mb-2">Utilizamos as informações coletadas para:</p>
                        <ul className="list-disc pl-5 mb-4 text-sm text-gray-700 space-y-1">
                            <li>Fornecer, operar e manter o aplicativo de controle de freelas</li>
                            <li>Gerenciar sua conta e fornecer suporte ao cliente</li>
                            <li>Processar e gerenciar seus agendamentos através de integrações com Google Agenda</li>
                            <li>Sincronizar informações de freelas em tempo real com Google Drive e Google Agenda</li>
                            <li>Enviar notificações sobre compromissos e atualizações do serviço</li>
                            <li>Melhorar, personalizar e expandir nossos serviços de gestão de agenda</li>
                            <li>Analisar o uso do aplicativo para fins estatísticos e otimização de integrações</li>
                            <li>Detectar, prevenir e solucionar problemas técnicos nas sincronizações</li>
                            <li>Cumprir obrigações legais e regulatórias</li>
                        </ul>

                        <h2 className="text-lg font-bold mt-6 mb-3">3. Compartilhamento de Informações</h2>
                        <p className="text-sm text-gray-700 mb-2">
                            Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros, exceto nas seguintes situações:
                        </p>
                        <ul className="list-disc pl-5 mb-4 text-sm text-gray-700 space-y-1">
                            <li><strong>Com seu consentimento:</strong> Quando você autorizar explicitamente o compartilhamento</li>
                            <li><strong>Integrações autorizadas:</strong> Compartilhamento técnico com APIs do Google (Drive e Agenda) para sincronização de dados, conforme suas credenciais de login</li>
                            <li><strong>Prestadores de serviços:</strong> Com empresas que nos auxiliam na operação do aplicativo (hospedagem, análise de dados), sob acordos de confidencialidade</li>
                            <li><strong>Exigências legais:</strong> Quando necessário para cumprir leis, regulamentos, processos legais ou solicitações governamentais</li>
                            <li><strong>Proteção de direitos:</strong> Para proteger nossos direitos, propriedade ou segurança, bem como de nossos usuários</li>
                        </ul>

                        <h2 className="text-lg font-bold mt-6 mb-3">4. Armazenamento e Segurança</h2>
                        <p className="text-sm text-gray-700 mb-2">
                            Implementamos medidas de segurança técnicas e organizacionais apropriadas para proteger suas informações pessoais contra acesso não autorizado, alteração, divulgação ou destruição, incluindo:
                        </p>
                        <ul className="list-disc pl-5 mb-4 text-sm text-gray-700 space-y-1">
                            <li>Criptografia de dados em trânsito e em repouso, especialmente credenciais de login para Google</li>
                            <li>Controles de acesso e autenticação de dois fatores quando disponível</li>
                            <li>Monitoramento regular de segurança das integrações com serviços do Google</li>
                            <li>Backup regular de dados com políticas de retenção seguras</li>
                        </ul>
                        <p className="text-sm text-gray-700 mb-4">
                            Seus dados são armazenados em servidores seguros localizados no Brasil e/ou em servidores de provedores confiáveis que atendem aos padrões internacionais de segurança. As integrações com Google Drive e Google Agenda utilizam as APIs oficiais do Google com protocolos de segurança HTTPS.
                        </p>

                        <h2 className="text-lg font-bold mt-6 mb-3">5. Retenção de Dados</h2>
                        <p className="text-sm text-gray-700 mb-4">
                            Mantemos suas informações pessoais pelo tempo necessário para cumprir as finalidades descritas nesta política, a menos que um período de retenção mais longo seja exigido ou permitido por lei. Após o encerramento de sua conta, seus dados serão excluídos ou anonimizados dentro de um prazo razoável, incluindo a revogação das permissões de integração com serviços do Google.
                        </p>

                        <h2 className="text-lg font-bold mt-6 mb-3">6. Seus Direitos</h2>
                        <p className="text-sm text-gray-700 mb-2">
                            De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
                        </p>
                        <ul className="list-disc pl-5 mb-4 text-sm text-gray-700 space-y-1">
                            <li><strong>Acesso:</strong> Solicitar cópias das suas informações pessoais, incluindo dados sincronizados com Google Drive e Agenda</li>
                            <li><strong>Correção:</strong> Solicitar correção de informações imprecisas ou incompletas</li>
                            <li><strong>Exclusão:</strong> Solicitar a exclusão de suas informações pessoais e revogação de integrações</li>
                            <li><strong>Portabilidade:</strong> Solicitar a transferência de seus dados para outro fornecedor</li>
                            <li><strong>Revogação do consentimento:</strong> Retirar seu consentimento a qualquer momento, incluindo permissões de login para Google</li>
                            <li><strong>Oposição:</strong> Opor-se ao processamento de suas informações em determinadas circunstâncias</li>
                        </ul>
                        <p className="text-sm text-gray-700 mb-4">
                            Para exercer esses direitos, entre em contato conosco através dos canais indicados na seção "Contato". Você também pode gerenciar suas permissões de integração diretamente nas configurações do Google Account.
                        </p>

                        <h2 className="text-lg font-bold mt-6 mb-3">7. Cookies e Tecnologias Similares</h2>
                        <p className="text-sm text-gray-700 mb-4">
                            O aplicativo pode utilizar cookies e tecnologias similares para melhorar a experiência do usuário, manter sessões de login, analisar o uso do serviço e personalizar conteúdo. Você pode configurar seu navegador para recusar cookies, mas isso pode afetar algumas funcionalidades do aplicativo, incluindo sincronizações em tempo real.
                        </p>

                        <h2 className="text-lg font-bold mt-6 mb-3">8. Links para Sites de Terceiros</h2>
                        <p className="text-sm text-gray-700 mb-4">
                            Nosso aplicativo integra com serviços do Google (Drive e Agenda). Não nos responsabilizamos pelas práticas de privacidade desses serviços, mas garantimos que todas as integrações utilizam as APIs oficiais e protocolos seguros. Recomendamos que você leia as políticas de privacidade do Google em policies.google.com/privacy.
                        </p>

                        <h2 className="text-lg font-bold mt-6 mb-3">9. Proteção de Dados de Menores</h2>
                        <p className="text-sm text-gray-700 mb-4">
                            O Pulo do Gato EAD não é direcionado a menores de 18 anos. Não coletamos intencionalmente informações pessoais de menores. Se tomarmos conhecimento de que coletamos dados de um menor, tomaremos medidas para excluir essas informações imediatamente.
                        </p>

                        <h2 className="text-lg font-bold mt-6 mb-3">10. Transferência Internacional de Dados</h2>
                        <p className="text-sm text-gray-700 mb-4">
                            Suas informações podem ser transferidas e mantidas em computadores localizados fora do seu estado, província, país ou outra jurisdição governamental onde as leis de proteção de dados podem diferir, especialmente durante integrações com serviços do Google localizados nos Estados Unidos. Ao usar nosso aplicativo e autorizar integrações com o Google, você concorda com essa transferência. O Google oferece proteções adequadas para dados transferidos internacionalmente conforme suas políticas de privacidade.
                        </p>

                        <h2 className="text-lg font-bold mt-6 mb-3">11. Alterações nesta Política</h2>
                        <p className="text-sm text-gray-700 mb-4">
                            Podemos atualizar nossa Política de Privacidade periodicamente para refletir mudanças em nossos serviços ou requisitos legais. Notificaremos você sobre quaisquer alterações publicando a nova política nesta página e atualizando a "data da última atualização". Recomendamos que você revise esta política periodicamente, especialmente quando autorizar novas integrações ou permissões.
                        </p>

                        <h2 className="text-lg font-bold mt-6 mb-3">12. Contato</h2>
                        <p className="text-sm text-gray-700 mb-2">
                            Se você tiver dúvidas sobre esta Política de Privacidade ou sobre nossas práticas de dados, entre em contato conosco:
                        </p>
                        <div className="text-sm text-gray-700 mb-4 space-y-1">
                            <p><strong>Empresa:</strong> Pulo do Gato EAD</p>
                            <p><strong>E-mail:</strong> contato@pulodogatoead.com.br</p>
                            <p><strong>Telefone:</strong> +55 11 99570 0408</p>
                            <p><strong>Site:</strong> https://pulodogatoead.com.br</p>
                            <p><strong>Endereço:</strong> Rua Clausetti, 200, PQ Guaianases, São Paulo - SP, CEP 08431-460, Brasil</p>
                        </div>

                        <h2 className="text-lg font-bold mt-6 mb-3">13. Consentimento</h2>
                        <p className="text-sm text-gray-700 mb-6">
                            Ao utilizar nosso aplicativo e autorizar integrações com Google Drive e Google Agenda, você concorda com esta Política de Privacidade e com o processamento de suas informações conforme descrito. Você pode revogar permissões de login a qualquer momento através das configurações do aplicativo ou do Google Account.
                        </p>

                        <div className="mt-8 mb-4 flex justify-center">
                            <button
                                onClick={onAccept}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 w-full max-w-xs"
                            >
                                Aceito
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes modal-in {
                    from { opacity: 0; transform: scale(0.95) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-modal-in {
                    animation: modal-in 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default PrivacyPolicyModal;

