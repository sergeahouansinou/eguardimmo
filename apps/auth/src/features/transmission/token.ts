import { z } from "zod";

export const TRANSMISSION_TOKEN_LENGTH = 48;
export const transmissionTokenSchema = z.string().regex(/^[A-Za-z0-9]{48}$/);

export const ZIP_FILE_NAME = "dossier-recouvrement.zip";
