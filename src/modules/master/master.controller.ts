import { NextFunction, Request, Response } from "express";
import { prisma } from "../../config/prisma";

export async function getDiagnoses(_req: Request, res: Response, next: NextFunction) {
  try {
    const diagnoses = await prisma.diagnosis.findMany({ orderBy: { name: "asc" } });
    res.json({ data: diagnoses });
  } catch (error) {
    next(error);
  }
}

export async function createDiagnosis(req: Request, res: Response, next: NextFunction) {
  try {
    const diagnosis = await prisma.diagnosis.create({ data: req.body });
    res.status(201).json({ data: diagnosis });
  } catch (error) {
    next(error);
  }
}

export async function updateDiagnosis(req: Request, res: Response, next: NextFunction) {
  try {
    const diagnosis = await prisma.diagnosis.update({
      where: { id: req.params.id as string },
      data: req.body
    });
    res.json({ data: diagnosis });
  } catch (error) {
    next(error);
  }
}

export async function deleteDiagnosis(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.diagnosis.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getTreatments(_req: Request, res: Response, next: NextFunction) {
  try {
    const treatments = await prisma.treatment.findMany({ orderBy: { name: "asc" } });
    res.json({ data: treatments });
  } catch (error) {
    next(error);
  }
}

export async function createTreatment(req: Request, res: Response, next: NextFunction) {
  try {
    const treatment = await prisma.treatment.create({ data: req.body });
    res.status(201).json({ data: treatment });
  } catch (error) {
    next(error);
  }
}

export async function updateTreatment(req: Request, res: Response, next: NextFunction) {
  try {
    const treatment = await prisma.treatment.update({
      where: { id: req.params.id as string },
      data: req.body
    });
    res.json({ data: treatment });
  } catch (error) {
    next(error);
  }
}

export async function deleteTreatment(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.treatment.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getMedicines(_req: Request, res: Response, next: NextFunction) {
  try {
    const medicines = await prisma.medicine.findMany({ orderBy: { name: "asc" } });
    res.json({ data: medicines });
  } catch (error) {
    next(error);
  }
}

export async function createMedicine(req: Request, res: Response, next: NextFunction) {
  try {
    const medicine = await prisma.medicine.create({ data: req.body });
    res.status(201).json({ data: medicine });
  } catch (error) {
    next(error);
  }
}

export async function updateMedicine(req: Request, res: Response, next: NextFunction) {
  try {
    const medicine = await prisma.medicine.update({
      where: { id: req.params.id as string },
      data: req.body
    });
    res.json({ data: medicine });
  } catch (error) {
    next(error);
  }
}

export async function deleteMedicine(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.medicine.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
