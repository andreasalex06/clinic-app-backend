import { NextFunction, Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";

export async function getDoctors(_req: Request, res: Response, next: NextFunction) {
  try {
    const doctors = await prisma.doctor.findMany({
      orderBy: { name: "asc" }
    });

    res.json({ data: doctors });
  } catch (error) {
    next(error);
  }
}

export async function getDoctorById(req: Request, res: Response, next: NextFunction) {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.id as string }
    });

    if (!doctor) {
      throw new AppError("Doctor not found", 404);
    }

    res.json({ data: doctor });
  } catch (error) {
    next(error);
  }
}

export async function createDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    const doctor = await prisma.doctor.create({
      data: req.body
    });

    res.status(201).json({ data: doctor });
  } catch (error) {
    next(error);
  }
}

export async function updateDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    const doctor = await prisma.doctor.update({
      where: { id: req.params.id as string },
      data: req.body
    });

    res.json({ data: doctor });
  } catch (error) {
    next(error);
  }
}

export async function deleteDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.doctor.delete({
      where: { id: req.params.id as string }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
