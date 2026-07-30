export interface AppConfig {
  port: number;
  mongodbUri: string;
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  publicBaseUrl: string;
  clientUrl: string;
  tokenEncryptionKey: string;
  jwtSecret: string;
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongodbUri: process.env.MONGODB_URI as string,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    callbackUrl: process.env.GOOGLE_REDIRECT_URI as string,
  },
  publicBaseUrl: process.env.PUBLIC_BASE_URL as string,
  clientUrl: process.env.CLIENT_URL ?? process.env.PUBLIC_BASE_URL as string,
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY as string,
  jwtSecret: process.env.JWT_SECRET as string,
});
