import { publicEnvSchema } from "@eguardimmo/config/env/public";

export const dataSource = publicEnvSchema.shape.NEXT_PUBLIC_DATA_SOURCE.parse(process.env.NEXT_PUBLIC_DATA_SOURCE);
