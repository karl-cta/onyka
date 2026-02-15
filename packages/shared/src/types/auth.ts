export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface LoginResponse {
  user: {
    id: string
    email: string
    name: string
    avatarUrl?: string
  }
  tokens: TokenPair
}

export interface RefreshTokenResponse {
  tokens: TokenPair
}

export interface JwtPayload {
  sub: string
  email: string
  iat: number
  exp: number
}
