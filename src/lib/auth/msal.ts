"use client";

import {
  BrowserCacheLocation,
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from "@azure/msal-browser";

// Delegated scopes. Admin-consented extras (User.Read.All) are included in
// the Graph token automatically, so they are not requested here.
export const FLOW_SCOPES = [
  "https://service.flow.microsoft.com/User",
  "https://service.flow.microsoft.com/Flows.Read.All",
  "https://service.flow.microsoft.com/Activity.Read.All",
];
export const GRAPH_SCOPES = ["User.Read", "User.ReadBasic.All"];

export interface AuthSettings {
  tenantId: string;
  clientId: string;
  appUrl: string;
}

export interface Tokens {
  flow: string;
  graph: string;
}

export class Auth {
  private readonly msal: PublicClientApplication;
  private ready: Promise<void> | null = null;
  private interaction: Promise<void> | null = null;

  constructor(settings: AuthSettings) {
    const redirectUri = `${settings.appUrl}/`;
    this.msal = new PublicClientApplication({
      auth: {
        clientId: settings.clientId,
        authority: `https://login.microsoftonline.com/${settings.tenantId}`,
        redirectUri,
        postLogoutRedirectUri: redirectUri,
      },
      // Stay signed in across reloads. (MSAL 5 keeps interaction state in
      // sessionStorage on its own, so two tabs don't trip over each other.)
      cache: { cacheLocation: BrowserCacheLocation.LocalStorage },
    });
  }

  /** Completes a pending redirect and returns the signed-in account, if any. */
  async init(): Promise<AccountInfo | null> {
    this.ready ??= (async () => {
      await this.msal.initialize();
      // The redirect URI is the app root, so stay there after sign-in.
      const result = await this.msal.handleRedirectPromise({ navigateToLoginRequestUrl: false });
      if (result?.account) this.msal.setActiveAccount(result.account);
    })();
    await this.ready;
    return this.account();
  }

  account(): AccountInfo | null {
    const active = this.msal.getActiveAccount();
    if (active) return active;
    // Never guess between several cached accounts.
    const accounts = this.msal.getAllAccounts();
    return accounts.length === 1 ? accounts[0] : null;
  }

  signIn(): Promise<void> {
    return this.interact(() =>
      this.msal.loginRedirect({
        scopes: FLOW_SCOPES,
        extraScopesToConsent: GRAPH_SCOPES,
        prompt: "select_account",
      }),
    );
  }

  signOut(): Promise<void> {
    return this.interact(() => this.msal.logoutRedirect({ account: this.account() ?? undefined }));
  }

  /** Both tokens, silently. Returns null while a redirect is started. */
  async tokens(): Promise<Tokens | null> {
    await this.init();
    const account = this.account();
    if (!account) return null;
    this.msal.setActiveAccount(account);
    const flow = await this.token(account, FLOW_SCOPES);
    const graph = flow && (await this.token(account, GRAPH_SCOPES));
    return flow && graph ? { flow, graph } : null;
  }

  private async token(account: AccountInfo, scopes: string[]): Promise<string | null> {
    try {
      return (await this.msal.acquireTokenSilent({ account, scopes })).accessToken;
    } catch (error) {
      if (!(error instanceof InteractionRequiredAuthError)) throw error;
      await this.interact(() => this.msal.acquireTokenRedirect({ account, scopes }));
      return null;
    }
  }

  private interact(start: () => Promise<void>): Promise<void> {
    this.interaction ??= start().finally(() => {
      this.interaction = null;
    });
    return this.interaction;
  }
}
