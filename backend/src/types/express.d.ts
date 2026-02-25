import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      supabaseUserId: string;
      email: string | null;
      provider: string | null;
    };
  }
}

