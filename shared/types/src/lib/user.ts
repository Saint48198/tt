export type JwtRole = string;

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash?: string;
  google_access_token?: string | null;
  google_refresh_token?: string | null;
  google_token_expiry?: string | null;
  roles?: JwtRole[] | undefined;
}

export type VerifyUserResult = {
  user?: User | null;
  error?: string | null;
  details?: string;
}
