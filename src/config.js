// src/config.js
import { config } from "dotenv";
config()

export const BD_HOST=process.env.BD_HOST || bxtewr68vcyp29pcnz23-mysql.services.clever-cloud.com
/* export const BD_DATABASE=process.env.BD_DATABASE || promarosa_bd */
export const BD_DATABASE=process.env.BD_DATABASE || bxtewr68vcyp29pcnz23
export const DB_USER=process.env.DB_USER || root
export const DB_PASSWORD=process.env.DB_PASSWORD || ''
export const DB_PORT=process.env.DB_PORT || 3306
export const PORT=process.env.PORT || 3000