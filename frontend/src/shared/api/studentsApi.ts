/**
 * @fileoverview Módulo de integración con la API REST (studentsApi).
 *
 * @module studentsApi
 */

import { http } from "./http";
import type { StudentProfileResponse } from "../../features/students/types";

export const studentsApi = {
  /** Expediente de un alumno. Solo ADMIN/TEACHER; el docente ve sus proyectos. */
  async profile(studentId: string): Promise<StudentProfileResponse> {
    const { data } = await http.get<StudentProfileResponse>(
      `/students/${studentId}/profile`,
    );
    return data;
  },

  /** Expediente propio del alumno: el backend lo resuelve desde el token. */
  async myProfile(): Promise<StudentProfileResponse> {
    const { data } = await http.get<StudentProfileResponse>(
      "/students/me/profile",
    );
    return data;
  },
};
