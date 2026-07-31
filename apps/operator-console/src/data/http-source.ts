import type {
  AddressLabelViewModel,
  CaScanListItem,
  CaScanViewModel,
  LocalDemoLabelInput,
  OperatorConsoleDataSource,
  TaskViewModel,
  WalletListItem,
  WalletPoolSummary,
  WalletViewModel,
} from "./types";

/**
 * Skeleton HTTP adapter for future hotpath wiring.
 * Fail-closed: never calls network in Shell phase.
 */
export class HttpOperatorConsoleDataSource implements OperatorConsoleDataSource {
  constructor(private readonly baseUrl: string | null = null) {}

  getDataSourceMeta() {
    return {
      mode: "http" as const,
      live: false,
      note: this.baseUrl
        ? "HTTP adapter present but Live gate not enabled in Shell."
        : "not_configured — HTTP Operator API base URL missing.",
    };
  }

  private fail(): never {
    throw new Error("not_configured: HttpOperatorConsoleDataSource is scaffold-only in OPERATOR-CONSOLE-SHELL-001");
  }

  async listCaScans(): Promise<CaScanListItem[]> {
    this.fail();
  }
  async getCaScan(_mint: string): Promise<CaScanViewModel | null> {
    this.fail();
  }
  async listWallets(): Promise<{ summary: WalletPoolSummary; items: WalletListItem[] }> {
    this.fail();
  }
  async getWallet(_walletId: string): Promise<WalletViewModel | null> {
    this.fail();
  }
  async listAddressLabels(): Promise<AddressLabelViewModel[]> {
    this.fail();
  }
  async saveLocalDemoLabel(_input: LocalDemoLabelInput): Promise<void> {
    this.fail();
  }
  async listTasks(): Promise<TaskViewModel[]> {
    this.fail();
  }
  async getTask(_taskId: string): Promise<TaskViewModel | null> {
    this.fail();
  }
  async createLocalDemoTask(_mint: string): Promise<TaskViewModel> {
    this.fail();
  }
}
