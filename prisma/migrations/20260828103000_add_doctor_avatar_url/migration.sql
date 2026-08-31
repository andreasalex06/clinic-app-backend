ALTER TABLE "Doctor" ADD COLUMN "avatarUrl" TEXT;

UPDATE "Doctor"
SET "avatarUrl" = CASE "phone"
  WHEN '0812-1000-1101' THEN '/doctor-avatars/doctor-01.svg'
  WHEN '0812-1000-1102' THEN '/doctor-avatars/doctor-02.svg'
  WHEN '0812-1000-1103' THEN '/doctor-avatars/doctor-03.svg'
  WHEN '0812-1000-1104' THEN '/doctor-avatars/doctor-04.svg'
  WHEN '0812-1000-1105' THEN '/doctor-avatars/doctor-05.svg'
  WHEN '0812-1000-1106' THEN '/doctor-avatars/doctor-06.svg'
  WHEN '0812-1000-1107' THEN '/doctor-avatars/doctor-07.svg'
  WHEN '0812-1000-1108' THEN '/doctor-avatars/doctor-08.svg'
  WHEN '0812-1000-1109' THEN '/doctor-avatars/doctor-09.svg'
  WHEN '0812-1000-1110' THEN '/doctor-avatars/doctor-10.svg'
  ELSE "avatarUrl"
END;
