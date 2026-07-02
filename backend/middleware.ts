import type {
  NextFunction,
  Request,
  Response,
} from "express-serve-static-core";
import { createSupabaseClient } from "./client";
import { prisma } from "./db";



const client = createSupabaseClient();

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Unauthorized - Access Token not found",
      });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;

    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    const userId = user.id;
    try {
      if (userId) {
        await prisma.user.create({
          data: {
            id: user.id,
            supabaseId:user.id,
            email: user.email,
            provider:
              user.app_metadata.provider === "google" ? "Google" : "Github",
            name: user.app_metadata.full_name,
          },
        });
      }
    } catch (error) {
      console.log(error)
    }

    req.userId = userId;
    next();
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error during auth",
    });
  }
}
