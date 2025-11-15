
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.pulodogatoead.controlefreelas',
  appName: 'Controle de Freelas',
  webDir: 'dist', // Você precisará de um passo de 'build' para gerar esta pasta
  server: {
    androidScheme: 'https'
  },
  plugins: {
    GoogleAuth: {
      scopes: ["profile", "email", "https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/calendar"],
      serverClientId: "165800758744-iagdlnets04qum5939s8bnpomqk1v4hm.apps.googleusercontent.com",
      forceCodeForRefreshToken: true
    }
  }
};

export default config;
