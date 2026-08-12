import { NextFunction, Request, Response } from "express";
import { ZodError, ZodType } from "zod";

type RequestSchema = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

export function validate(schema: RequestSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.params) Object.assign(req.params, schema.params.parse(req.params));
      if (schema.query) Object.assign(req.query, schema.query.parse(req.query));
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(error);
      }

      next(error);
    }
  };
}
