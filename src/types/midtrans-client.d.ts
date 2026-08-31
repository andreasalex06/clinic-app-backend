declare module "midtrans-client" {
  type SnapConfig = {
    isProduction: boolean;
    serverKey: string;
    clientKey: string;
  };

  type SnapTransactionResponse = {
    token: string;
    redirect_url: string;
  };

  class Snap {
    constructor(config: SnapConfig);
    createTransaction(parameter: unknown): Promise<SnapTransactionResponse>;
  }

  const midtransClient: {
    Snap: typeof Snap;
  };

  export default midtransClient;
}
