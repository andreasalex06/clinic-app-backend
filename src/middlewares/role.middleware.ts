import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError("Authentication is required", 401);
      }

      if (!roles.includes(req.user.role)) {
        throw new AppError("You are not allowed to access this resource", 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
